import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field

from novelo.domain.vocab import (
    CircuitStatus,
    CollectionType,
    ContainerKind,
    ContainerStatus,
    DayGroup,
    Shift,
    Typology,
)


class CircuitOut(BaseModel):
    code: str
    typology: Typology
    collection_type: CollectionType
    status: CircuitStatus
    localities: list[str]
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
    capacity_litres: int | None


class ContainerList(BaseModel):
    items: list[ContainerOut]
    total: int
