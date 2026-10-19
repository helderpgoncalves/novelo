from pydantic import BaseModel, Field

from novelo.domain.vocab import CollectionMode, TextileDestination, WasteCategory, WasteScope, WeighingMethod


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
