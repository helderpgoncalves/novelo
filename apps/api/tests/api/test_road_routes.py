"""Rotas por estrada nos cenários: km e traçado do router, estimativa se não responde, cache e dados antigos."""

from collections.abc import Awaitable, Callable, Sequence
from itertools import pairwise
from typing import Any

import httpx
import pytest

from novelo.domain.geo import haversine_km
from novelo.domain.routing import LatLon, RoadMatrix
from novelo.features.planning import site_service
from novelo.features.planning.schemas import RouteOut, ScenarioResult

P = "/api/v1/planning"
VEHICLE = 42_500 / 8
ROAD_FACTOR = 1.15  # a "estrada" do router falso: mais direta que o desvio por omissão (1,3)
MakeUser = Callable[..., Awaitable[httpx.AsyncClient]]


class FakeRoad:
    """Router falso: estrada = reta × 1,15 (assimétrica: a volta custa mais 10 m), traçado com um canto."""

    def __init__(self, fingerprint: str = "fake-1", *, up: bool = True) -> None:
        self._fingerprint, self.up = fingerprint, up
        self.matrix_calls = 0

    @property
    def fingerprint(self) -> str:
        return self._fingerprint if self.up else "estimate"

    def matrix(self, points: Sequence[LatLon]) -> RoadMatrix | None:
        self.matrix_calls += 1
        if not self.up:
            return None
        dist = [[0 if i == j else round(haversine_km(*a, *b) * ROAD_FACTOR * 1000) + (10 if i > j else 0)
                 for j, b in enumerate(points)] for i, a in enumerate(points)]  # fmt: skip
        return RoadMatrix(dist, [[d // 10 for d in row] for row in dist])

    def geometry(self, points: Sequence[LatLon]) -> list[LatLon] | None:
        if not self.up:
            return None
        out: list[LatLon] = [points[0]]
        for a, b in pairwise(points):
            out += [(a[0], b[1]), b]  # passa por um canto (traçado "em L")
        return out


@pytest.fixture
async def operator(municipal: None, make_user: MakeUser) -> httpx.AsyncClient:
    return await make_user("operador@vitrus.pt", "operator")


def use_road(monkeypatch: pytest.MonkeyPatch, road: FakeRoad | None) -> None:
    monkeypatch.setattr("novelo.features.planning.service.get_road_router", lambda: road)


async def run(operator: httpx.AsyncClient, **extra: Any) -> dict[str, Any]:
    body = {
        "label": "Por estrada",
        "objective": "max_tonnes",
        "budget_eur_year": 5000 + VEHICLE,
        "siting": "sites",
        "site_mode": "existing",
        "site_on_demand": False,
        **extra,
    }
    resp = await operator.post(f"{P}/scenarios", json=body)
    assert resp.status_code == 201, resp.text
    return resp.json()  # type: ignore[no-any-return]


async def test_without_a_router_everything_is_an_estimate(operator: httpx.AsyncClient) -> None:
    s = await run(operator)
    assert s["result"]["routing"] == "estimate"
    assert s["result"]["routes"] and all(
        r["source"] == "estimate" and not r["road_path"] and r["duration_min"] is None for r in s["result"]["routes"]
    )


async def test_site_routes_are_measured_on_the_road_and_traced(
    operator: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    site_service._cache.clear()
    estimate = await run(operator, label="estimativa")
    site_service._cache.clear()
    road = FakeRoad()
    use_road(monkeypatch, road)
    s = await run(operator, label="estrada")
    result = s["result"]
    assert result["routing"] == "road" and road.matrix_calls > 0
    assert result["routes"] and all(r["source"] == "road" and r["road_path"] for r in result["routes"])
    assert all(r["duration_min"] is not None and r["duration_min"] > 0 for r in result["routes"])
    for r in result["routes"]:
        assert len(r["path"]) > len(r["stops"]) + 2  # mais pontos do que as paragens: segue a estrada
        assert r["path"][0] == r["path"][-1] == result["depot"]
    # a estrada falsa (×1,15) é mais curta do que a estimativa (×1,3): os km descem na mesma proporção, ± as voltas
    assert 0 < s["result"]["kpis"]["km_year"] < estimate["result"]["kpis"]["km_year"]
    ratio = sum(r["km"] for r in result["routes"]) / sum(r["km"] for r in estimate["result"]["routes"])
    assert ratio == pytest.approx(ROAD_FACTOR / 1.3, abs=0.05)


async def test_the_road_result_is_stored_and_served_as_is(
    operator: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    site_service._cache.clear()
    use_road(monkeypatch, FakeRoad())
    created = await run(operator)
    again = (await operator.get(f"{P}/scenarios/{created['id']}")).json()
    assert again["result"]["routing"] == "road" and again["result"]["routes"] == created["result"]["routes"]


async def test_a_router_that_is_down_falls_back_to_the_estimate(
    operator: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    site_service._cache.clear()
    baseline = await run(operator, label="sem router")
    site_service._cache.clear()
    use_road(monkeypatch, FakeRoad(up=False))
    s = await run(operator, label="router em baixo")
    assert s["result"]["routing"] == "estimate"
    assert [r["km"] for r in s["result"]["routes"]] == [r["km"] for r in baseline["result"]["routes"]]


async def test_cache_is_keyed_by_the_road_data_and_skips_a_run_that_lost_the_router(
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
    road = FakeRoad("mapa-A")
    use_road(monkeypatch, road)
    await run(operator, label="1")
    await run(operator, label="2")  # mesmo pedido, mesmo mapa: cache
    assert calls == 1
    road._fingerprint = "mapa-B"  # dados novos do OpenStreetMap: já não vale o resultado anterior
    await run(operator, label="3")
    assert calls == 2
    use_road(monkeypatch, None)
    await run(operator, label="4")  # sem router é outra chave (estimativa)
    assert calls == 3

    # o router cai a meio do cálculo: o resultado é estimativa e não pode ficar guardado sob a chave "estrada"
    site_service._cache.clear()
    flaky = FakeRoad("mapa-C")
    real_matrix = flaky.matrix

    def dies_midway(points: Sequence[LatLon]) -> RoadMatrix | None:
        out = real_matrix(points)
        flaky.up = False
        return out

    flaky.matrix = dies_midway  # type: ignore[method-assign]
    use_road(monkeypatch, flaky)
    await run(operator, label="5")
    flaky.up = True
    flaky.matrix = real_matrix  # type: ignore[method-assign]
    s = await run(operator, label="6")
    assert s["result"]["routing"] == "road"  # recalculado, não servido da cache estimada


async def test_parish_scenarios_choose_and_route_on_the_road(
    logged_in: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    body = {"label": "freguesias", "objective": "max_tonnes", "budget_eur_year": 10_000_000}
    estimate = (await logged_in.post(f"{P}/scenarios", json=body)).json()
    road = FakeRoad()
    use_road(monkeypatch, road)
    s = (await logged_in.post(f"{P}/scenarios", json=body)).json()
    assert road.matrix_calls >= 2  # uma para as freguesias, outra por conjunto de paragens
    assert s["result"]["routing"] == "road"
    assert all(r["source"] == "road" and r["road_path"] for r in s["result"]["routes"])
    # o trajeto até às freguesias é mais curto por estrada (×1,15) do que pela estimativa (×1,3): custo de km menor
    assert s["result"]["kpis"]["km_year"] < estimate["result"]["kpis"]["km_year"]


def test_scenarios_stored_before_road_routes_still_load() -> None:
    old = ScenarioResult.model_validate(
        {
            "kpis": {
                "capex_eur": 0, "opex_eur_year": 0, "annual_cost_eur": 0, "tonnes_year": 0, "eur_per_tonne": None,
                "coverage_pct": 0, "points": 0, "km_year": 0, "potential_t": 0, "baseline_observed_t": 0,
            },
            "allocations": [],
            "routes": [
                {"mode": "existing", "vehicle": 1, "stops": [], "km": 3.0, "load_t": 1.0, "path": [[41.4, -8.3]]}
            ],
            "modes": [],
            "depot": [41.4, -8.3],
        }
    )  # fmt: skip
    route: RouteOut = old.routes[0]
    assert (
        old.routing == "estimate" and route.source == "estimate" and not route.road_path and route.duration_min is None
    )
