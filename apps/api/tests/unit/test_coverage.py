"""Cobertura de contentores e geometria: valores calculados à mão."""

import dataclasses

import pytest

from novelo.domain import coverage as cov
from novelo.domain.geo import haversine_m, point_in_geometry
from novelo.domain.network import Mode, build_option
from tests.unit.test_network import URBAN, params

# 0,002° de latitude = 6371,0088 km · 0,002 · π/180 = 222,39 m; 0,004° = 444,78 m
BASE = (41.0, -8.0)


def at(lat_offset: float) -> tuple[float, float]:
    return (BASE[0] + lat_offset, BASE[1])


def test_haversine_m_one_degree() -> None:
    assert haversine_m(41.0, -8.0, 42.0, -8.0) == pytest.approx(111_195.08, abs=0.1)
    assert haversine_m(41.0, -8.0, 41.0, -8.0) == 0.0


def test_parish_coverage_counts_points_within_radius() -> None:
    # contentor em BASE; pontos a 0 m, 222,39 m e 444,78 m; raio 300 m -> 2 de 3 cobertos
    points = [at(0), at(0.002), at(0.004)]
    result = cov.parish_coverage(900, points, [BASE], 300)
    assert (result.demand_points, result.covered_points) == (3, 2)
    assert result.covered_pct == 66.7
    assert result.covered_population == pytest.approx(600.0)  # 900 · 2/3
    assert result.nearest_container_m == pytest.approx(0.0)


def test_nearest_container_decides_not_the_first() -> None:
    far, near = at(0.1), at(0.0021)  # ~11 km e ~233 m do ponto em BASE
    result = cov.parish_coverage(100, [BASE], [far, near], 250)
    assert result.covered_points == 1 and result.nearest_container_m == pytest.approx(233.5, abs=0.1)
    assert cov.parish_coverage(100, [BASE], [far, near], 200).covered_points == 0


def test_no_containers_or_no_points() -> None:
    assert cov.parish_coverage(500, [BASE], [], 300) == cov.ParishCoverageResult(1, 0, 0.0, 0.0, None)
    assert cov.parish_coverage(500, [], [BASE], 300) == cov.ParishCoverageResult(0, 0, 0.0, 0.0, None)


def test_demand_points_prefer_localities_over_centroid() -> None:
    assert cov.demand_points(BASE, [at(0.01), at(0.02)]) == [at(0.01), at(0.02)]
    assert cov.demand_points(BASE, []) == [BASE]


def test_density_and_french_reference() -> None:
    assert cov.per_thousand(30, 150_000) == pytest.approx(0.2)
    assert cov.per_thousand(5, 0) == 0.0
    assert cov.reference_points(14_140) == 10  # 14 140 / 1 414
    assert cov.reference_points(156_830) == 111  # 110,91 arredondado
    assert cov.gap_points(111, 40) == 71
    assert cov.gap_points(5, 9) == 0  # nunca negativo
    assert cov.covered_fraction_pct(25.0, 200) == 12.5


SQUARE = {"type": "Polygon", "coordinates": [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]}  # [lon, lat]


def test_point_in_geometry_polygon_with_hole_and_multipolygon() -> None:
    assert point_in_geometry(5, 5, SQUARE)
    assert not point_in_geometry(5, 15, SQUARE)
    holed = {"type": "Polygon", "coordinates": [*SQUARE["coordinates"], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]]}
    assert not point_in_geometry(5, 5, holed) and point_in_geometry(2, 2, holed)
    multi = {"type": "MultiPolygon", "coordinates": [SQUARE["coordinates"], [[[20, 20], [30, 20], [30, 30], [20, 20]]]]}
    assert point_in_geometry(22, 28, multi) and not point_in_geometry(28, 22, multi)
    assert not point_in_geometry(1, 1, {"type": "Point", "coordinates": [1, 1]})


def test_existing_mode_uses_real_container_count_when_known() -> None:
    p = params()
    # sem dados: ceil(10 000 / 4 000) = 3 pontos; capex 750; 78 recolhas · 6 € = 468; anual = 750/5 + 468 = 618
    base = build_option(URBAN, (Mode.EXISTING,), p).parts[0]
    assert (base.points, base.capex_eur, base.annual_cost_eur) == (3, 750.0, pytest.approx(618.0))
    # 12 contentores reais: capex 3 000; 312 recolhas · 6 € = 1 872; anual = 3 000/5 + 1 872 = 2 472
    real = build_option(dataclasses.replace(URBAN, existing_points=12), (Mode.EXISTING,), p).parts[0]
    assert (real.points, real.capex_eur, real.annual_cost_eur) == (12, 3000.0, pytest.approx(2472.0))
    assert real.capture == base.capture  # a captura não depende da contagem (84 t · 0,12 · 0,7 = 7,056 t)
    # 0 ou None = sem dados: valores atuais
    assert build_option(dataclasses.replace(URBAN, existing_points=0), (Mode.EXISTING,), p).parts[0] == base
    # só o modo "existing" muda; a rua continua com a densidade assumida
    street = build_option(URBAN, (Mode.STREET,), p).parts[0]
    assert build_option(dataclasses.replace(URBAN, existing_points=12), (Mode.STREET,), p).parts[0] == street
