"""Contrato da rede MUNICIPAL de contentores (outras frações, NÃO é a rede de têxteis).

Regras que o web deve respeitar: o que é estimativa traz `is_estimate` ou vem listado em `estimates`; os nomes de
estabelecimentos (`producer_name(s)`) só chegam a admins com `show_names=true`; para todos os outros vêm `null`.
"""

from datetime import date, datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, Field

from novelo.domain.vocab import (
    CapacityStatus,
    CoordPrecision,
    CoordStatus,
    MunicipalKind,
    MunicipalSourceFile,
    MunicipalStream,
    ParishMatch,
    ParishMatchLevel,
    ProducerType,
    SiteClass,
)

NOT_TEXTILE_NOTE = (
    "Contentores municipais de outras frações (profundidade, superfície, orgânico, resíduos verdes). "
    "Não são contentores de têxteis; servem para escolher lugares possíveis, não para medir recolha de têxteis."
)


class MunicipalEstimateNote(BaseModel):
    """Campos desta resposta que são estimativa e porquê."""

    fields: list[str] = Field(description="Nomes dos campos que são estimativa")
    note: str


class MunicipalSourceInfo(BaseModel):
    key: str
    title: str
    provider: str
    received_on: date | None
    imported_at: datetime
    file_sha256: str = Field(description="SHA-256 do pacote recebido; muda quando os dados mudam")
    caop_version: str = Field(description="Versão da CAOP usada para as freguesias e para atribuir cada local")
    not_textile: Literal[True] = True
    note: str = NOT_TEXTILE_NOTE


# --- Visão geral -------------------------------------------------------------------------------------------------


class MunicipalKindCount(BaseModel):
    kind: MunicipalKind
    containers: int
    located: int = Field(description="Com coordenadas válidas dentro do concelho")
    capacity_litres_total: int = Field(description="Soma da capacidade declarada, em litros (desconhecidas ficam fora)")


class MunicipalStreamCount(BaseModel):
    stream: MunicipalStream
    containers: int


class MunicipalProducerTypeCount(BaseModel):
    type: ProducerType
    label: str
    containers: int
    located: int
    producers_distinct: int = Field(description="Estabelecimentos distintos (contagem; não revela nomes)")
    capacity_litres_total: int


class MunicipalContainerTotals(BaseModel):
    accepted: int
    located: int
    pending: int = Field(description="Sem coordenadas: contam como contentores, não entram no mapa nem por freguesia")
    rejected: int | None = Field(description="Linhas rejeitadas pelo ETL (fora do concelho, linha vazia)")
    capacity_litres_total: int
    capacity_unknown: int = Field(description="Contentores sem capacidade conhecida")
    brands: dict[str, int] = Field(description="Enterrados por marca (molok, bluebee, greenbee)")


class MunicipalSiteTotals(BaseModel):
    total: int
    public: int
    producer: int
    mixed: int
    single_container: int
    max_containers: int
    textile_candidates: int = Field(
        description="Locais públicos com contentor de rua: lugares possíveis, não recomendados"
    )
    textile_candidates_precise: int
    textile_candidates_underground: int


class MunicipalDensityKpis(BaseModel):
    population: int = Field(description="Soma das freguesias (INE, Censos 2021)")
    area_km2: float = Field(description="Área CAOP 2019 das 48 freguesias")
    containers_per_1000_hab: float
    public_sites_per_1000_hab: float
    containers_per_km2: float
    public_sites_per_km2: float


class MunicipalNnDistance(BaseModel):
    n: int
    mean_m: float
    p5_m: float
    p25_m: float
    median_m: float
    p75_m: float
    p95_m: float
    max_m: float


class MunicipalCoverageKpis(BaseModel):
    is_estimate: Literal[True] = True
    basis: Literal["area"] = Field("area", description="Cobertura da ÁREA do concelho, não da população")
    pct_200m: float | None
    pct_300m: float | None
    pct_500m: float | None
    parishes_half_covered_300m: int = Field(description="Freguesias com 50% ou mais da área a ≤ 300 m de um local")
    parishes_under_quarter_300m: int = Field(description="Freguesias com menos de 25% da área a ≤ 300 m de um local")
    nn_distance: MunicipalNnDistance | None = Field(description="Vizinho mais próximo entre locais públicos")


class MunicipalQualityKpis(BaseModel):
    sites_precise: int
    sites_approximate: int = Field(
        description="Coordenadas com 3 casas decimais ou menos (~100 m): confirmar no terreno"
    )
    containers_coord_suspect: int = Field(description="Declarados a mais de 1 km da freguesia do polígono")
    parish_compared: int
    parish_equal: int
    parish_equal_pct: float | None
    stream_unknown_containers: int = Field(description="Fração desconhecida (enterrados e superfície)")
    capacity_assumed_containers: int = Field(description="Capacidade sem unidade, lida como litros (assumido)")
    open_alerts: int
    alerts_total: int


class MunicipalOverview(BaseModel):
    source: MunicipalSourceInfo
    containers: MunicipalContainerTotals
    sites: MunicipalSiteTotals
    density: MunicipalDensityKpis
    coverage: MunicipalCoverageKpis
    quality: MunicipalQualityKpis
    by_kind: list[MunicipalKindCount]
    by_stream: list[MunicipalStreamCount]
    by_producer_type: list[MunicipalProducerTypeCount]
    estimates: MunicipalEstimateNote


# --- Freguesias --------------------------------------------------------------------------------------------------


class MunicipalParishSort(StrEnum):
    NAME = "name"
    POPULATION = "population"
    CONTAINERS = "containers"
    CONTAINERS_PER_1000_HAB = "containers_per_1000_hab"
    PUBLIC_SITES_PER_1000_HAB = "public_sites_per_1000_hab"
    CONTAINERS_PER_KM2 = "containers_per_km2"
    MEAN_NN_DISTANCE_M = "mean_nn_distance_m"
    COVER_PCT_300M = "cover_pct_300m"
    CANDIDATE_SITES = "candidate_sites"
    GAP_RANK = "gap_rank"
    PRODUCERS = "producers"


class MunicipalSortOrder(StrEnum):
    ASC = "asc"
    DESC = "desc"


class MunicipalProducersByType(BaseModel):
    restaurant: int
    school: int
    establishment: int
    large_producer: int
    care_home: int
    hospitality: int

    @property
    def total(self) -> int:
        return (
            self.restaurant + self.school + self.establishment + self.large_producer + self.care_home + self.hospitality
        )


class MunicipalKindCounts(BaseModel):
    underground: int
    surface: int
    platform: int
    organic_collective: int
    organic_producer: int
    green_waste: int


class MunicipalParishOut(BaseModel):
    dicofre: str = Field(description="Código da app/INE (uniões: 0308U1..5); liga a `parishes` e ao simulador")
    dicofre_caop: str = Field(description="Código CAOP 2019 (uniões: 030876, 030881, 030883, 030884, 030890)")
    name: str
    population: int
    area_km2: float
    containers: int
    containers_pending: int
    sites: int
    public_sites: int
    by_kind: MunicipalKindCounts
    capacity_litres_total: int
    containers_per_1000_hab: float
    public_sites_per_1000_hab: float
    containers_per_km2: float
    public_sites_per_km2: float
    mean_nn_distance_m: float | None
    median_nn_distance_m: float | None
    cover_pct_200m: float = Field(description="% da área a ≤ 200 m de um local público (área, não população)")
    cover_pct_300m: float
    cover_pct_500m: float
    producers: MunicipalProducersByType = Field(description="Contentores de produtores por tipo")
    containers_coord_suspect: int
    candidate_sites: int
    candidate_sites_precise: int
    textile_potential_t: float = Field(description="Estimativa: 0,7 kg/hab/mês × população × 12")
    textile_gap_t: float = Field(description="Estimativa: potencial × (1 − captura média do concelho)")
    gap_t_per_candidate_site: float = Field(description="Estimativa: lacuna ÷ max(1, locais candidatos)")
    gap_rank: int = Field(description="1 = mais toneladas de lacuna por local candidato (estimativa)")
    centroid_lat: float | None
    centroid_lon: float | None


class MunicipalParishList(BaseModel):
    items: list[MunicipalParishOut]
    total: int
    estimates: MunicipalEstimateNote


# --- Locais e contentores ----------------------------------------------------------------------------------------


class MunicipalStreamCounts(BaseModel):
    organico: int
    verdes: int
    desconhecido: int


class MunicipalSiteOut(BaseModel):
    site_id: str = Field(description="S + 8 hexadecimais; estável entre importações")
    latitude: float
    longitude: float
    parish_dicofre: str | None
    parish_code: str | None
    parish_name: str | None
    site_class: SiteClass
    containers: int
    units_declared: int = Field(description="Nos resíduos verdes usa `Quantidade` (semântica por esclarecer)")
    capacity_litres_total: int
    capacity_unknown: int
    by_kind: MunicipalKindCounts
    by_stream: MunicipalStreamCounts
    kinds: list[MunicipalKind]
    producer_types: list[ProducerType]
    producer_names: list[str] | None = Field(
        description="SENSÍVEL: só para admins com show_names=true; caso contrário null"
    )
    streets: list[str]
    source_files: list[MunicipalSourceFile]
    coord_precision: CoordPrecision
    organic_collective_within_15m: int
    nn_distance_m: float | None = Field(description="Distância ao local público mais próximo (só locais públicos)")
    textile_candidate: bool = Field(description="Local público com contentor de rua: lugar possível, não recomendado")
    candidate_reason: str | None
    coord_suspect_containers: int


class MunicipalSitePage(BaseModel):
    items: list[MunicipalSiteOut]
    total: int = Field(description="Total com os filtros aplicados")
    next_cursor: str | None = Field(description="Passar em `cursor` para a página seguinte; null no fim")
    names_visible: bool


class MunicipalContainerOut(BaseModel):
    container_uid: str
    source_file: MunicipalSourceFile
    source_line: int = Field(description="Linha física no ficheiro de origem (1 = cabeçalho)")
    external_id: str
    kind: MunicipalKind
    stream: MunicipalStream
    brand: str | None
    capacity_litres: int | None
    capacity_raw: str | None
    capacity_status: CapacityStatus
    producer_type: ProducerType | None
    producer_name: str | None = Field(description="SENSÍVEL: só para admins com show_names=true; caso contrário null")
    street: str | None
    quantity: int | None
    declared_parish: str | None = Field(description="Como escrito no ficheiro; nunca é usado para contar")
    parish_dicofre: str | None
    parish_code: str | None
    parish_name: str | None
    parish_match: ParishMatch
    parish_match_level: ParishMatchLevel | None
    parish_mismatch_distance_m: float | None
    coord_suspect: bool
    latitude: float | None
    longitude: float | None
    coord_status: CoordStatus
    coord_swapped: bool
    coord_cleaned: bool
    coord_precision: CoordPrecision | None
    boundary_note: str | None
    site_id: str | None


class MunicipalContainerPage(BaseModel):
    items: list[MunicipalContainerOut]
    total: int
    next_cursor: str | None
    names_visible: bool


class MunicipalNeighbourOut(BaseModel):
    site_id: str
    distance_m: float
    parish_name: str | None
    site_class: SiteClass
    containers: int
    kinds: list[MunicipalKind]
    textile_candidate: bool


class MunicipalLinkOut(BaseModel):
    organic_uid: str
    nearest_street_uid: str | None
    nearest_street_kind: str | None
    distance_m: float | None
    within_link_radius: bool = Field(description="Contentor de rua a ≤ 15 m do orgânico coletivo")
    same_number_uid: str | None
    same_number_distance_m: float | None
    same_number_same_street: bool | None


class MunicipalSiteDetail(BaseModel):
    site: MunicipalSiteOut
    containers: list[MunicipalContainerOut]
    neighbours: list[MunicipalNeighbourOut] = Field(
        description="Outros locais a ≤ radius_m, do mais perto para o mais longe"
    )
    links: list[MunicipalLinkOut] = Field(description="Relações espaciais dos orgânicos coletivos deste local")
    parish: MunicipalParishOut | None
    radius_m: int
    names_visible: bool


# --- GeoJSON -----------------------------------------------------------------------------------------------------


class PointGeometry(BaseModel):
    type: Literal["Point"] = "Point"
    coordinates: list[float] = Field(min_length=2, max_length=2, description="[longitude, latitude]")


class SiteFeatureProps(BaseModel):
    cluster: bool = Field(description="true = grupo de locais (não tem site_id); false = um local")
    point_count: int = Field(description="Locais no grupo (1 se for um local)")
    containers: int
    site_id: str | None = None
    site_class: SiteClass | None = None
    kind: MunicipalKind | None = Field(default=None, description="Tipo principal para colorir o ponto")
    kinds: list[MunicipalKind] | None = None
    textile_candidate: bool | None = None
    coord_precision: CoordPrecision | None = None
    parish_name: str | None = None
    nn_distance_m: float | None = None


class SiteFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    id: str | None = None
    geometry: PointGeometry
    properties: SiteFeatureProps


class SiteFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[SiteFeature]
    total_sites: int = Field(description="Locais que cumprem os filtros e a bbox")
    clustered: bool
    zoom: int | None


class CaopProps(BaseModel):
    dicofre: str
    dicofre_caop: str
    name: str
    population: int
    area_ha: float | None
    area_km2: float
    containers: int
    containers_per_1000_hab: float
    public_sites_per_1000_hab: float
    cover_pct_300m: float
    candidate_sites: int
    gap_t_per_candidate_site: float = Field(description="Estimativa")
    gap_rank: int
    lat: float | None
    lon: float | None


class CaopFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    id: str
    geometry: dict[str, Any] = Field(description="Polygon/MultiPolygon GeoJSON (WGS84, simplificado a 5 m)")
    properties: CaopProps


class CaopFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    name: str
    source: str
    features: list[CaopFeature]


# --- Produtores --------------------------------------------------------------------------------------------------


class MunicipalParishCount(BaseModel):
    dicofre: str | None
    name: str
    containers: int


class MunicipalProducerTypeSummary(BaseModel):
    type: ProducerType
    label: str
    containers: int
    located: int
    sites: int
    producers_distinct: int
    capacity_litres_total: int
    top_parishes: list[MunicipalParishCount]
    textile_hypothesis: str = Field(description="Hipótese nossa de interesse para têxteis; a validar com a Vitrus")


class MunicipalProducerSite(BaseModel):
    site_id: str
    latitude: float
    longitude: float
    parish_dicofre: str | None
    parish_name: str | None
    producer_types: list[ProducerType]
    containers: int
    capacity_litres_total: int
    coord_precision: CoordPrecision
    producer_names: list[str] | None = Field(description="SENSÍVEL: só admins com show_names=true")


class MunicipalProducersOut(BaseModel):
    names_visible: bool
    by_type: list[MunicipalProducerTypeSummary]
    items: list[MunicipalProducerSite]
    total: int
    next_cursor: str | None


# --- Candidatos, lacuna e densidade -------------------------------------------------------------------------------


class MunicipalCandidateOut(BaseModel):
    rank: int
    site: MunicipalSiteOut
    reasons: list[str] = Field(
        description="Chaves: underground, organic_collective_nearby, three_or_more_containers, approximate_coordinates"
    )
    reason_text: str | None = Field(description="Justificação do ETL, em português")
    parish_gap_t_per_candidate: float = Field(description="Estimativa da freguesia, usada na ordem")
    parish_gap_rank: int


class MunicipalCandidatesOut(BaseModel):
    is_estimate: Literal[True] = True
    rank_rule: str
    note: str
    total: int
    total_precise: int
    items: list[MunicipalCandidateOut]
    next_cursor: str | None


class MunicipalGapRow(BaseModel):
    rank: int
    dicofre: str
    name: str
    population: int
    containers: int
    containers_per_1000_hab: float
    candidate_sites: int
    candidate_sites_precise: int
    textile_potential_t: float
    textile_gap_t: float
    gap_t_per_candidate_site: float


class MunicipalGapParameters(BaseModel):
    kg_per_inhab_month: float
    capture_pct: float = Field(description="Captura média atual do concelho (301,3 t ÷ 1 317 t), igual em todas")
    months_per_year: int = 12


class MunicipalGapRankingOut(BaseModel):
    is_estimate: Literal[True] = True
    rule: str
    parameters: MunicipalGapParameters
    caveat: str
    items: list[MunicipalGapRow]


class MunicipalDistributionOut(BaseModel):
    minimum: float
    p25: float
    median: float
    p75: float
    maximum: float


class MunicipalDensityStat(BaseModel):
    key: str
    label: str
    unit: str
    concelho: float = Field(description="Valor do concelho inteiro")
    distribution: MunicipalDistributionOut = Field(description="Distribuição entre as 48 freguesias")


class MunicipalParishDensity(BaseModel):
    dicofre: str
    name: str
    population: int
    containers_per_1000_hab: float
    public_sites_per_1000_hab: float
    below_p25: bool = Field(description="Abaixo do 1.º quartil das freguesias em contentores por 1 000 hab.")


class MunicipalTextileReference(BaseModel):
    is_estimate: Literal[True] = True
    people_per_point: int
    verified: bool = Field(description="false = referência por verificar com a fonte")
    reference_points: int = Field(
        description="Pontos que a referência daria ao concelho (população ÷ habitantes por ponto)"
    )
    candidate_sites: int
    candidates_per_reference_point: float | None
    note: str


class MunicipalDensityBenchmarkOut(BaseModel):
    population: int
    stats: list[MunicipalDensityStat]
    people_per_public_site: float | None
    parishes: list[MunicipalParishDensity]
    textile_reference: MunicipalTextileReference
    note: str
