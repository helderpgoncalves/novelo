"""Cenários por locais reais, sobre a amostra municipal (3 freguesias, 6 locais) feita à mão.

Candidatos: S1 e S2 (Aldão, a ~139 m um do outro), S3 (Azurém). Pontos de procura: os locais públicos S1, S2, S3 e
S6 (Lordelo, que não é candidato e não tem candidato na freguesia). Com raio de 300 m, S1 ou S2 serve Aldão todo.
"""

from collections.abc import Awaitable, Callable
from typing import Any

import httpx
import pytest
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.features.municipal.models import MunicipalSite
from novelo.features.planning import site_service

P = "/api/v1/planning"
MakeUser = Callable[..., Awaitable[httpx.AsyncClient]]


@pytest.fixture
async def operator(municipal: None, make_user: MakeUser) -> httpx.AsyncClient:
    return await make_user("operador@vitrus.pt", "operator")


async def run(operator: httpx.AsyncClient, **extra: Any) -> dict[str, Any]:
    body = {
        "label": "Por locais",
        "objective": "max_tonnes",
        "budget_eur_year": 5000,
        "siting": "sites",
        "site_mode": "existing",
        "site_on_demand": False,
        **extra,
    }
    resp = await operator.post(f"{P}/scenarios", json=body)
    assert resp.status_code == 201, resp.text
    return resp.json()  # type: ignore[no-any-return]


async def test_opens_one_site_per_parish_that_can_be_served(operator: httpx.AsyncClient) -> None:
    s = await run(operator)
    sites = s["result"]["sites"]
    # S1 e S2 servem o mesmo ponto: basta um (o mais barato a igualdade de toneladas); S3 serve Azurém
    assert len(sites) == 2
    assert {x["parish_code"] for x in sites} == {"030801", "030804"}
    assert s["result"]["siting"]["candidates"] == 3
    assert s["result"]["siting"]["demand_points"] == 4
    assert s["result"]["siting"]["served_points"] == 3  # S6 (Lordelo) fica sem local ao alcance


async def test_tonnes_are_the_served_share_of_the_parish_demand(operator: httpx.AsyncClient) -> None:
    s = await run(operator)
    alloc = {a["parish_code"]: a for a in s["result"]["allocations"]}
    capture = s["params"]["modes"]["existing"]["capture_rate"]
    for code in ("030801", "030804"):
        assert alloc[code]["tonnes"] == pytest.approx(alloc[code]["demand_t"] * capture, abs=0.002)
        assert alloc[code]["covered_population"] == pytest.approx(alloc[code]["population"], abs=1)
    assert alloc["030828"]["tonnes"] == 0 and alloc["030828"]["covered_population"] == 0
    k = s["result"]["kpis"]
    assert k["points"] == 2 and k["tonnes_year"] == pytest.approx(
        sum(x["tonnes"] for x in s["result"]["sites"]), abs=0.002
    )
    assert k["annual_cost_eur"] <= 5000


async def test_routes_visit_the_opened_sites(operator: httpx.AsyncClient) -> None:
    s = await run(operator)
    stops = [st for r in s["result"]["routes"] for st in r["stops"]]
    assert sorted(st["site_id"] for st in stops) == sorted(x["site_id"] for x in s["result"]["sites"])
    assert all(x["vehicle"] is not None for x in s["result"]["sites"])


async def test_too_small_a_budget_opens_nothing(operator: httpx.AsyncClient) -> None:
    s = await run(operator, budget_eur_year=10)
    assert s["status"] == "infeasible" and s["result"]["sites"] == []


async def test_a_constraint_removes_a_parishs_sites(operator: httpx.AsyncClient) -> None:
    s = await run(operator, constraints={"030804": ["on_demand"]})
    assert {x["parish_code"] for x in s["result"]["sites"]} == {"030801"}


async def test_on_demand_is_not_a_site_mode(operator: httpx.AsyncClient) -> None:
    resp = await operator.post(
        f"{P}/scenarios",
        json={
            "label": "x",
            "objective": "max_tonnes",
            "budget_eur_year": 100,
            "siting": "sites",
            "site_mode": "on_demand",
        },
    )
    assert resp.status_code == 422


async def test_the_default_is_still_the_parish_model(operator: httpx.AsyncClient) -> None:
    resp = await operator.post(
        f"{P}/scenarios", json={"label": "Freguesias", "objective": "max_tonnes", "budget_eur_year": 60000}
    )
    assert resp.status_code == 201
    assert resp.json()["result"]["sites"] == [] and resp.json()["result"]["siting"] is None


async def test_the_list_tells_site_scenarios_apart(operator: httpx.AsyncClient) -> None:
    await run(operator)
    listed = (await operator.get(f"{P}/scenarios")).json()
    assert [s["siting"] for s in listed] == ["sites"]


async def test_on_demand_completes_the_site_network(operator: httpx.AsyncClient) -> None:
    sites_only = await run(operator)
    hybrid = await run(operator, site_on_demand=True, budget_eur_year=20000, label="Locais e a pedido")
    r = hybrid["result"]
    assert r["siting"]["on_demand"] is True and r["siting"]["on_demand_zones"] > 0
    # a recolha a pedido só acrescenta têxtil (os canais captam de forma independente) dentro do mesmo orçamento
    assert hybrid["tonnes_year"] > sites_only["tonnes_year"]
    assert hybrid["annual_cost_eur"] <= 20000
    modes = {m["mode"] for m in r["modes"]}
    assert modes == {"existing", "on_demand"}
    alloc = {a["parish_code"]: a for a in r["allocations"]}
    # Lordelo não tem local ao alcance, mas a recolha a pedido chega lá
    assert alloc["030828"]["tonnes"] > 0 and alloc["030828"]["modes"] == ["on_demand"]
    assert sum(a["tonnes"] for a in r["allocations"]) == pytest.approx(r["kpis"]["tonnes_year"], abs=0.01)


async def test_the_decision_room_frontier_prefers_site_scenarios(operator: httpx.AsyncClient) -> None:
    parish = (
        await operator.post(
            f"{P}/scenarios", json={"label": "Freguesias", "objective": "max_tonnes", "budget_eur_year": 5000}
        )
    ).json()
    await run(operator, label="Locais 1", budget_eur_year=2000)
    before = (await operator.get("/api/v1/textile/overview")).json()["scenario_frontier"]
    assert parish["id"] in {p["id"] for p in before}  # com um só cenário por locais, vale tudo
    await run(operator, label="Locais 2", budget_eur_year=4000)
    after = (await operator.get("/api/v1/textile/overview")).json()["scenario_frontier"]
    assert {p["label"] for p in after} == {"Locais 1", "Locais 2"}


async def test_the_default_point_is_an_existing_place_without_a_new_container(operator: httpx.AsyncClient) -> None:
    """A Vitrus não tem contentores de têxtil: por omissão os locais são paragens onde a viatura já passa."""
    resp = await operator.post(
        f"{P}/scenarios",
        json={
            "label": "Local existente",
            "objective": "max_tonnes",
            "budget_eur_year": 5000,
            "siting": "sites",
            "site_on_demand": False,
        },
    )
    assert resp.status_code == 201
    out = resp.json()
    assert out["result"]["siting"]["site_mode"] == "existing"
    assert {m["mode"] for m in out["result"]["modes"]} == {"existing"}
    alloc = {a["parish_code"]: a for a in out["result"]["allocations"]}
    capture = out["params"]["modes"]["existing"]["capture_rate"]
    assert alloc["030801"]["tonnes"] == pytest.approx(alloc["030801"]["demand_t"] * capture, abs=0.002)


async def test_street_sites_only_when_asked_as_a_reference(operator: httpx.AsyncClient) -> None:
    s = await run(operator, site_mode="street")
    assert s["result"]["siting"]["site_mode"] == "street"
    alloc = {a["parish_code"]: a for a in s["result"]["allocations"]}
    capture = s["params"]["modes"]["street"]["capture_rate"]
    assert alloc["030801"]["tonnes"] == pytest.approx(alloc["030801"]["demand_t"] * capture, abs=0.002)


async def test_sensitivity_reproduces_the_site_scenario(operator: httpx.AsyncClient) -> None:
    s = await run(operator, site_on_demand=True, budget_eur_year=20000)
    resp = await operator.post(f"{P}/scenarios/{s['id']}/sensitivity", json={})
    assert resp.status_code == 200, resp.text
    out = resp.json()
    # com os pressupostos centrais a reavaliação reproduz os KPIs gravados
    assert out["base"]["tonnes"] == pytest.approx(s["tonnes_year"], rel=0.005)
    assert out["base"]["annual_cost_eur"] == pytest.approx(s["annual_cost_eur"], rel=0.01)
    assert out["eur_per_tonne"]["p10"] < out["eur_per_tonne"]["p50"] < out["eur_per_tonne"]["p90"]
    keys = {b["key"] for b in out["tornado"]}
    assert "modes.existing.capture_rate" in keys and "modes.on_demand.capture_rate" in keys
    assert "modes.existing.people_per_point" not in keys


async def test_robustness_compares_a_site_scenario_with_a_parish_one(operator: httpx.AsyncClient) -> None:
    a = await run(operator, label="Locais", budget_eur_year=20000)
    b = (
        await operator.post(
            f"{P}/scenarios", json={"label": "Freguesias", "objective": "max_tonnes", "budget_eur_year": 20000}
        )
    ).json()
    resp = await operator.get(f"{P}/compare-robustness", params={"recommended_id": a["id"], "alternative_id": b["id"]})
    assert resp.status_code == 200, resp.text


async def test_the_same_request_is_served_from_the_cache(
    operator: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    site_service._cache.clear()
    calls = 0
    real = site_service._compute_sites

    def counting(*args: Any) -> Any:
        nonlocal calls
        calls += 1
        return real(*args)

    monkeypatch.setattr(site_service, "_compute_sites", counting)
    first = await run(operator, label="A")
    second = await run(operator, label="B")  # só o nome muda
    await run(operator, label="C", budget_eur_year=4000)  # outro orçamento: volta a calcular
    assert calls == 2
    assert first["id"] != second["id"] and first["result"] == second["result"]


# --- Pontos assistidos (escolas) e procura pela capacidade ---------------------------------------------------------


@pytest.fixture
async def school(operator: httpx.AsyncClient, session: AsyncSession) -> httpx.AsyncClient:
    """O produtor S0000004d (Azurém, a ~140 m de S3) passa a escola: um ponto assistido candidato."""
    await session.execute(
        update(MunicipalSite).where(MunicipalSite.site_id == "S0000004d").values(producer_type_keys=["school"])
    )
    await session.flush()
    return operator


async def test_staffed_points_are_schools_with_people_and_no_street_container(school: httpx.AsyncClient) -> None:
    s = await run(school, site_candidates="staffed")
    siting = s["result"]["siting"]
    assert (siting["site_candidates"], siting["candidates"], siting["staffed_candidates"]) == ("staffed", 1, 1)
    (site,) = s["result"]["sites"]
    assert (site["site_id"], site["kind"], site["producer_types"]) == ("S0000004d", "staffed", ["school"])
    assert "producer_names" not in site  # nomes de produtores nunca saem num cenário
    # a escola serve o ponto de procura S3 (Azurém); Aldão fica sem local ao alcance
    alloc = {a["parish_code"]: a for a in s["result"]["allocations"]}
    assert alloc["030804"]["tonnes"] > 0 and alloc["030801"]["tonnes"] == 0


async def test_both_candidate_sets_are_the_default(school: httpx.AsyncClient) -> None:
    s = await run(school)
    assert s["result"]["siting"]["site_candidates"] == "both"
    assert (s["result"]["siting"]["candidates"], s["result"]["siting"]["staffed_candidates"]) == (4, 1)
    public = await run(school, site_candidates="public", label="Só públicos")
    assert public["result"]["siting"]["candidates"] == 3 and public["result"]["siting"]["staffed_candidates"] == 0


async def test_street_reference_uses_only_public_places(operator: httpx.AsyncClient) -> None:
    s = await run(operator, site_mode="street")
    assert s["result"]["siting"]["site_candidates"] == "public"
    body = {"label": "x", "objective": "max_tonnes", "budget_eur_year": 100, "siting": "sites"}
    resp = await operator.post(f"{P}/scenarios", json={**body, "site_mode": "street", "site_candidates": "staffed"})
    assert resp.status_code == 422


async def test_demand_splits_by_container_capacity(operator: httpx.AsyncClient) -> None:
    # 100 m: S1 e S2 (Aldão, a ~139 m) servem só o próprio ponto. Aldão tem 6 100 L em S1 e 1 100 L em S2, por isso
    # S1 leva 6 100 / 7 200 = 84,72% do têxtil captado em Aldão e S2 15,28% (pela contagem seriam 2/3 e 1/3).
    s = await run(operator, site_radius_m=100)
    tonnes = {x["site_id"]: x["tonnes"] for x in s["result"]["sites"]}
    alloc = {a["parish_code"]: a for a in s["result"]["allocations"]}
    captured = alloc["030801"]["tonnes"]
    assert tonnes["S0000001a"] == pytest.approx(captured * 6100 / 7200, abs=0.002)
    assert tonnes["S0000002b"] == pytest.approx(captured * 1100 / 7200, abs=0.002)
    assert "capacidade" in s["result"]["siting"]["population_proxy"]
