import uuid
from datetime import datetime
from enum import StrEnum
from typing import Literal, Self

from pydantic import BaseModel, Field, model_validator

from novelo.domain.vocab import CollectionMode, ScenarioObjective, ScenarioStatus


class ParamSource(StrEnum):
    """Origem de cada pressuposto: o web mostra-a ao lado do valor, para ninguém confundir dado com palpite."""

    PLAN = "plan"  # Plano de Ação para a Circularidade Têxtil de Guimarães
    VITRUS_DATA = "vitrus_data"  # calibrado com os dados reais da Vitrus
    ASSUMPTION = "assumption"  # pressuposto da equipa, a validar com a Vitrus


class ModeParams(BaseModel):
    capture_rate: float = Field(ge=0, le=1, description="Fração do têxtil gerado que o modo capta")
    coverage_factor: float = Field(ge=0, le=1, description="Fração da população da zona servida (distância a pé)")
    capex_per_point_eur: float = Field(ge=0)
    people_per_point: int = Field(ge=1, description="1 ponto por cada N habitantes")
    min_points: int = Field(ge=0)
    lifetime_years: float = Field(gt=0)
    collections_per_year: float = Field(ge=0, description="Recolhas por ano de cada ponto")


class PlanningParams(BaseModel):
    kg_per_inhab_month: float = Field(gt=0, le=5, description="Têxtil gerado por habitante e mês")
    modes: dict[CollectionMode, ModeParams]
    cost_per_collection_eur: float = Field(ge=0)
    cost_per_km_eur: float = Field(ge=0)
    detour_factor: float = Field(ge=1, le=3, description="Estrada real / linha reta")
    on_demand_kg_per_pickup: float = Field(gt=0)
    piggyback_extra_km: float = Field(ge=0, description="Desvio médio quando já passa um circuito")
    piggyback_min_days: int = Field(ge=1, le=7, description="Dias/semana de circuito para aproveitar a rota")
    vehicle_capacity_t: float = Field(gt=0)
    depot_lat: float = Field(ge=-90, le=90)
    depot_lon: float = Field(ge=-180, le=180)
    solver_time_limit_s: int = Field(ge=1, le=120)

    @model_validator(mode="after")
    def _all_modes_present(self) -> Self:
        missing = set(CollectionMode) - set(self.modes)
        if missing:
            raise ValueError(f"Missing parameters for modes: {sorted(m.value for m in missing)}")
        return self


class ParamMeta(BaseModel):
    key: str = Field(description="Caminho do parâmetro, ex.: `modes.street.capture_rate`")
    unit: str
    source: ParamSource


class ParametersOut(BaseModel):
    values: PlanningParams
    version: int
    meta: list[ParamMeta]
    updated_at: datetime


class ZoneOut(BaseModel):
    code: str
    name: str
    population: int
    population_year: int | None
    demand_t: float
    latitude: float
    longitude: float
    service_days: int = Field(description="Dias/semana com algum circuito da Vitrus a passar")
    localities: list[str]
    geometry: dict[str, object] | None


class ScenarioRequest(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    objective: ScenarioObjective
    budget_eur_year: float | None = Field(default=None, ge=0, description="Custo anual máximo (max_tonnes)")
    target_tonnes: float | None = Field(default=None, ge=0, description="Meta de captura (min_cost)")
    params: PlanningParams | None = Field(default=None, description="Pressupostos; omitido = os do conjunto ativo")
    constraints: dict[str, list[CollectionMode]] = Field(
        default_factory=dict, description="Modos permitidos por freguesia (código INE); omitido = todos"
    )
    parent_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _objective_inputs(self) -> Self:
        if self.objective == ScenarioObjective.MAX_TONNES and self.budget_eur_year is None:
            raise ValueError("budget_eur_year is required for max_tonnes")
        if self.objective == ScenarioObjective.MIN_COST and self.target_tonnes is None:
            raise ValueError("target_tonnes is required for min_cost")
        return self


class Kpis(BaseModel):
    capex_eur: float
    opex_eur_year: float
    annual_cost_eur: float = Field(description="Capex anualizado + custos de operação")
    tonnes_year: float
    eur_per_tonne: float | None
    coverage_pct: float = Field(description="População servida / população total")
    points: int
    km_year: float
    potential_t: float
    baseline_observed_t: float = Field(description="Recolhido em 2025 (dados da Vitrus)")


class AllocationPart(BaseModel):
    """Contributo de um modo numa freguesia (uma freguesia pode combinar modos)."""

    mode: CollectionMode
    points: int
    tonnes: float
    capex_eur: float
    annual_cost_eur: float
    km_year: float


class Allocation(BaseModel):
    parish_code: str
    parish_name: str
    population: int
    demand_t: float
    mode: CollectionMode | None = Field(description="Modo principal (o que mais capta); nulo = sem recolha")
    modes: list[CollectionMode]
    parts: list[AllocationPart]
    points: int
    tonnes: float
    covered_population: float
    capex_eur: float
    annual_cost_eur: float
    km_year: float


class RouteStop(BaseModel):
    parish_code: str
    parish_name: str
    latitude: float
    longitude: float
    load_t: float


class RouteOut(BaseModel):
    mode: CollectionMode
    vehicle: int
    stops: list[RouteStop]
    km: float
    load_t: float
    path: list[list[float]] = Field(description="[latitude, longitude]: depósito, paragens, depósito")


class ModeSummary(BaseModel):
    mode: CollectionMode
    zones: int
    points: int
    tonnes: float
    annual_cost_eur: float


class ScenarioResult(BaseModel):
    kpis: Kpis
    allocations: list[Allocation]
    routes: list[RouteOut]
    modes: list[ModeSummary]
    depot: list[float]


class ScenarioSummary(BaseModel):
    id: uuid.UUID
    label: str
    objective: ScenarioObjective
    status: ScenarioStatus
    budget_eur_year: float | None
    target_tonnes: float | None
    tonnes_year: float
    capex_eur: float
    annual_cost_eur: float
    eur_per_tonne: float | None
    coverage_pct: float
    parent_id: uuid.UUID | None
    created_at: datetime


class ScenarioOut(ScenarioSummary):
    solver_status: Literal["optimal", "feasible", "infeasible"]
    params: PlanningParams
    constraints: dict[str, list[CollectionMode]]
    result: ScenarioResult
