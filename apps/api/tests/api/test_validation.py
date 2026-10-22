"""Validação do modelo: leituras do potencial e validação cruzada espacial."""

from collections import defaultdict
from collections.abc import Awaitable, Callable

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.domain.validation import pearson
from novelo.features.municipal.models import MunicipalSite
from novelo.features.network.models import Parish
from novelo.features.planning import site_service

V = "/api/v1/validation"
MakeUser = Callable[..., Awaitable[httpx.AsyncClient]]


async def test_requires_a_session(client: httpx.AsyncClient) -> None:
    resp = await client.get(f"{V}/model")
    assert resp.status_code == 401


async def test_readings_are_computed_from_the_cited_sources(client: httpx.AsyncClient, make_user: MakeUser) -> None:
    operator = await make_user("operador@vitrus.pt", "operator")
    body = (await operator.get(f"{V}/model")).json()

    by_key = {r["key"]: r for r in body["readings"]}
    # base do modelo (Vitrus + APA): 51 250,6 t × 5,86% = 3 003 285 kg ÷ 156 830 hab = 19,15 kg/hab/ano no lixo;
    # gerado = 3 003,285 + 301,265 = 3 304,55 t; captura 301,265 ÷ 3 304,55 = 9,1%
    base = by_key["vitrus_apa_share_of_rsu"]
    assert (base["kg_per_inhab_year"], base["basis"], base["is_model_base"]) == (19.15, "residual", True)
    assert base["implied_capture_pct"] == pytest.approx(9.1) and base["implied_potential_t"] == pytest.approx(3304.6)
    assert "APA" in base["source"] and "51 250,6" in base["source"]
    # leituras publicadas: 315 × 5,4% = 17,01 (no lixo); 517 × 4,55% = 23,52; 0,7 × 12 = 8,4 (alternativa)
    assert by_key["plan_share_of_residual"]["kg_per_inhab_year"] == pytest.approx(17.01)
    assert by_key["plan_share_of_residual"]["implied_capture_pct"] == pytest.approx(10.1)  # 301,265 ÷ 2 968,9
    assert by_key["pt_composition"]["kg_per_inhab_year"] == pytest.approx(23.52)
    assert by_key["plan_per_capita"]["kg_per_inhab_year"] == 8.4
    assert [r["is_model_base"] for r in body["readings"]] == [True, False, False, False]
    assert {k for k, r in by_key.items() if r["is_alternative"]} == {"plan_per_capita", "plan_share_of_residual"}
    assert "não usada pela Vitrus" in by_key["plan_per_capita"]["source"]
    # na mesma base, leituras maiores do potencial implicam sempre captura menor
    for basis in ("residual", "generated"):
        same = sorted((r for r in body["readings"] if r["basis"] == basis), key=lambda r: r["kg_per_inhab_year"])
        captures = [r["implied_capture_pct"] for r in same]
        assert captures == sorted(captures, reverse=True)
    # França: 4,27 ÷ 21,07 (gerado por habitante e ano na base do modelo: 3 304 550 kg ÷ 156 830) = 20,3%
    assert body["france"]["capture_of_model_base_pct"] == pytest.approx(20.3)
    assert "no_time_series" in body["cannot_test"]


async def test_spatial_check_needs_at_least_four_parishes(
    client: httpx.AsyncClient, make_user: MakeUser, municipal: None
) -> None:
    operator = await make_user("operador@vitrus.pt", "operator")
    body = (await operator.get(f"{V}/model")).json()
    # a amostra municipal de teste tem 3 freguesias: não se finge uma validação
    assert body["spatial"] == []


async def test_demand_weight_by_capacity_follows_population_better_than_by_count(session: AsyncSession) -> None:
    """1c: a procura por local reparte-se pela capacidade (litros), porque segue melhor a população por freguesia.

    Nos 1 574 pontos de procura (locais públicos com contentores), por freguesia: R² população × litros ≈ 0,80;
    população × número de contentores ≈ 0,64 (todos os contentores: 0,76, o valor do ecrã «Validação»).
    """
    inputs = await site_service.load_site_inputs(session)
    counts = {k: v for k, v in await session.execute(select(MunicipalSite.site_id, MunicipalSite.containers))}
    litres: dict[str, float] = defaultdict(float)
    n: dict[str, float] = defaultdict(float)
    for d in inputs.demand:
        litres[d.zone_id] += d.weight
        n[d.zone_id] += counts[d.id]
    pop = {k: v for k, v in await session.execute(select(Parish.dicofre, Parish.population))}
    codes = sorted(c for c in litres if pop.get(c))
    x = [float(pop[c] or 0) for c in codes]
    r2_capacity = pearson(x, [litres[c] for c in codes]) ** 2
    r2_count = pearson(x, [n[c] for c in codes]) ** 2
    assert len(inputs.demand) == 1574 and len(codes) == 48
    assert r2_capacity == pytest.approx(0.80, abs=0.01)
    assert r2_count == pytest.approx(0.64, abs=0.01)
    assert r2_capacity > r2_count
