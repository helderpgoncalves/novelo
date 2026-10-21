"""Rede MUNICIPAL de contentores (outras frações): regras puras, sem I/O.

Nada aqui fala de têxteis recolhidos: os pontos candidatos são lugares possíveis, não recomendações.
Tudo o que depende de um pressuposto (lacuna por freguesia, classificação) devolve também a regra por escrito.
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from math import floor

MONTHS_PER_YEAR = 12

# Limites de Portugal continental: servem para recusar uma bbox sem sentido (e não para cortar dados).
LAT_RANGE = (36.5, 42.5)
LON_RANGE = (-10.0, -6.0)


def fold(text: str) -> str:
    """Minúsculas, sem acentos e com espaços normalizados: base da pesquisa sem acentos."""
    plain = "".join(c for c in unicodedata.normalize("NFD", text.lower()) if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", plain).strip()


# --- bbox -------------------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class BBox:
    min_lon: float
    min_lat: float
    max_lon: float
    max_lat: float

    def contains(self, lat: float, lon: float) -> bool:
        return self.min_lat <= lat <= self.max_lat and self.min_lon <= lon <= self.max_lon


def parse_bbox(raw: str) -> BBox:
    """`min_lon,min_lat,max_lon,max_lat` (a ordem do GeoJSON e do MapLibre). Levanta ValueError se for inválida."""
    parts = [p.strip() for p in raw.split(",")]
    if len(parts) != 4:
        raise ValueError("bbox must be min_lon,min_lat,max_lon,max_lat")
    try:
        min_lon, min_lat, max_lon, max_lat = (float(p) for p in parts)
    except ValueError:
        raise ValueError("bbox values must be numbers") from None
    if not all(-180 <= v <= 180 for v in (min_lon, max_lon)) or not all(-90 <= v <= 90 for v in (min_lat, max_lat)):
        raise ValueError("bbox is outside the valid longitude/latitude range")
    if min_lon > max_lon or min_lat > max_lat:
        raise ValueError("bbox minimum must not exceed its maximum")
    return BBox(min_lon, min_lat, max_lon, max_lat)


# --- agrupamento no servidor (grelha por zoom) -------------------------------------------------------------------

MAX_CLUSTER_ZOOM = 16  # a partir daqui cada local vai sozinho


@dataclass(frozen=True)
class GeoPoint:
    key: str
    lat: float
    lon: float
    weight: int = 1  # contentores no local


@dataclass(frozen=True)
class Cluster:
    lat: float  # centro de massa (média ponderada) dos pontos do grupo
    lon: float
    sites: int
    weight: int
    keys: tuple[str, ...]  # ids dos locais (só com 1 local; o grupo maior não os lista)


def cell_size_deg(zoom: int, cell_px: int = 64) -> float:
    """Lado da célula em graus de longitude: ocupa `cell_px` pixéis num mapa de mosaicos de 256 px."""
    return float(360.0 / (2**zoom) * cell_px / 256)


def grid_cluster(points: Iterable[GeoPoint], zoom: int, cell_px: int = 64) -> list[Cluster]:
    """Agrupa pontos por célula de grelha ao zoom dado. Determinístico: a ordem de saída é a das células."""
    if zoom < 0:
        raise ValueError("zoom must not be negative")
    if zoom >= MAX_CLUSTER_ZOOM:
        return [Cluster(p.lat, p.lon, 1, p.weight, (p.key,)) for p in points]
    size = cell_size_deg(zoom, cell_px)
    cells: dict[tuple[int, int], list[GeoPoint]] = {}
    for p in points:
        cells.setdefault((floor(p.lon / size), floor(p.lat / size)), []).append(p)
    out: list[Cluster] = []
    for key in sorted(cells):
        group = cells[key]
        total = sum(p.weight for p in group)
        if len(group) == 1:
            g = group[0]
            out.append(Cluster(g.lat, g.lon, 1, g.weight, (g.key,)))
            continue
        out.append(
            Cluster(
                lat=sum(p.lat * p.weight for p in group) / total,
                lon=sum(p.lon * p.weight for p in group) / total,
                sites=len(group),
                weight=total,
                keys=(),
            )
        )
    return out


# --- lacuna estimada por freguesia -------------------------------------------------------------------------------

GAP_RULE_PT = (
    "Estimativa: lacuna = têxtil que ainda vai para o lixo = população (INE) × kg/hab/mês × 12, com o kg/hab/mês "
    "de 43 051 t de RSU da Vitrus em 2025 × 5,4% de têxtil (APA); potencial = lacuna ÷ (1 − captura atual do "
    "concelho, igual em todas as freguesias); a lacuna dividida pelos locais candidatos (no mínimo 1) dá toneladas "
    "por candidato; ordena-se do maior para o menor. Não há têxtil recolhido por freguesia."
)


@dataclass(frozen=True)
class GapEstimate:
    potential_t: float
    gap_t: float
    t_per_candidate: float


def gap_estimate(
    population: int, candidate_sites: int, kg_per_inhab_month: float, capture_fraction: float
) -> GapEstimate:
    """Lacuna anual de têxtil (t) de uma freguesia e o seu peso por local candidato. Estimativa, ver `GAP_RULE_PT`.

    `kg_per_inhab_month` é o têxtil que ainda vai para o lixo por habitante; o potencial junta-lhe o recolhido à parte,
    estimado com a captura média do concelho: potencial = lacuna ÷ (1 − captura).
    """
    if population < 0 or candidate_sites < 0:
        raise ValueError("population and candidate sites must not be negative")
    if kg_per_inhab_month <= 0 or not 0 <= capture_fraction < 1:
        raise ValueError("kg per inhabitant must be positive and capture must be a fraction below 1")
    gap = population * kg_per_inhab_month * MONTHS_PER_YEAR / 1000
    potential = gap / (1 - capture_fraction)
    return GapEstimate(potential, gap, gap / max(1, candidate_sites))


# --- candidatos a têxteis: ordenação -----------------------------------------------------------------------------

CANDIDATE_RANK_RULE_PT = (
    "Ordem (sem pesos inventados): 1) coordenada precisa antes de aproximada; 2) freguesia com mais toneladas de "
    "lacuna estimada por candidato; 3) com contentor enterrado; 4) com orgânico coletivo a menos de 15 m; "
    "5) mais contentores no local; 6) identificador do local. É uma lista de lugares possíveis, não de recomendados."
)

REASON_UNDERGROUND = "underground"
REASON_ORGANIC_NEARBY = "organic_collective_nearby"
REASON_THREE_OR_MORE = "three_or_more_containers"
REASON_APPROXIMATE = "approximate_coordinates"


def candidate_reasons(
    *, has_underground: bool, organic_within_15m: int, containers: int, approximate: bool
) -> list[str]:
    """Chaves estáveis da justificação (o texto em português vem do ETL em `candidate_reason`)."""
    out: list[str] = []
    if has_underground:
        out.append(REASON_UNDERGROUND)
    if organic_within_15m > 0:
        out.append(REASON_ORGANIC_NEARBY)
    if containers >= 3:
        out.append(REASON_THREE_OR_MORE)
    if approximate:
        out.append(REASON_APPROXIMATE)
    return out


@dataclass(frozen=True)
class CandidateKeyInput:
    site_id: str
    precise: bool
    parish_gap_t_per_candidate: float
    has_underground: bool
    organic_within_15m: int
    containers: int


def candidate_sort_key(c: CandidateKeyInput) -> tuple[int, float, int, int, int, str]:
    """Chave ascendente da ordem de `CANDIDATE_RANK_RULE_PT`."""
    return (
        0 if c.precise else 1,
        -c.parish_gap_t_per_candidate,
        0 if c.has_underground else 1,
        0 if c.organic_within_15m > 0 else 1,
        -c.containers,
        c.site_id,
    )


# --- densidade: estatística descritiva ---------------------------------------------------------------------------


def quantile(values: Sequence[float], q: float) -> float:
    """Quantil por interpolação linear (o método 7 do R/NumPy). `values` tem de ter pelo menos um valor."""
    if not values:
        raise ValueError("no values")
    if not 0 <= q <= 1:
        raise ValueError("q must be between 0 and 1")
    ordered = sorted(values)
    pos = (len(ordered) - 1) * q
    low = floor(pos)
    high = min(low + 1, len(ordered) - 1)
    return ordered[low] + (ordered[high] - ordered[low]) * (pos - low)


@dataclass(frozen=True)
class Distribution:
    minimum: float
    p25: float
    median: float
    p75: float
    maximum: float


def distribution(values: Sequence[float]) -> Distribution:
    return Distribution(min(values), quantile(values, 0.25), quantile(values, 0.5), quantile(values, 0.75), max(values))


def per_thousand(count: float, population: int) -> float:
    """Contagem por 1 000 habitantes (0 sem população)."""
    return count * 1000 / population if population else 0.0


def people_per(count: int, population: int) -> float | None:
    """Habitantes por unidade (contentor ou local); None se não houver unidades."""
    return population / count if count else None
