import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from novelo.domain.vocab import (
    CollectionMode,
    ScenarioObjective,
    TextileDestination,
    Tipau,
    WasteCategory,
    WasteScope,
    WeighingMethod,
)


class EntityBaseline(BaseModel):
    """Têxtil recolhido por uma entidade num ano e o destino final (toneladas)."""

    entity: str
    total_t: float
    reuse_t: float
    recycle_t: float
    reject_t: float
    reuse_pct: float
    recycle_pct: float
    reject_pct: float
    method: WeighingMethod = Field(
        description="`weighed`: kg exatos por destino; `percentage`: percentagens do relatório"
    )
    provenance: str | None = Field(description="De onde vem o dado (ficheiro ou relatório de origem)")


class TextileBaseline(BaseModel):
    year: int
    population: int
    entities: list[EntityBaseline]
    total_t: float
    reuse_t: float
    recycle_t: float
    reject_t: float
    kg_per_inhab_month: float = Field(description="Observado: toneladas recolhidas por habitante e mês")
    estimated_demand_t: float = Field(description="Estimativa do plano municipal: 0,7 kg/hab/mês")
    capture_of_demand_pct: float
    gap_t: float


class FlowNode(BaseModel):
    id: str
    column: int
    destination: TextileDestination | None = Field(default=None, description="Preenchido nos nós de destino")
    mode: CollectionMode | None = Field(default=None, description="Preenchido nos nós de modo de recolha (cenários)")
    label: str | None = Field(
        default=None, description="Nome da entidade ou freguesia; vazio nos nós de modo e destino (o web traduz)"
    )


class FlowLink(BaseModel):
    source: str
    target: str
    tonnes: float


class Flows(BaseModel):
    observed: bool
    nodes: list[FlowNode]
    links: list[FlowLink]


class WasteShareOut(BaseModel):
    scope: WasteScope
    category: WasteCategory
    share_pct: float


class WasteComposition(BaseModel):
    """Composição dos resíduos urbanos (EEA para a Europa, caracterização nacional para Portugal)."""

    shares: list[WasteShareOut]
    kg_per_inhab_year_pt: float = Field(description="Capitação de resíduos urbanos em Portugal continental, 2024")


# --- Visão geral (página inicial) -------------------------------------------------------------------------------

Evidence = Literal["dado_vitrus", "primary", "secondary", "unverified"]


class OverviewDestinations(BaseModel):
    reuse_t: float
    recycle_t: float
    reject_t: float


class OverviewGap(BaseModel):
    """A lacuna: o que o plano municipal estima gerar, o que se recolheu e o que falta."""

    year: int
    potential_t: float = Field(description="Estimativa: população × 0,7 kg/hab/mês × 12 (plano municipal)")
    collected_t: float = Field(description="Dado Vitrus: recolhido em 2025 pelas 4 entidades")
    missing_t: float = Field(description="potential_t − collected_t")
    capture_pct: float = Field(description="collected_t / potential_t, em %")
    destinations: OverviewDestinations = Field(description="Destino observado do recolhido")
    kg_per_inhab_year: float = Field(description="Observado: recolhido por habitante e ano")
    kg_per_inhab_month: float = Field(description="Observado: recolhido por habitante e mês")
    potential_kg_per_inhab_year: float = Field(description="Estimativa do plano: 0,7 × 12")
    potential_kg_per_inhab_month: float = Field(description="Estimativa do plano: 0,7")
    population: int = Field(description="Soma das freguesias (INE, Censos 2021)")
    parishes_count: int
    potential_is_estimate: bool = Field(default=True, description="O potencial é estimativa; o recolhido não")
    is_estimate: bool = Field(default=True, description="Capture e lacuna dependem do potencial estimado")


class OverviewReference(BaseModel):
    key: str
    label: str
    kg_per_inhab_year: float
    year: int
    scope: Literal["municipality", "region", "country", "eu"]
    source_label: str
    source_url: str | None
    verified: bool = Field(description="Falso: valor registado mas por verificar; não usar em público")
    evidence: Evidence
    is_estimate: bool = Field(description="Verdadeiro para o potencial do plano e valores aproximados")


class OverviewMilestone(BaseModel):
    date: date
    key: str = Field(description="municipal_obligation | transposition_deadline | epr_regimes")
    status: Literal["done", "upcoming"]
    days_remaining: int | None = Field(description="Dias até à data (relógio do servidor, UTC); vazio se já passou")
    who_pays: Literal["municipality", "producers"]
    source_label: str
    source_url: str | None
    verified: bool


class OverviewPoint(BaseModel):
    lat: float
    lon: float


class OverviewParish(BaseModel):
    code: str = Field(description="Código INE/DGT de 6 dígitos")
    name: str
    population: int
    tipau: Tipau | None
    potential_t: float = Field(description="Estimativa: população × 0,7 kg/hab/mês × 12 / 1000")
    potential_is_estimate: bool = True
    circuits_count: int = Field(description="Circuitos da Vitrus que passam em localidades da freguesia")
    localities_count: int
    containers_count: int = Field(description="Contentores ativos importados (0 até chegarem as localizações)")
    area_km2: float | None = Field(description="Da base de dados ou calculada a partir do contorno OSM")
    centroid: OverviewPoint | None
    share_of_population_pct: float


class FrontierPoint(BaseModel):
    id: uuid.UUID
    label: str
    tonnes_year: float
    eur_per_tonne: float | None
    annual_cost_eur: float
    capex_eur: float
    modes: list[CollectionMode] = Field(description="Modos de recolha usados em pelo menos uma freguesia")
    status: Literal["feasible", "infeasible"]
    objective: ScenarioObjective
    is_pareto: bool = Field(description="Não dominado em (menos €/t, mais toneladas); só cenários viáveis")


class OverviewDataSource(BaseModel):
    key: str
    name: str
    provider: str
    kind: Literal["operator", "public_statistics", "public_geodata", "other"]
    period_start: date | None
    period_end: date | None
    methods: list[WeighingMethod] = Field(description="Só no têxtil: `weighed` e/ou `percentage`")
    rows: int = Field(description="Linhas importadas desta fonte (fluxos, circuitos, turnos, freguesias, ...)")


class OverviewHighlight(BaseModel):
    key: str
    value: float
    unit: Literal["pct", "t", "x", "kg_per_inhab_year"]
    text_key: str = Field(description="Chave i18n do texto da manchete")
    context: dict[str, str | float] = Field(description="Valores para interpolar no texto (nomes, totais)")
    source_label: str
    verified: bool
    is_estimate: bool


class Overview(BaseModel):
    """Tudo o que a página inicial mostra, num só pedido."""

    gap: OverviewGap
    references: list[OverviewReference]
    timeline: list[OverviewMilestone]
    parishes: list[OverviewParish]
    scenario_frontier: list[FrontierPoint]
    pareto_ids: list[uuid.UUID]
    data_sources: list[OverviewDataSource]
    highlights: list[OverviewHighlight]
