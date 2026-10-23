"""Geometria sobre a esfera. Funções puras."""

from math import asin, cos, radians, sin, sqrt
from typing import Any

EARTH_RADIUS_KM = 6371.0088


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distância em linha reta entre dois pontos (graus), em quilómetros."""
    d_lat, d_lon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * asin(sqrt(a))


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distância em linha reta entre dois pontos (graus), em metros."""
    return haversine_km(lat1, lon1, lat2, lon2) * 1000


def point_in_ring(lat: float, lon: float, ring: list[list[float]]) -> bool:
    """Ray casting: o ponto está dentro do anel GeoJSON (pares [lon, lat])? Fronteira não garantida."""
    inside = False
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i][0], ring[i][1]
        x2, y2 = ring[(i + 1) % n][0], ring[(i + 1) % n][1]
        if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def point_in_geometry(lat: float, lon: float, geometry: dict[str, Any]) -> bool:
    """Ponto dentro de um Polygon/MultiPolygon GeoJSON (o primeiro anel é o exterior, os seguintes são buracos)."""
    kind = geometry.get("type")
    if kind == "Polygon":
        polygons = [geometry["coordinates"]]
    elif kind == "MultiPolygon":
        polygons = geometry["coordinates"]
    else:
        return False
    for rings in polygons:
        if rings and point_in_ring(lat, lon, rings[0]) and not any(point_in_ring(lat, lon, h) for h in rings[1:]):
            return True
    return False


def simplify_polyline(points: list[tuple[float, float]], tolerance_m: float) -> list[tuple[float, float]]:
    """Douglas-Peucker sobre (lat, lon): tira pontos que desviam menos de `tolerance_m` do traço. Mantém as pontas.

    Projeção plana local (equiretangular) em metros: serve para as dezenas de km de um concelho. Iterativo, para
    traçados longos não rebentarem a pilha.
    """
    n = len(points)
    if n <= 2 or tolerance_m <= 0:
        return list(points)
    lat0 = radians(sum(p[0] for p in points) / n)
    m_per_deg = EARTH_RADIUS_KM * 1000 * radians(1)
    xy = [(p[1] * m_per_deg * cos(lat0), p[0] * m_per_deg) for p in points]
    keep = [False] * n
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        lo, hi = stack.pop()
        ax, ay = xy[lo]
        bx, by = xy[hi]
        dx, dy = bx - ax, by - ay
        length2 = dx * dx + dy * dy
        worst, worst_i = -1.0, lo
        for i in range(lo + 1, hi):
            px, py = xy[i]
            if length2 == 0:
                dist = sqrt((px - ax) ** 2 + (py - ay) ** 2)
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length2))
                dist = sqrt((px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2)
            if dist > worst:
                worst, worst_i = dist, i
        if worst > tolerance_m:
            keep[worst_i] = True
            stack.append((lo, worst_i))
            stack.append((worst_i, hi))
    return [p for p, k in zip(points, keep, strict=True) if k]
