"""Área de uma freguesia a partir do contorno GeoJSON. Função pura.

Área geodésica no elipsoide WGS84 (pyproj.Geod, integração exata do polígono sobre o elipsoide, equivalente em área),
sem passar por uma projeção plana. Os anéis interiores (buracos) subtraem-se do exterior.
"""

from collections.abc import Mapping, Sequence
from typing import Any

from pyproj import Geod

_GEOD = Geod(ellps="WGS84")
M2_PER_KM2 = 1_000_000


def _ring_area_m2(ring: Sequence[Sequence[float]]) -> float:
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    area, _ = _GEOD.polygon_area_perimeter(lons, lats)
    return abs(float(area))


def _polygon_area_m2(rings: Sequence[Sequence[Sequence[float]]]) -> float:
    if not rings:
        return 0.0
    return _ring_area_m2(rings[0]) - sum(_ring_area_m2(r) for r in rings[1:])


def geometry_area_km2(geometry: Mapping[str, Any] | None) -> float | None:
    """Área em km² de um `Polygon` ou `MultiPolygon` GeoJSON; None sem geometria utilizável."""
    if not geometry:
        return None
    kind = geometry.get("type")
    coords = geometry.get("coordinates")
    if kind == "Polygon" and coords:
        return _polygon_area_m2(coords) / M2_PER_KM2
    if kind == "MultiPolygon" and coords:
        return sum(_polygon_area_m2(p) for p in coords) / M2_PER_KM2
    return None
