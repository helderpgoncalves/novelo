"""Cenários de referência por locais reais, criados uma só vez e em segundo plano no arranque.

A sala de decisão e o controlo de orçamento interpolam entre cenários guardados; sem eles a página inicial não tem a
rede realista. Cada cenário demora 20 a 40 s, por isso corre fora do pedido, um de cada vez, e uma tranca consultiva
do Postgres evita que dois processos da API repitam o trabalho.
"""

import asyncio
import logging

from sqlalchemy import func, select, text

from novelo.core.database import SessionLocal, engine
from novelo.domain.vocab import ScenarioObjective
from novelo.features.planning import service
from novelo.features.planning.models import Scenario
from novelo.features.planning.schemas import ScenarioRequest
from novelo.features.users.models import User

log = logging.getLogger(__name__)

REFERENCE_BUDGETS_EUR = (20_000, 40_000, 60_000, 100_000, 150_000)
LOCK_KEY = 74_2026_21  # tranca consultiva (arbitrária, fixa)
LABEL_PREFIX = "Referência · locais reais"


def label_for(budget: int) -> str:
    return f"{LABEL_PREFIX} · {budget:,} €/ano".replace(",", " ")


async def seed_reference_scenarios() -> int:
    """Cria os cenários em falta; devolve quantos criou. Não faz nada se já há cenários por locais."""
    # A tranca é da ligação: fica numa ligação própria até ao fim (as sessões dos cenários usam outras).
    async with engine.connect() as lock:
        got = await lock.scalar(text("SELECT pg_try_advisory_lock(:k)"), {"k": LOCK_KEY})
        if not got:
            return 0
        try:
            return await _create_missing()
        finally:
            await lock.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": LOCK_KEY})


async def _create_missing() -> int:
    async with SessionLocal() as db:
        have = int(await db.scalar(select(func.count()).select_from(Scenario).where(Scenario.siting == "sites")) or 0)
        admin = (await db.execute(select(User).where(User.role == "admin").order_by(User.created_at))).scalars().first()
        if have or admin is None:
            return 0
        for budget in REFERENCE_BUDGETS_EUR:
            request = ScenarioRequest(
                label=label_for(budget),
                objective=ScenarioObjective.MAX_TONNES,
                budget_eur_year=float(budget),
                siting="sites",
            )
            await service.run_scenario(db, request, admin)
        return len(REFERENCE_BUDGETS_EUR)


async def seed_in_background() -> None:
    """Corre depois de a API arrancar; nunca derruba o arranque."""
    try:
        await asyncio.sleep(20)  # deixa o arranque e o seed dos dados terminarem
        created = await seed_reference_scenarios()
        if created:
            log.info("Cenários de referência por locais reais criados: %d", created)
    except asyncio.CancelledError:
        raise
    except Exception:
        log.exception("Não foi possível criar os cenários de referência")
