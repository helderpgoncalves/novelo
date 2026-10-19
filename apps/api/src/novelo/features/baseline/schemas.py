from pydantic import BaseModel, ConfigDict, Field


class EntityBaseline(BaseModel):
    """Têxtil recolhido por uma entidade em 2025 e destino final (toneladas)."""

    model_config = ConfigDict(from_attributes=True)

    entity: str
    total_t: float
    reuse_t: float
    recycle_t: float
    reject_t: float
    reuse_pct: float
    recycle_pct: float
    reject_pct: float
    source: str
    exact_weights: bool = Field(description="False se o destino vem de percentagens do relatório")


class TextileBaseline(BaseModel):
    year: int = 2025
    population: int
    entities: list[EntityBaseline]
    total_t: float
    reuse_t: float
    recycle_t: float
    reject_t: float
    kg_per_inhab_month: float = Field(description="Observado: toneladas recolhidas por habitante")
    estimated_demand_t: float = Field(description="Estimativa do plano municipal: 0,7 kg/hab/mês")
    capture_of_demand_pct: float
    gap_t: float


class Circuit(BaseModel):
    typology: str
    circuit: str
    collection_type: str
    localities: list[str]
    days: str
    status: str
    note: str


class CircuitsSummary(BaseModel):
    circuits: list[Circuit]
    total: int
    without_vehicle: int
    vehicles: int
    vehicles_never_assigned: list[str]
    localities: list[str]


class FlowNode(BaseModel):
    id: str
    label: str
    column: int


class FlowLink(BaseModel):
    source: str
    target: str
    tonnes: float


class Flows(BaseModel):
    observed: bool
    nodes: list[FlowNode]
    links: list[FlowLink]


class WasteShare(BaseModel):
    scope: str = Field(description="Europa ou Portugal")
    category: str
    share_pct: float


class WasteComposition(BaseModel):
    """Composição dos resíduos urbanos (EEA para a Europa, caracterização nacional para Portugal)."""

    shares: list[WasteShare]
    kg_per_inhab_year_pt: float = Field(description="Capitação de resíduos urbanos em Portugal continental, 2024")
