"""Rotas por estrada no domínio: matriz com estimativa, VRP sobre estradas, traçado e zonas. Valores à mão."""

import math
from collections.abc import Sequence
from itertools import pairwise

import pytest

from novelo.domain.geo import haversine_km, simplify_polyline
from novelo.domain.network import Stop, Zone, plan_routes, radial_km, with_road_distances
from novelo.domain.routing import LatLon, RoadMatrix, estimate_leg, overall_source, resolve
from tests.unit.test_network import DEPOT, params

A: LatLon = (41.4425, -8.2918)
B: LatLon = (41.4525, -8.2918)  # ~1,112 km a norte
C: LatLon = (41.4425, -8.2718)  # ~1,67 km a este


class FakeRoad:
    """Router falso: distâncias de uma tabela por par de pontos (m), 60 s por km, traçado com um ponto intermédio."""

    fingerprint = "fake"

    def __init__(self, meters: dict[tuple[LatLon, LatLon], int | None], *, geometry: bool = True) -> None:
        self.meters, self.with_geometry = meters, geometry
        self.matrix_calls: list[list[LatLon]] = []
        self.geometry_calls: list[list[LatLon]] = []

    def matrix(self, points: Sequence[LatLon]) -> RoadMatrix | None:
        self.matrix_calls.append(list(points))
        dist = [[0 if a == b else self.meters.get((a, b)) for b in points] for a in points]
        dur = [[None if d is None else d * 60 // 1000 for d in row] for row in dist]
        return RoadMatrix(dist, dur)

    def geometry(self, points: Sequence[LatLon]) -> list[LatLon] | None:
        self.geometry_calls.append(list(points))
        if not self.with_geometry:
            return None
        path: list[LatLon] = []
        for a, b in pairwise(points):
            path += [a, ((a[0] + b[0]) / 2 + 0.001, (a[1] + b[1]) / 2)]  # um desvio de ~111 m a norte no meio
        return [*path, points[-1]]


def symmetric(table: dict[tuple[LatLon, LatLon], int | None]) -> dict[tuple[LatLon, LatLon], int | None]:
    return {**table, **{(b, a): d for (a, b), d in table.items()}}


def test_estimate_leg_is_straight_line_times_detour_at_vehicle_speed() -> None:
    metres, seconds = estimate_leg(A, B, 1.3, 30.0)
    km = haversine_km(*A, *B) * 1.3
    assert metres == round(km * 1000) and seconds == round(km / 30 * 3600)
    assert metres == pytest.approx(1445, abs=1)  # 1,1119 km · 1,3
    assert estimate_leg(A, B, 1.3, 0.0)[1] == 0  # sem velocidade não há tempo (nunca divide por zero)


def test_resolve_without_road_estimates_every_pair_and_marks_none_exact_but_the_diagonal() -> None:
    m = resolve([A, B], None, 1.3, 30.0)
    assert m.distance_m[0][0] == 0 and m.exact[0][0] and m.exact[1][1]
    assert m.distance_m[0][1] == estimate_leg(A, B, 1.3, 30.0)[0] and not m.exact[0][1] and not m.exact[1][0]


def test_resolve_keeps_the_road_and_falls_back_only_where_there_is_no_path() -> None:
    road = RoadMatrix([[0, 1500, None], [1700, 0, 900], [None, 800, 0]], [[0, 120, None], [140, 0, 70], [None, 65, 0]])
    m = resolve([A, B, C], road, 1.3, 30.0)
    assert (m.distance_m[0][1], m.duration_s[0][1], m.exact[0][1]) == (1500, 120, True)  # assimétrica: sentido único
    assert (m.distance_m[1][0], m.duration_s[1][0]) == (1700, 140)
    assert not m.exact[0][2] and m.distance_m[0][2] == estimate_leg(A, C, 1.3, 30.0)[0]
    assert m.arcs_exact([1, 2, 1]) and not m.arcs_exact([0, 2])
    assert m.length_m([0, 1, 2]) == 1500 + 900 and m.duration_of_s([0, 1, 2]) == 120 + 70


def test_resolve_rejects_a_matrix_of_the_wrong_size() -> None:
    with pytest.raises(ValueError, match="2 linhas"):
        resolve([A, B, C], RoadMatrix([[0, 1], [1, 0]], [[0, 1], [1, 0]]), 1.3, 30.0)


def test_overall_source() -> None:
    assert overall_source([]) == "estimate"
    assert overall_source(["estimate", "estimate"]) == "estimate"
    assert overall_source(["road", "road"]) == "road"
    assert overall_source(["road", "estimate"]) == "mixed"


# --- Douglas-Peucker -----------------------------------------------------------------------------------------------


def test_simplify_drops_collinear_points_and_keeps_the_ends() -> None:
    line = [(41.0 + i * 0.001, -8.0) for i in range(11)]
    assert simplify_polyline(line, 1.0) == [line[0], line[-1]]


def test_simplify_keeps_a_corner_beyond_the_tolerance_and_drops_it_within() -> None:
    # 0,001° de latitude ≈ 111 m: o canto a 111 m da reta fica com tolerância de 50 m e cai com 200 m
    corner = [(41.0, -8.0), (41.001, -7.999), (41.0, -7.998)]
    assert simplify_polyline(corner, 50.0) == corner
    assert simplify_polyline(corner, 200.0) == [corner[0], corner[-1]]


def test_simplify_edge_cases() -> None:
    assert simplify_polyline([], 5.0) == [] and simplify_polyline([(41.0, -8.0)], 5.0) == [(41.0, -8.0)]
    pts = [(41.0, -8.0), (41.0005, -8.0), (41.0, -8.0)]  # volta ao ponto de partida: a ponta do meio mantém-se
    assert simplify_polyline(pts, 10.0) == pts
    assert simplify_polyline(pts, 0.0) == pts  # tolerância 0 = não mexe


def test_simplify_handles_long_paths_without_recursion() -> None:
    zigzag = [(41.0 + (i % 2) * 0.0005, -8.0 + i * 0.0001) for i in range(3_000)]
    assert len(simplify_polyline(zigzag, 10.0)) == len(zigzag)  # 55 m de amplitude: nada se perde
    assert len(simplify_polyline(zigzag, 100.0)) < 10


# --- VRP sobre estradas --------------------------------------------------------------------------------------------


def stops() -> list[Stop]:
    return [Stop("b", *B, 1.0), Stop("c", *C, 1.0)]


def test_without_road_the_vrp_is_the_estimate_and_says_so() -> None:
    plan = plan_routes(stops(), params(vehicle_capacity_t=4.0), max_vehicles=2, time_limit_s=1)
    (route,) = plan.routes
    assert route.source == "estimate" and route.duration_s is None and not route.road_path
    assert route.path in ([DEPOT, B, C, DEPOT], [DEPOT, C, B, DEPOT])
    assert plan.source == "estimate" and plan.duration_s is None


def test_the_vrp_uses_road_distances_and_the_road_geometry() -> None:
    # Por estrada A->B 2 km, B->C 3 km, A->C 9 km: a melhor volta é A-B-C-A = 2 + 3 + 9 = 14 km (ou ao contrário, igual)
    road = FakeRoad(symmetric({(A, B): 2000, (B, C): 3000, (A, C): 9000}))
    plan = plan_routes(stops(), params(road=road, vehicle_capacity_t=4.0), max_vehicles=2, time_limit_s=1)
    (route,) = plan.routes
    assert route.km == pytest.approx(14.0) and plan.km_per_round == pytest.approx(14.0)
    assert route.source == "road" and plan.source == "road" and route.road_path
    assert route.duration_s == pytest.approx(14 * 60) and plan.duration_s == pytest.approx(14 * 60)
    # o traçado vem da geometria (com os pontos intermédios), não das linhas retas
    assert len(route.path) > 4 and route.path[0] == DEPOT == route.path[-1]
    assert road.matrix_calls == [[DEPOT, B, C]] and len(road.geometry_calls) == 1


def test_road_distances_change_the_visiting_order() -> None:
    # Em linha reta B e C estão a ~1,1 e ~1,7 km do depósito; por estrada C->B é um atalho enorme e A->B uma volta
    road = FakeRoad(symmetric({(A, B): 8000, (A, C): 1000, (B, C): 500}))
    (route,) = plan_routes(stops(), params(road=road, vehicle_capacity_t=4.0), max_vehicles=2, time_limit_s=1).routes
    assert route.stops == ["c", "b"] and route.km == pytest.approx(1.0 + 0.5 + 8.0)


def test_a_pair_without_a_road_path_makes_the_route_an_estimate() -> None:
    road = FakeRoad(symmetric({(A, B): 2000, (B, C): None, (A, C): 3000}))
    (route,) = plan_routes(stops(), params(road=road, vehicle_capacity_t=4.0), max_vehicles=2, time_limit_s=1).routes
    assert route.source == "estimate" and route.duration_s is None and not route.road_path
    assert route.km > 0 and not road.geometry_calls  # sem estrada completa não se pede o traçado


def test_when_the_router_is_down_the_vrp_falls_back_to_the_estimate() -> None:
    class Down(FakeRoad):
        def matrix(self, points: Sequence[LatLon]) -> RoadMatrix | None:
            return None

    plan = plan_routes(stops(), params(road=Down({})), max_vehicles=2, time_limit_s=1)
    assert plan.source == "estimate" and plan.routes[0].source == "estimate" and not plan.routes[0].road_path


def test_a_geometry_failure_keeps_the_road_km_but_draws_straight_lines() -> None:
    road = FakeRoad(symmetric({(A, B): 2000, (B, C): 3000, (A, C): 9000}), geometry=False)
    (route,) = plan_routes(stops(), params(road=road, vehicle_capacity_t=4.0), max_vehicles=2, time_limit_s=1).routes
    assert route.source == "road" and route.km == pytest.approx(14.0) and not route.road_path
    assert len(route.path) == 4


def test_each_trip_gets_its_own_geometry_and_the_sources_combine() -> None:
    # 5 t não cabem num camião de 3 t: duas viagens, cada uma pelo seu traçado
    road = FakeRoad(symmetric({(A, B): 2000, (B, C): 3000, (A, C): 9000}))
    plan = plan_routes(
        [Stop("b", *B, 2.0), Stop("c", *C, 2.0)],
        params(road=road, vehicle_capacity_t=3.0),
        max_vehicles=3,
        time_limit_s=1,
    )
    assert len(plan.routes) == 2 and len(road.geometry_calls) == 2
    assert plan.km_per_round == pytest.approx(2 * 2.0 + 2 * 9.0) and plan.source == "road"


# --- Zonas -----------------------------------------------------------------------------------------------------------


def test_with_road_distances_sets_the_round_trip_by_road() -> None:
    zone_b = Zone("b", "B", 1000, *B, service_days=1)
    zone_c = Zone("c", "C", 1000, *C, service_days=1)
    # DEPOT == A: ida a B 2 km, volta 2,4 km (sentido único); C sem caminho
    road = FakeRoad({(A, B): 2000, (B, A): 2400, (A, C): None, (C, A): None})
    p = params(road=road)
    out = with_road_distances([zone_b, zone_c], p)
    assert out[0].road_round_trip_km == pytest.approx(4.4) and radial_km(out[0], p) == pytest.approx(4.4)
    assert out[1].road_round_trip_km is None  # sem caminho: continua a estimativa
    assert radial_km(out[1], p) == pytest.approx(2 * haversine_km(*A, *C) * 1.3)
    assert road.matrix_calls == [[DEPOT, B, C]]  # uma só chamada para todas as zonas


def test_with_road_distances_is_a_no_op_without_router_or_zones() -> None:
    zone = Zone("b", "B", 1000, *B, service_days=1)
    assert with_road_distances([zone], params()) == [zone]
    road = FakeRoad({})
    assert with_road_distances([], params(road=road)) == [] and not road.matrix_calls


def test_a_router_that_is_down_leaves_the_zones_untouched() -> None:
    class Down(FakeRoad):
        def matrix(self, points: Sequence[LatLon]) -> RoadMatrix | None:
            return None

    zone = Zone("b", "B", 1000, *B, service_days=1)
    assert with_road_distances([zone], params(road=Down({}))) == [zone]
    assert math.isclose(radial_km(zone, params()), 2 * haversine_km(*A, *B) * 1.3)
