"""Cobertura da rede de contentores. Funções puras, sem I/O.

Método (estimativa, não medição): não há população por lugar, só por freguesia. A população de cada freguesia
reparte-se em partes iguais pelos seus pontos de procura (as localidades geocodificadas dentro dela; se não houver
nenhuma, o centroide da freguesia). Um ponto de procura está coberto se o contentor mais próximo estiver a
`radius_m` ou menos em linha reta (haversine). A cobertura da freguesia é a fração de pontos cobertos.

  população coberta   = P · (pontos cobertos / pontos de procura)
  contentores/1000    = contentores · 1000 / P
  pontos de referência = P / 1414     (ponto francês: 1 ponto por ~1 414 habitantes, a verificar)
  lacuna              = max(0, pontos de referência − contentores)
"""

from __future__ import annotations

from dataclasses import dataclass

from novelo.domain.geo import haversine_m

# Referência francesa (Refashion): 1 ponto por ~1 414 habitantes. Valor por verificar com a fonte.
FRENCH_PEOPLE_PER_POINT = 1414

LatLon = tuple[float, float]


@dataclass(frozen=True)
class ParishCoverageResult:
    demand_points: int
    covered_points: int
    covered_pct: float  # 0 a 100
    covered_population: float
    nearest_container_m: float | None  # do ponto de procura mais próximo de um contentor


def demand_points(centroid: LatLon, localities: list[LatLon]) -> list[LatLon]:
    """Pontos onde se assume que a população da freguesia vive: localidades geocodificadas, ou o centroide."""
    return list(localities) if localities else [centroid]


def nearest_distance_m(point: LatLon, containers: list[LatLon]) -> float | None:
    if not containers:
        return None
    return min(haversine_m(point[0], point[1], c[0], c[1]) for c in containers)


def parish_coverage(
    population: int, points: list[LatLon], containers: list[LatLon], radius_m: float
) -> ParishCoverageResult:
    """Fração (estimada) da freguesia a `radius_m` ou menos de um contentor."""
    if not points:
        return ParishCoverageResult(0, 0, 0.0, 0.0, None)
    distances = [d for p in points if (d := nearest_distance_m(p, containers)) is not None]
    covered = sum(1 for d in distances if d <= radius_m)
    share = covered / len(points)
    return ParishCoverageResult(
        demand_points=len(points),
        covered_points=covered,
        covered_pct=round(share * 100, 1),
        covered_population=population * share,
        nearest_container_m=min(distances) if distances else None,
    )


def per_thousand(containers: int, population: int) -> float:
    """Contentores por 1000 habitantes (0 se não há população)."""
    return containers * 1000 / population if population else 0.0


def reference_points(population: int, people_per_point: int = FRENCH_PEOPLE_PER_POINT) -> int:
    """Pontos que a referência francesa daria a esta população (arredondado ao inteiro mais próximo)."""
    return round(population / people_per_point)


def gap_points(reference: int, containers: int) -> int:
    """Pontos em falta face à referência (nunca negativo)."""
    return max(0, reference - containers)


def covered_fraction_pct(covered_population: float, population: int) -> float:
    return round(covered_population * 100 / population, 1) if population else 0.0
