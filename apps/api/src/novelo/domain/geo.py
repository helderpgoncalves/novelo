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
