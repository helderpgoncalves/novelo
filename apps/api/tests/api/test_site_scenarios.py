"""Cenários por locais reais, sobre a amostra municipal (3 freguesias, 6 locais) feita à mão.

Candidatos: S1 e S2 (Aldão, a ~139 m um do outro), S3 (Azurém). Pontos de procura: os locais públicos S1, S2, S3 e
S6 (Lordelo, que não é candidato e não tem candidato na freguesia). Com raio de 300 m, S1 ou S2 serve Aldão todo.
"""

from collections.abc import Awaitable, Callable
from typing import Any

import httpx
import pytest

P = "/api/v1/planning"
MakeUser = Callable[..., Awaitable[httpx.AsyncClient]]


@pytest.fixture
async def operator(municipal: None, make_user: MakeUser) -> httpx.AsyncClient:
    return await make_user("operador@vitrus.pt", "operator")


async def run(operator: httpx.AsyncClient, **extra: Any) -> dict[str, Any]:
    body = {"label": "Por locais", "objective": "max_tonnes", "budget_eur_year": 5000, "siting": "sites", **extra}
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
