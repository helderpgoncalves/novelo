"""Cenários de referência: 5 por locais reais (20 000 a 150 000 €/ano) e 1 por freguesia (60 000 €/ano).

A sala de decisão e o controlo de orçamento interpolam entre os cenários por locais; o ecrã inicial e a introdução
guiada mostram o plano de recolha do cenário por freguesia (`ONBOARDING_KEY`). Cada um leva `reference_key` e a
versão do modelo com que foi calculado.

No arranque (`SEED_REFERENCE_SCENARIOS=true`) cria os que faltam e **recalcula os desatualizados**: versão do modelo
diferente de `REFERENCE_MODEL_VERSION`, versão dos pressupostos ativos diferente, sem `collection_plan` ou com
`site_mode = street`. Primeiro calcula o novo e só depois apaga o antigo da mesma chave (a página nunca fica sem
referência). Só apaga cenários com `reference_key`: os dos utilizadores nunca. Cada cenário demora 20 a 40 s, por isso
corre fora do pedido, um de cada vez, e uma tranca consultiva do Postgres evita que dois processos repitam o trabalho.
"""

import asyncio
import logging
import re
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Literal

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import defer

from novelo.core.database import SessionLocal, engine
from novelo.domain.vocab import CollectionMode, ScenarioObjective
from novelo.features.planning import service
from novelo.features.planning.models import Scenario
from novelo.features.planning.schemas import ReferenceScenarioOut, ReferenceStaleReason, ScenarioRequest
from novelo.features.users.models import User

log = logging.getLogger(__name__)

# Sobe sempre que o modelo muda de forma que os cenários guardados deixam de representar a proposta atual.
# 1 (implícito, sem coluna): contentor de rua e procura de 0,7 kg/hab/mês. 2: rede sem contentores, procura
# Vitrus + APA e plano de recolha porta a porta (21 out 2026). 3: localidades na freguesia CAOP 2019 (o C7 e outras
# passam a contar), dias de serviço só de indiferenciado com viatura e toneladas reutilizáveis nos KPIs (22 out 2026).
REFERENCE_MODEL_VERSION = 3
REFERENCE_BUDGETS_EUR = (20_000, 40_000, 60_000, 100_000, 150_000)
PARISH_BUDGET_EUR = 60_000
LOCK_KEY = 74_2026_21  # tranca consultiva (arbitrária, fixa)
LABEL_PREFIX = "Referência · locais reais"
PARISH_LABEL_PREFIX = "Referência · por freguesia"
ONBOARDING_KEY = f"parish:{PARISH_BUDGET_EUR}"

Siting = Literal["sites", "parish"]


@dataclass(frozen=True)
class ReferenceSpec:
    key: str
    siting: Siting
    budget_eur: int

    @property
    def label(self) -> str:
        prefix = LABEL_PREFIX if self.siting == "sites" else PARISH_LABEL_PREFIX
        return f"{prefix} · {_eur(self.budget_eur)} €/ano"

    def request(self) -> ScenarioRequest:
        return ScenarioRequest(
            label=self.label,
            objective=ScenarioObjective.MAX_TONNES,
            budget_eur_year=float(self.budget_eur),
            siting=self.siting,
        )


def _eur(budget: int) -> str:
    return f"{budget:,}".replace(",", " ")


SPECS: tuple[ReferenceSpec, ...] = (
    *(ReferenceSpec(f"sites:{b}", "sites", b) for b in REFERENCE_BUDGETS_EUR),
    ReferenceSpec(ONBOARDING_KEY, "parish", PARISH_BUDGET_EUR),
)
_SPEC_BY_KEY = {s.key: s for s in SPECS}
_LEGACY_LABEL = re.compile(rf"^({re.escape(LABEL_PREFIX)}|{re.escape(PARISH_LABEL_PREFIX)}) · ([\d  ]+) €/ano$")


def label_for(budget: int) -> str:
    return ReferenceSpec(f"sites:{budget}", "sites", budget).label


def legacy_key(label: str, siting: str) -> str | None:
    """Chave de um cenário de referência antigo, sem marca, reconhecido pelo rótulo que o arranque lhe deu."""
    m = _LEGACY_LABEL.match(label)
    if m is None:
        return None
    kind: Siting = "sites" if m.group(1) == LABEL_PREFIX else "parish"
    key = f"{kind}:{int(re.sub(r'\D', '', m.group(2)))}"
    return key if key in _SPEC_BY_KEY and siting == kind else None


def stale_reasons(
    reference_version: int | None,
    parameter_set_version: int,
    current_parameter_version: int,
    has_collection_plan: bool,
    site_mode: str | None,
) -> list[ReferenceStaleReason]:
    reasons: list[ReferenceStaleReason] = []
    if reference_version != REFERENCE_MODEL_VERSION:
        reasons.append("model_version")
    if parameter_set_version != current_parameter_version:
        reasons.append("parameters")
    if not has_collection_plan:
        reasons.append("no_collection_plan")
    if site_mode == CollectionMode.STREET.value:
        reasons.append("street")
    return reasons


def _row_reasons(row: Scenario, current_parameter_version: int) -> list[ReferenceStaleReason]:
    result: dict[str, Any] = row.result or {}
    siting = result.get("siting") or {}
    return stale_reasons(
        row.reference_version,
        row.parameter_set_version,
        current_parameter_version,
        result.get("collection_plan") is not None,
        siting.get("site_mode") if isinstance(siting, dict) else None,
    )


@dataclass
class RefreshOutcome:
    adopted: int = 0
    created: int = 0
    deleted: int = 0


async def _adopt_legacy(db: AsyncSession) -> int:
    """Marca os cenários de referência criados antes da coluna `reference_key` (ficam com versão nula, logo
    desatualizados). Só os que o arranque criou: rótulo exato, sem pai, sem restrições, orçamento igual ao do rótulo
    e autor administrador. Um cenário de utilizador nunca é adotado (e por isso nunca é apagado)."""
    rows = (
        await db.execute(
            select(Scenario.id, Scenario.label, Scenario.siting, Scenario.budget_eur_year)
            .join(User, User.id == Scenario.created_by_id)
            .where(
                Scenario.reference_key.is_(None),
                Scenario.parent_id.is_(None),
                Scenario.objective == ScenarioObjective.MAX_TONNES,
                Scenario.constraints == text("'{}'::jsonb"),
                Scenario.label.like("Referência · %"),
                User.role == "admin",
            )
        )
    ).all()
    adopted = 0
    for scenario_id, label, siting, budget in rows:
        key = legacy_key(label, siting)
        if key is None or budget is None or int(budget) != _SPEC_BY_KEY[key].budget_eur:
            continue
        await db.execute(update(Scenario).where(Scenario.id == scenario_id).values(reference_key=key))
        adopted += 1
    await db.commit()
    return adopted


async def _rows_for(db: AsyncSession, key: str) -> Sequence[Scenario]:
    return (
        (
            await db.execute(
                select(Scenario).where(Scenario.reference_key == key).order_by(Scenario.created_at.desc(), Scenario.id)
            )
        )
        .scalars()
        .all()
    )


async def refresh(db: AsyncSession, specs: Sequence[ReferenceSpec] = SPECS) -> RefreshOutcome:
    """Cria os cenários de referência em falta e recalcula os desatualizados. Idempotente; sem tranca (ver `seed`)."""
    out = RefreshOutcome(adopted=await _adopt_legacy(db))
    admin = (
        (
            await db.execute(
                select(User)
                .where(User.role == "admin", User.is_active.is_(True), User.approval_status == "approved")
                .order_by(User.created_at)
            )
        )
        .scalars()
        .first()
    )
    if admin is None:
        log.info("Cenários de referência: sem administrador ativo, nada a fazer")
        return out
    version = (await service.ensure_default_parameters(db)).version
    for spec in specs:
        rows = await _rows_for(db, spec.key)
        keep = next((r for r in rows if not _row_reasons(r, version)), None)
        if keep is None:
            created = await service.run_scenario(
                db, spec.request(), admin, reference_key=spec.key, reference_version=REFERENCE_MODEL_VERSION
            )
            out.created += 1
            keep_id = created.id
            log.info("Cenário de referência %s calculado (%s)", spec.key, created.id)
        else:
            keep_id = keep.id
        old = [r.id for r in rows if r.id != keep_id]
        if old:
            # Só linhas com esta `reference_key`: nunca um cenário de utilizador.
            await db.execute(delete(Scenario).where(Scenario.id.in_(old), Scenario.reference_key == spec.key))
            await db.commit()
            out.deleted += len(old)
    return out


async def seed_reference_scenarios(
    lock_engine: AsyncEngine | None = None, sessions: async_sessionmaker[AsyncSession] | None = None
) -> RefreshOutcome | None:
    """`refresh` sob uma tranca consultiva; `None` se outro processo já a tem (esse faz o trabalho)."""
    # A tranca é da ligação: fica numa ligação própria até ao fim (as sessões dos cenários usam outras).
    async with (lock_engine or engine).connect() as lock:
        got = await lock.scalar(text("SELECT pg_try_advisory_lock(:k)"), {"k": LOCK_KEY})
        if not got:
            return None
        try:
            async with (sessions or SessionLocal)() as db:
                return await refresh(db)
        finally:
            await lock.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": LOCK_KEY})


async def seed_in_background() -> None:
    """Corre depois de a API arrancar; nunca derruba o arranque."""
    try:
        await asyncio.sleep(20)  # deixa o arranque e o seed dos dados terminarem
        outcome = await seed_reference_scenarios()
        if outcome and (outcome.created or outcome.deleted):
            log.info(
                "Cenários de referência: %d calculados, %d desatualizados apagados, %d antigos marcados",
                outcome.created, outcome.deleted, outcome.adopted,
            )  # fmt: skip
    except asyncio.CancelledError:
        raise
    except Exception:
        log.exception("Não foi possível criar os cenários de referência")


async def list_references(db: AsyncSession) -> list[ReferenceScenarioOut]:
    """O cenário mais recente de cada chave, pela ordem de `SPECS` (sem abrir o JSON do resultado)."""
    version = (await service.ensure_default_parameters(db)).version
    rows = (
        await db.execute(
            select(
                Scenario,
                func.jsonb_typeof(Scenario.result["collection_plan"]) == "array",
                Scenario.result["siting"]["site_mode"].astext,
            )
            .options(defer(Scenario.result), defer(Scenario.params), defer(Scenario.constraints))
            .where(Scenario.reference_key.in_([s.key for s in SPECS]))
            .order_by(Scenario.created_at.desc(), Scenario.id)
        )
    ).all()
    latest: dict[str, ReferenceScenarioOut] = {}
    for row, has_plan, site_mode in rows:
        key = row.reference_key
        if key is None or key in latest:
            continue
        reasons = stale_reasons(row.reference_version, row.parameter_set_version, version, bool(has_plan), site_mode)
        latest[key] = ReferenceScenarioOut(
            **service.summary_of(row).model_dump(),
            up_to_date=not reasons,
            stale_reasons=reasons,
            onboarding=key == ONBOARDING_KEY,
        )
    return [latest[s.key] for s in SPECS if s.key in latest]
