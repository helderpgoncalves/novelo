"""Área geodésica das freguesias: valores de referência no equador e os dados reais de Guimarães."""

import json
from pathlib import Path

import pytest

from novelo.domain.parish_area import geometry_area_km2
from novelo.seed import parish_area_km2

RAW = Path(__file__).resolve().parents[4] / "data" / "raw" / "public" / "parishes.geojson"


def square(lon: float, lat: float, size: float) -> list[list[float]]:
    return [[lon, lat], [lon + size, lat], [lon + size, lat + size], [lon, lat + size], [lon, lat]]


def test_equatorial_square_matches_the_ellipsoid() -> None:
    # 0,1° x 0,1° no equador (WGS84): 0,1 · 111,3195 km x 0,1 · 110,574 km = 123,09 km²
    a = geometry_area_km2({"type": "Polygon", "coordinates": [square(0, 0, 0.1)]})
    assert a == pytest.approx(123.09, rel=0.002)


def test_orientation_does_not_matter() -> None:
    ring = square(0, 0, 0.1)
    cw = geometry_area_km2({"type": "Polygon", "coordinates": [ring[::-1]]})
    assert cw == pytest.approx(geometry_area_km2({"type": "Polygon", "coordinates": [ring]}))


def test_holes_are_subtracted_and_multipolygons_summed() -> None:
    outer, hole = square(0, 0, 0.2), square(0.05, 0.05, 0.1)
    with_hole = geometry_area_km2({"type": "Polygon", "coordinates": [outer, hole]})
    assert with_hole == pytest.approx(3 * 123.09, rel=0.005)  # 4A − A
    two = geometry_area_km2({"type": "MultiPolygon", "coordinates": [[square(0, 0, 0.1)], [square(1, 1, 0.1)]]})
    assert two == pytest.approx(2 * 123.09, rel=0.01)


def test_missing_geometry_has_no_area() -> None:
    assert geometry_area_km2(None) is None
    assert geometry_area_km2({"type": "Point", "coordinates": [0, 0]}) is None
    assert parish_area_km2("") is None


def test_implausibly_small_outline_is_discarded() -> None:
    tiny = json.dumps({"type": "Polygon", "coordinates": [square(-8.33, 41.5, 0.001)]})  # ~0,009 km²
    assert parish_area_km2(tiny) is None
    ok = json.dumps(
        {"type": "Polygon", "coordinates": [square(-8.3, 41.4, 0.02)]}
    )  # 2,222 km x 1,670 km (cos 41,4° = 0,750) = 3,71 km²
    assert parish_area_km2(ok) == pytest.approx(3.71, rel=0.01)


def test_real_parishes_add_up_to_most_of_the_municipality() -> None:
    # Guimarães tem ~241 km². 44 das 48 freguesias têm contorno fiável (3 sem contorno e Briteiros com um engano).
    features = json.loads(RAW.read_text())["features"]
    areas = [a for f in features if (a := parish_area_km2(json.dumps(f["geometry"]) if f["geometry"] else ""))]
    assert len(areas) == 44
    assert 195 < sum(areas) < 241
