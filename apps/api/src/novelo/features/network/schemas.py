import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field

from novelo.domain.vocab import (
    CircuitStatus,
    CollectionType,
    ContainerKind,
    ContainerStatus,
    CoverageState,
    DayGroup,
    Shift,
    Typology,
)


class CircuitOut(BaseModel):
    code: str
    typology: Typology
    collection_type: CollectionType
    status: CircuitStatus
    localities: list[str] = Field(description="Localidades pela ordem do ficheiro da Vitrus (a ordem do percurso)")
    weekdays: list[int] = Field(description="Dias em que passa: 1 = segunda ... 7 = domingo")
    days_text: str = Field(description="Dias como escritos no planeamento da Vitrus")
    vehicles: list[str] = Field(description="Matrículas das viaturas que o servem no planeamento")
    note: str | None


class CircuitsSummary(BaseModel):
    circuits: list[CircuitOut]
    total: int
    without_vehicle: int
    vehicles: int
    vehicles_never_assigned: list[str]
    localities: int


class SlotCount(BaseModel):
    day_group: DayGroup
    shift: Shift
    assignments: int = Field(description="Linhas do planeamento (viatura + circuito) neste turno")
    crew: int


class TypologyFleet(BaseModel):
    typology: Typology
    circuits: int
    circuits_without_vehicle: int
    slots: list[SlotCount]
    vehicle_shifts_week: int
    crew_shifts_week: int
    fleet_vehicles: int | None = Field(description="Viaturas totais da frota para esta tipologia, se fornecido")
    fleet_crew: int | None = Field(description="Recursos humanos totais para esta tipologia, se fornecido")


class ScheduleEntry(BaseModel):
    day_group: DayGroup
    shift: Shift
    circuit: str
    typology: Typology
    crew: int
    collection_type: CollectionType = Field(description="Modo de recolha desta linha do planeamento")
    note: str | None = Field(description="Nota da linha do planeamento da Vitrus")


class VehicleOut(BaseModel):
    plate: str
    note: str | None
    assignments: int
    weekday_shifts: int = Field(description="Turnos distintos usados de segunda a sexta")
    circuits: list[str]
    typologies: list[Typology]
    max_crew: int
    never_assigned: bool = Field(description="Aparece no planeamento mas nunca com um circuito")
    multi_typology: bool = Field(description="Serve mais do que uma tipologia (exige lavagem da caixa entre fluxos)")
    schedule: list[ScheduleEntry]


class FleetSummary(BaseModel):
    typologies: list[TypologyFleet]
    vehicles: list[VehicleOut]
    total_assignments: int
    total_crew_shifts_week: int
    period_start: date | None
    period_end: date | None


class LocalityOut(BaseModel):
    name: str
    latitude: float | None = Field(description="OpenStreetMap (Nominatim); vazio se a localidade não é um lugar")
    longitude: float | None
    parish_code: str | None = Field(description="Freguesia onde cai o ponto (código INE)")
    circuits: list[str]
    typologies: list[Typology]
    collection_types: list[CollectionType]
    weekdays: list[int]
    days_per_week: int = Field(description="Dias distintos da semana com algum circuito a passar")


class ContainerOut(BaseModel):
    id: uuid.UUID
    external_ref: str
    kind: ContainerKind
    status: ContainerStatus
    latitude: Decimal
    longitude: Decimal
    address: str | None
    locality: str | None
    parish_code: str | None = Field(description="Freguesia onde cai o ponto (código INE), se foi possível atribuir")
    capacity_litres: int | None


class ContainerList(BaseModel):
    items: list[ContainerOut]
    total: int


class ParishCoverage(BaseModel):
    parish_code: str
    parish_name: str
    population: int
    demand_points: int = Field(description="Pontos onde se assume que a população vive (localidades ou centroide)")
    containers: int = Field(description="Contentores contados que caem nesta freguesia")
    containers_per_1000: float = Field(description="Contentores por 1000 habitantes")
    covered_population: int = Field(description="Estimativa: população a ≤ radius_m de um contentor")
    covered_pct: float = Field(description="Estimativa: % da população coberta (0 a 100)")
    nearest_container_m: float | None = Field(description="Distância em linha reta ao contentor mais próximo")
    reference_points: int = Field(description="Pontos que a referência francesa daria a esta freguesia")
    gap_points: int = Field(description="Pontos em falta face à referência (nunca negativo)")


class ReferenceStandard(BaseModel):
    name: str
    people_per_point: int = Field(description="1 ponto por cada N habitantes")
    points: int = Field(description="Pontos que a referência daria ao concelho")
    verified: bool = Field(description="Falso: o valor ainda tem de ser confirmado na fonte")
    note: str


class CoverageSummary(BaseModel):
    state: CoverageState = Field(description="awaiting_data enquanto não houver contentores importados")
    is_estimate: bool = Field(default=True, description="A cobertura é uma estimativa, não uma medição")
    method: str = Field(description="Como se calcula, em português, para mostrar no ecrã")
    radius_m: int
    kind: ContainerKind = Field(description="Tipo de contentor contado (só ativos)")
    population: int = Field(description="População residente das freguesias (INE)")
    containers: int = Field(description="Contentores ativos do tipo pedido")
    containers_total: int = Field(description="Todos os contentores importados, de qualquer tipo e estado")
    containers_per_1000: float | None
    covered_population: int | None
    covered_pct: float | None
    reference: ReferenceStandard
    gap_points: int | None = Field(description="Pontos em falta face à referência; vazio sem dados")
    parishes: list[ParishCoverage]
