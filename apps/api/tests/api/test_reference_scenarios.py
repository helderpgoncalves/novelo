"""Cenários de referência: marcados, recalculados quando estão desatualizados e nunca à custa dos utilizadores."""

import uuid
from decimal import Decimal
from typing import Any

import httpx
import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from novelo.domain.vocab import ScenarioObjective, ScenarioStatus
from novelo.features.planning import reference, service
from novelo.features.planning.models import Scenario
from novelo.features.planning.schemas import ScenarioRequest
from novelo.features.users import service as users
from novelo.features.users.models import User
from tests.conftest import PASSWORD, TEST_DB

P = "/api/v1/planning"


def _row(
    label: str,
    author: User,
    *,
    budget: int = 20_000,
    siting: str = "sites",
    key: str | None = None,
    version: int | None = None,
    params_version: int = 1,
    plan: bool = True,
    site_mode: str = "existing",
    parent: uuid.UUID | None = None,
) -> Scenario:
    result: dict[str, Any] = {"collection_plan": [] if plan else None}
    if siting == "sites":
        result["siting"] = {"site_mode": site_mode}
    return Scenario(
        label=label, objective=ScenarioObjective.MAX_TONNES, budget_eur_year=Decimal(budget),
        status=ScenarioStatus.COMPUTED, solver_status="optimal", params={}, parameter_set_version=params_version,
        constraints={}, result=result,
        tonnes_year=Decimal(1), capex_eur=Decimal(0), annual_cost_eur=Decimal(budget), coverage_pct=Decimal(1),
        siting=siting, created_by_id=author.id, reference_key=key, reference_version=version, parent_id=parent,
    )  # fmt: skip


@pytest.fixture
async def fake_solver(session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Troca o otimizador (20 a 40 s por cenário por locais) por uma linha mínima, com plano e com a versão atual."""
    calls: list[str] = []
    version = (await service.ensure_default_parameters(session)).version

    async def run(
        db: AsyncSession, request: ScenarioRequest, user: User, *, reference_key: str | None = None,
        reference_version: int | None = None,
    ) -> Any:  # fmt: skip
        calls.append(reference_key or "")
        row = _row(
            request.label, user, budget=int(request.budget_eur_year or 0), siting=request.siting, key=reference_key,
            version=reference_version, params_version=version,
        )  # fmt: skip
        db.add(row)
        await db.commit()
        return row

    monkeypatch.setattr(service, "run_scenario", run)
    return calls


async def _admin(session: AsyncSession) -> User:
    return await users.create_user(session, email="boss@x.pt", password=PASSWORD, role="admin", email_verified=True)


def test_labels_keys_and_staleness_rules() -> None:
    assert reference.label_for(60_000) == "Referência · locais reais · 60 000 €/ano"
    assert [s.key for s in reference.SPECS] == [
        "sites:20000", "sites:40000", "sites:60000", "sites:100000", "sites:150000", "parish:60000",
    ]  # fmt: skip
    assert reference.SPECS[-1].label == "Referência · por freguesia · 60 000 €/ano"
    assert reference.ONBOARDING_KEY == "parish:60000"
    assert reference.legacy_key("Referência · locais reais · 150 000 €/ano", "sites") == "sites:150000"
    assert reference.legacy_key("Referência · locais reais · 150 000 €/ano", "parish") is None
    assert reference.legacy_key("Referência · locais reais · 70 000 €/ano", "sites") is None  # não é dos nossos
    assert reference.legacy_key("A minha Referência · locais reais · 20 000 €/ano", "sites") is None
    v = reference.REFERENCE_MODEL_VERSION
    assert reference.stale_reasons(v, 3, 3, True, "existing") == []
    assert reference.stale_reasons(None, 2, 3, False, "street") == [
        "model_version", "parameters", "no_collection_plan", "street",
    ]  # fmt: skip


async def test_refresh_replaces_stale_references_and_keeps_user_scenarios(
    session: AsyncSession, fake_solver: list[str]
) -> None:
    admin = await _admin(session)
    operator = await users.create_user(session, email="op@x.pt", password=PASSWORD)
    version = (await service.ensure_default_parameters(session)).version
    legacy = _row(reference.label_for(20_000), admin, plan=False, site_mode="street")  # modelo antigo, sem marca
    fresh = _row(
        reference.label_for(40_000), admin, budget=40_000, key="sites:40000", version=2, params_version=version
    )
    street = _row(
        reference.label_for(60_000), admin, budget=60_000, key="sites:60000", version=2, params_version=version,
        site_mode="street",
    )  # fmt: skip
    mine = _row(reference.label_for(20_000), operator)  # o mesmo rótulo, mas de um utilizador
    child = _row("Variação do antigo", operator)
    session.add_all([legacy, fresh, street, mine])
    await session.flush()
    child.parent_id = legacy.id
    session.add(child)
    await session.commit()

    out = await reference.refresh(session)
    assert (out.adopted, out.created, out.deleted) == (1, 5, 2)  # 40 000 já estava em dia
    assert sorted(fake_solver) == ["parish:60000", "sites:100000", "sites:150000", "sites:20000", "sites:60000"]
    ids = set((await session.execute(select(Scenario.id))).scalars())
    assert fresh.id in ids and mine.id in ids and child.id in ids
    assert legacy.id not in ids and street.id not in ids
    await session.refresh(child)
    assert child.parent_id is None and mine.reference_key is None

    again = await reference.refresh(session)  # idempotente
    assert (again.created, again.deleted) == (0, 0)

    params = await service.get_parameters(session)
    await service.update_parameters(session, params.values, admin)  # pressupostos novos: tudo desatualizado
    fake_solver.clear()
    bumped = await reference.refresh(session)
    assert (bumped.created, bumped.deleted) == (6, 6) and len(fake_solver) == 6
    keys = sorted(
        (await session.execute(select(Scenario.reference_key).where(Scenario.reference_key.is_not(None)))).scalars()
    )
    assert keys == sorted(s.key for s in reference.SPECS)


async def test_refresh_needs_an_admin(session: AsyncSession, fake_solver: list[str]) -> None:
    assert (await reference.refresh(session)).created == 0 and fake_solver == []


async def test_lock_held_elsewhere_skips(session: AsyncSession, fake_solver: list[str]) -> None:
    engine = create_async_engine(TEST_DB)
    try:
        async with engine.connect() as other:
            assert await other.scalar(text("SELECT pg_try_advisory_lock(:k)"), {"k": reference.LOCK_KEY})
            outcome = await reference.seed_reference_scenarios(engine, async_sessionmaker(engine))
            assert outcome is None and fake_solver == []
            await other.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": reference.LOCK_KEY})
    finally:
        await engine.dispose()


async def test_reference_endpoint_lists_current_with_onboarding(
    client: httpx.AsyncClient, session: AsyncSession, fake_solver: list[str]
) -> None:
    admin = await _admin(session)
    await client.post("/api/v1/auth/login", json={"email": "boss@x.pt", "password": PASSWORD})
    assert (await client.get(f"{P}/scenarios/reference")).json() == []
    version = (await service.ensure_default_parameters(session)).version
    stale = _row(reference.label_for(20_000), admin, key="sites:20000", version=1, params_version=version)
    session.add(stale)
    await session.commit()
    [only] = (await client.get(f"{P}/scenarios/reference")).json()
    assert only["id"] == str(stale.id) and only["up_to_date"] is False
    assert only["stale_reasons"] == ["model_version"] and only["onboarding"] is False

    await reference.refresh(session)
    body = (await client.get(f"{P}/scenarios/reference")).json()
    assert [b["reference_key"] for b in body] == [s.key for s in reference.SPECS]
    assert all(b["up_to_date"] and b["stale_reasons"] == [] for b in body)
    assert [b["reference_key"] for b in body if b["onboarding"]] == ["parish:60000"]
    listed = {s["id"]: s["reference_key"] for s in (await client.get(f"{P}/scenarios")).json()}
    assert set(listed.values()) == {s.key for s in reference.SPECS}


async def test_parish_reference_runs_the_real_model(session: AsyncSession) -> None:
    """O cenário por freguesia do ecrã inicial sai do otimizador real com o plano de recolha porta a porta."""
    await _admin(session)
    spec = next(s for s in reference.SPECS if s.key == reference.ONBOARDING_KEY)
    out = await reference.refresh(session, [spec])
    assert out.created == 1
    [ref] = await reference.list_references(session)
    assert ref.reference_key == "parish:60000" and ref.up_to_date and ref.onboarding
    assert ref.label == "Referência · por freguesia · 60 000 €/ano" and ref.annual_cost_eur <= 60_000 + 1
    full = await service.get_scenario(session, ref.id)
    assert full.result.collection_plan and any(e.channel == "door_to_door" for e in full.result.collection_plan)
