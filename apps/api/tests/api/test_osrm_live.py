"""Integração com o OSRM a sério (`just osrm-test`): só corre com OSRM_TEST_URL. Verifica plausibilidade."""

import os
from collections.abc import Awaitable, Callable
from typing import Any

import httpx
import pytest

from novelo.adapters.osrm import OsrmClient, ResilientRouter
from novelo.domain.geo import haversine_km
from novelo.features.planning import assumptions as a
from novelo.features.planning import site_service

URL = os.environ.get("OSRM_TEST_URL")
pytestmark = pytest.mark.skipif(not URL, reason="defina OSRM_TEST_URL (just osrm-test)")

P = "/api/v1/planning"
DEPOT = (a.DEPOT_LAT, a.DEPOT_LON)
# Caixa de Guimarães e arredores usada no recorte do OSRM (apps/osrm/Dockerfile)
LAT_MIN, LON_MIN, LAT_MAX, LON_MAX = 41.26, -8.60, 41.66, -8.00
MakeUser = Callable[..., Awaitable[httpx.AsyncClient]]


@pytest.fixture
def router(monkeypatch: pytest.MonkeyPatch) -> ResilientRouter:
    assert URL
    r = ResilientRouter(OsrmClient(URL, timeout_s=30))
    monkeypatch.setattr("novelo.features.planning.service.get_road_router", lambda: r)
    return r


def test_the_table_is_plausible_for_real_places(router: ResilientRouter) -> None:
    centre = (41.4425, -8.2918)  # centro de Guimarães
    m = router.matrix([DEPOT, centre])
    assert m is not None and m.distance_m[0][1] and m.duration_s[0][1]
    straight = haversine_km(*DEPOT, *centre)
    assert straight < m.distance_m[0][1] / 1000 < straight * 3  # a estrada é mais longa que a reta, sem exagero
    speed = m.distance_m[0][1] / 1000 / (m.duration_s[0][1] / 3600)
    assert 10 < speed < 90
    assert router.fingerprint.startswith("osrm:")


def test_the_geometry_starts_and_ends_at_the_stops_and_stays_in_the_area(router: ResilientRouter) -> None:
    stops = [DEPOT, (41.4425, -8.2918), (41.4800, -8.3510), DEPOT]
    path = router.geometry(stops)
    assert path is not None and len(path) > len(stops) * 5  # segue curvas, não são 4 pontos
    assert haversine_km(*path[0], *stops[0]) < 0.3 and haversine_km(*path[-1], *stops[-1]) < 0.3
    assert all(LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX for lat, lon in path)


@pytest.fixture
async def operator(municipal: None, make_user: MakeUser) -> httpx.AsyncClient:
    return await make_user("operador@vitrus.pt", "operator")


async def test_a_site_scenario_is_routed_on_real_roads(operator: httpx.AsyncClient, router: ResilientRouter) -> None:
    site_service._cache.clear()
    body: dict[str, Any] = {
        "label": "OSRM a sério",
        "objective": "max_tonnes",
        "budget_eur_year": 5000 + 42_500 / 8,
        "siting": "sites",
        "site_mode": "existing",
        "site_on_demand": False,
    }
    resp = await operator.post(f"{P}/scenarios", json=body)
    assert resp.status_code == 201, resp.text
    result = resp.json()["result"]
    assert result["routing"] == "road" and result["routes"]
    for r in result["routes"]:
        assert r["source"] == "road" and r["road_path"] and r["duration_min"] > 0
        straight = sum(
            haversine_km(*a_, *b_) for a_, b_ in zip(r["path"], r["path"][1:], strict=False)
        )  # o traçado tem pelo menos a extensão da linha reta entre os seus pontos
        assert r["km"] >= 0.5 * straight


async def test_a_parish_scenario_is_routed_on_real_roads(logged_in: httpx.AsyncClient, router: ResilientRouter) -> None:
    resp = await logged_in.post(
        f"{P}/scenarios", json={"label": "OSRM freguesias", "objective": "max_tonnes", "budget_eur_year": 10_000_000}
    )
    assert resp.status_code == 201, resp.text
    result = resp.json()["result"]
    assert result["routing"] == "road" and all(r["road_path"] for r in result["routes"])
    for r in result["routes"]:
        assert r["km"] > 0 and r["load_t"] <= 4.0 + 1e-6  # carga útil da viatura por omissão
