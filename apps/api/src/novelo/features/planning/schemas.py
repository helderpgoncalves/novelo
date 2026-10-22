import uuid
from datetime import datetime
from enum import StrEnum
from typing import Literal, Self

from pydantic import BaseModel, Field, model_validator

from novelo.domain.vocab import CollectionMode, ProducerType, ScenarioObjective, ScenarioStatus, Tipau
from novelo.features.planning import assumptions as a

Siting = Literal["parish", "sites"]
# Candidatos da rede por locais: `public` (locais de contentores municipais na rua), `staffed` (pontos assistidos:
# escolas, sem contentor de rua; caixa ou saco no interior), `both`.
SiteCandidates = Literal["public", "staffed", "both"]

# Modos oferecidos por omissão: local existente e recolha a pedido. A Vitrus não tem contentores de têxtil nem os quer
# (contaminação); `street` continua no vocabulário só como referência explícita (ex.: benchmark francês).
DEFAULT_SCENARIO_MODES: tuple[CollectionMode, ...] = (CollectionMode.EXISTING, CollectionMode.ON_DEMAND)


class ParamSource(StrEnum):
    """Origem de cada pressuposto: o web mostra-a ao lado do valor, para ninguém confundir dado com palpite."""

    VITRUS_DATA = "vitrus_data"  # dados reais da Vitrus (com a APA, para o têxtil no RSU)
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
    kg_per_inhab_month: float = Field(
        gt=0,
        le=5,
        description=(
            "Têxtil que ainda vai para o lixo por habitante e mês (indiferenciado do concelho 51 250,6 t × 5,86%, "
            "Vitrus + APA)"
        ),
    )
    modes: dict[CollectionMode, ModeParams]
    cost_per_collection_eur: float = Field(
        ge=0, description="Custo de uma recolha: paragem num local ou saco à porta (tripulação e tempo)"
    )
    cost_per_km_eur: float = Field(ge=0)
    detour_factor: float = Field(ge=1, le=3, description="Estrada real / linha reta")
    on_demand_kg_per_pickup: float = Field(gt=0)
    vehicle_capacity_t: float = Field(gt=0, description="Carga útil da viatura dedicada ao têxtil (t)")
    depot_lat: float = Field(ge=-90, le=90)
    depot_lon: float = Field(ge=-180, le=180)
    solver_time_limit_s: int = Field(ge=1, le=120)
    # Viatura dedicada (22 out 2026): campos com valor por omissão, para os pressupostos e cenários já guardados
    # continuarem válidos. A Vitrus confirmou que o saco não pode ir na compactadora do porta a porta.
    on_demand_every_weeks: int = Field(
        default=a.ON_DEMAND_EVERY_WEEKS,
        ge=1,
        le=8,
        description="Recolha a pedido: uma ronda da viatura dedicada por freguesia a cada N semanas",
    )
    vehicle_capex_eur: float = Field(
        default=a.VEHICLE_CAPEX_EUR,
        ge=0,
        description="Preço de uma viatura nova de caixa fechada, sem compactação (€, sem IVA)",
    )
    vehicle_lifetime_years: float = Field(
        default=a.VEHICLE_LIFETIME_YEARS, gt=0, le=30, description="Vida útil da viatura para anualizar o preço"
    )
    vehicle_speed_kmh: float = Field(
        default=a.VEHICLE_SPEED_KMH, gt=0, le=90, description="Velocidade média da viatura em recolha (km/h)"
    )
    door_stop_minutes: float = Field(
        default=a.DOOR_STOP_MINUTES, ge=0, le=30, description="Minutos por saco recolhido à porta"
    )
    site_stop_minutes: float = Field(
        default=a.SITE_STOP_MINUTES, ge=0, le=60, description="Minutos por paragem num local (ponto existente)"
    )
    shift_hours: float = Field(
        default=a.SHIFT_HOURS, gt=0, le=12, description="Horas úteis de um turno da viatura (5 dias por semana)"
    )
    rsu_treatment_eur_per_t: float | None = Field(
        default=a.TREATMENT_EUR_PER_T,
        ge=0,
        description=(
            "Custo de tratamento do indiferenciado por tonelada: 40 €/t de taxa de gestão de resíduos (TGR) + "
            "65,64 €/t da Resinorte = 105,64 €/t (Vitrus, 22 out 2026); nulo = sem poupança no tratamento"
        ),
    )

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
    note: str | None = Field(default=None, description="Fonte em texto, quando o valor ainda está por preencher")


class ParametersOut(BaseModel):
    values: PlanningParams
    version: int
    meta: list[ParamMeta]
    updated_at: datetime


class DoorToDoorPass(BaseModel):
    """Uma passagem semanal de um circuito porta a porta (PAP) da Vitrus numa freguesia."""

    circuit: str
    weekday: int = Field(ge=1, le=7, description="1 = segunda ... 7 = domingo")
    vehicle: str | None = Field(description="Matrícula no planeamento de turnos desse dia (nula: sem linha na folha)")
    crew: int | None = Field(description="Tripulação no planeamento de turnos desse dia")


class ZoneOut(BaseModel):
    code: str
    name: str
    population: int
    population_year: int | None
    demand_t: float
    latitude: float
    longitude: float
    tipau: Tipau | None = Field(description="Tipologia de áreas urbanas do INE")
    service_days: int = Field(
        description=(
            "Dias/semana (distintos) com passagem de um circuito de indiferenciado (porta a porta ou moloks); "
            "orgânico não conta. Hábito de recolha em dias fixos (critério do piloto)"
        )
    )
    area_km2: float | None = Field(
        default=None, description="Área da freguesia (CAOP 2019): volta da viatura dedicada porta a porta"
    )
    existing_containers: int = Field(
        default=0, description="Contentores têxteis ativos já na freguesia (0 se ainda não há localizações)"
    )
    localities: list[str]
    geometry: dict[str, object] | None
    door_to_door: list[DoorToDoorPass] = Field(
        default_factory=list,
        description=(
            "Passagens dos circuitos porta a porta de indiferenciado (a rede atual). Não levam têxtil: o saco "
            "estraga-se na compactadora (Vitrus, 22 out 2026)"
        ),
    )


class ScenarioRequest(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    objective: ScenarioObjective
    budget_eur_year: float | None = Field(default=None, ge=0, description="Custo anual máximo (max_tonnes)")
    target_tonnes: float | None = Field(default=None, ge=0, description="Meta de captura (min_cost)")
    params: PlanningParams | None = Field(default=None, description="Pressupostos; omitido = os do conjunto ativo")
    constraints: dict[str, list[CollectionMode]] = Field(
        default_factory=dict,
        description="Modos permitidos por freguesia (código INE); as freguesias omitidas usam `default_modes`",
    )
    default_modes: list[CollectionMode] = Field(
        default=list(DEFAULT_SCENARIO_MODES),  # o Pydantic copia a lista em cada pedido
        min_length=1,
        description=(
            "Modos permitidos nas freguesias sem restrição em `constraints`. Por omissão `existing` e `on_demand`: a "
            "Vitrus não tem contentores de têxtil; `street` só como referência explícita. Em `sites` o modo dos locais "
            "é `site_mode` e isto só decide se a recolha a pedido pode completar a rede"
        ),
    )
    parent_id: uuid.UUID | None = None
    siting: Siting = Field(
        default="parish",
        description="`parish`: por freguesia (modelo por zonas); `sites`: escolhe locais reais da rede municipal",
    )
    site_radius_m: int = Field(default=300, ge=100, le=1000, description="Distância a pé que um local serve (`sites`)")
    site_on_demand: bool = Field(
        default=True,
        description="Completa a rede de locais com recolha a pedido nas freguesias onde compensa (`sites`)",
    )
    site_candidates: SiteCandidates = Field(
        default="both",
        description=(
            "Candidatos da rede por locais: `both` (por omissão: o que dá mais toneladas e menor €/t), `staffed` "
            "(pontos assistidos: escolas, com pessoas, sem contentor de rua) ou `public` (locais de contentores "
            "municipais na rua, onde a viatura para e recolhe sacos fechados). Os pontos assistidos usam os "
            "pressupostos do modo `existing`; com `site_mode = street` (só referência) os candidatos são sempre os "
            "públicos"
        ),
    )
    site_mode: CollectionMode = Field(
        default=CollectionMode.EXISTING,
        description=(
            "Pressupostos de captura e custo usados nos locais: `existing` (paragem com sacos fechados nos locais "
            "municipais onde a viatura já passa, sem contentor novo) ou `street` (contentor de rua, só referência)"
        ),
    )

    @model_validator(mode="after")
    def _objective_inputs(self) -> Self:
        if self.objective == ScenarioObjective.MAX_TONNES and self.budget_eur_year is None:
            raise ValueError("budget_eur_year is required for max_tonnes")
        if self.objective == ScenarioObjective.MIN_COST and self.target_tonnes is None:
            raise ValueError("target_tonnes is required for min_cost")
        if self.site_mode == CollectionMode.ON_DEMAND:
            raise ValueError("site_mode must be existing or street")
        if self.site_candidates != "public" and self.site_mode != CollectionMode.EXISTING:
            # Um ponto assistido não tem contentor de rua: com `street` (só referência) os candidatos são os públicos.
            if "site_candidates" in self.model_fields_set:
                raise ValueError("staffed points use site_mode existing (a staffed point has no street container)")
            self.site_candidates = "public"
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
    avoided_treatment_eur: float | None = Field(
        default=None,
        description=(
            "Tratamento de indiferenciado evitado: toneladas × `rsu_treatment_eur_per_t` (105,64 €/t, Vitrus). Nulo "
            "sem custo de tratamento (cenários antigos)"
        ),
    )
    net_annual_cost_eur: float | None = Field(
        default=None,
        description=(
            "Custo líquido para o município: custo anual − tratamento evitado (estimativa). Nulo sem custo de "
            "tratamento"
        ),
    )
    net_eur_per_tonne: float | None = Field(
        default=None, description="Custo líquido ÷ toneladas: € por tonelada que o município paga mesmo (estimativa)"
    )
    # Viatura dedicada ao têxtil (22 out 2026). Nulos nos cenários calculados antes (recolha nos circuitos PAP).
    vehicles: int | None = Field(
        default=None, description="Viaturas dedicadas necessárias: ⌈horas por ano ÷ horas de uma viatura⌉"
    )
    vehicle_days_week: float | None = Field(
        default=None, description="Dias de viatura por semana: horas por ano ÷ 52 ÷ horas por turno (5 = uma cheia)"
    )
    vehicle_hours_year: float | None = Field(default=None, description="Horas por ano da viatura dedicada")
    vehicle_capex_eur: float | None = Field(
        default=None, description="Investimento nas viaturas dedicadas (incluído em `capex_eur`)"
    )
    vehicle_annual_eur: float | None = Field(
        default=None, description="Viaturas anualizadas pela vida útil (incluído em `annual_cost_eur`)"
    )
    # Têxtil reutilizável (22 out 2026). Opcionais: os cenários guardados antes continuam válidos (nulo = sem cálculo).
    reuse_share: float | None = Field(
        default=None,
        description=(
            "Quota de reutilização observada em 2025 nas 4 entidades (reutilização ÷ recolhido, 0 a 1), aplicada igual "
            "a todos os modos: não há dado de qualidade por canal (estimativa)"
        ),
    )
    reuse_share_low: float | None = Field(
        default=None,
        description="Menor quota de reutilização entre as entidades com kg exatos por destino (0 a 1, estimativa)",
    )
    reuse_share_high: float | None = Field(
        default=None,
        description="Maior quota de reutilização entre as entidades com kg exatos por destino (0 a 1, estimativa)",
    )
    reusable_t: float | None = Field(
        default=None, description="Têxtil reutilizável por ano: toneladas × `reuse_share` (estimativa)"
    )
    reusable_t_low: float | None = Field(
        default=None, description="Têxtil reutilizável por ano com `reuse_share_low` (estimativa)"
    )
    reusable_t_high: float | None = Field(
        default=None, description="Têxtil reutilizável por ano com `reuse_share_high` (estimativa)"
    )
    eur_per_reusable_t: float | None = Field(
        default=None, description="Custo anual ÷ `reusable_t`: € por tonelada reutilizável (estimativa)"
    )


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
    served_share: float | None = Field(
        default=None,
        description="Cenários por locais: fração da procura da freguesia com um local aberto ao alcance (0 a 1)",
    )


class RouteStop(BaseModel):
    parish_code: str
    parish_name: str
    latitude: float
    longitude: float
    load_t: float
    site_id: str | None = Field(default=None, description="Local da rede municipal (cenários por locais)")
    label: str | None = Field(default=None, description="Rua do local (cenários por locais)")


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


class SiteSelection(BaseModel):
    """Um local aberto num cenário por locais, com o que serve."""

    site_id: str
    kind: Literal["public", "staffed"] = Field(
        default="public", description="`staffed`: ponto assistido (escola), sem contentor de rua"
    )
    producer_types: list[ProducerType] = Field(
        default_factory=list, description="Tipos de produtor no local (pontos assistidos); nunca os nomes"
    )
    latitude: float
    longitude: float
    parish_code: str
    parish_name: str
    street: str | None
    containers: int = Field(description="Contentores municipais que já lá estão (outras frações)")
    coord_precision: Literal["precise", "approximate"]
    tonnes: float = Field(description="Têxtil dos pontos cujo local aberto mais próximo é este (estimativa)")
    population_covered: float
    served_points: int
    vehicle: int | None = Field(description="Viatura da rota que o visita")


class SitingSummary(BaseModel):
    """Como foi escolhida a rede por locais e o que não se sabe."""

    radius_m: int
    site_mode: CollectionMode
    site_candidates: SiteCandidates = Field(default="public", description="Cenários antigos, sem o campo: `public`")
    candidates: int
    staffed_candidates: int = Field(default=0, description="Dos candidatos, quantos são pontos assistidos")
    demand_points: int
    served_points: int
    opened: int
    on_demand: bool = Field(default=False, description="A recolha a pedido podia completar a rede")
    on_demand_zones: int = Field(default=0, description="Freguesias onde a recolha a pedido foi ligada")
    solver_iterations: int
    population_proxy: str


class CollectionPlanEntry(BaseModel):
    """Uma freguesia e um canal no plano da viatura dedicada ao têxtil (nova, de caixa fechada, sem compactação)."""

    parish_code: str
    parish_name: str
    channel: CollectionMode = Field(
        description=(
            "`on_demand`: saco fechado à porta numa ronda da viatura dedicada; `existing`: paragem nos locais "
            "(sacos fechados); `street`: contentor de rua (só referência)"
        )
    )
    weekday: int | None = Field(description="Dia de recolha (1 = segunda ... 5 = sexta); nulo sem horas")
    vehicle: int | None = Field(description="Viatura dedicada (1, 2, ...) que faz a ronda")
    every_weeks: float = Field(description="Uma ronda a cada N semanas")
    rounds_year: float = Field(description="Rondas por ano")
    trips_per_round: int | None = Field(
        description="Viagens ao estaleiro numa ronda porta a porta (carga acima da capacidade); nulo nos locais"
    )
    stops_year: float = Field(description="Sacos à porta ou paragens nos locais por ano")
    tonnes_year: float = Field(description="Têxtil por este canal (estimativa)")
    kg_per_round: float = Field(description="Têxtil por ronda (estimativa)")
    km_year: float = Field(description="Km por ano da viatura dedicada neste canal")
    hours_year: float = Field(description="Horas por ano da viatura dedicada neste canal")


def _drop_legacy_plan(data: object) -> object:
    """Os planos antigos (saco na viatura PAP, 0 km) já não valem: a Vitrus disse que o saco se estraga na
    compactadora. Lidos de cenários guardados, ficam nulos e o ecrã pede para recalcular."""
    if isinstance(data, dict):
        plan = data.get("collection_plan")
        if isinstance(plan, list) and any(isinstance(e, dict) and "rounds_year" not in e for e in plan):
            return {**data, "collection_plan": None}
    return data


class ScenarioResult(BaseModel):
    kpis: Kpis
    allocations: list[Allocation]
    routes: list[RouteOut]
    modes: list[ModeSummary]
    depot: list[float]
    sites: list[SiteSelection] = Field(default_factory=list, description="Locais abertos (só cenários por locais)")
    siting: SitingSummary | None = Field(default=None, description="Preenchido nos cenários por locais")
    default_modes: list[CollectionMode] = Field(
        default_factory=lambda: list(CollectionMode),
        description="Modos permitidos nas freguesias sem restrição (cenários antigos, sem o campo: todos)",
    )
    collection_plan: list[CollectionPlanEntry] | None = Field(
        default=None,
        description=(
            "Plano da viatura dedicada ao têxtil: por freguesia e canal, dia, viatura, rondas, kg por ronda, km e "
            "horas. Nulo nos cenários calculados antes de 22 out 2026 (saco nos circuitos PAP, que a Vitrus excluiu)"
        ),
    )

    @model_validator(mode="before")
    @classmethod
    def _legacy_plan(cls, data: object) -> object:
        return _drop_legacy_plan(data)


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
    siting: Siting = "parish"
    parent_id: uuid.UUID | None
    created_at: datetime
    reference_key: str | None = Field(
        default=None,
        description=(
            "Cenário de referência criado pela aplicação (`sites:<€/ano>` ou `parish:<€/ano>`); nulo nos cenários "
            "dos utilizadores"
        ),
    )


ReferenceStaleReason = Literal["model_version", "parameters", "no_collection_plan", "street"]


class ReferenceScenarioOut(ScenarioSummary):
    """Cenário de referência atual (o mais recente de cada chave)."""

    up_to_date: bool = Field(description="Falso enquanto o arranque o recalcula (o antigo fica até haver o novo)")
    stale_reasons: list[ReferenceStaleReason] = Field(
        description=(
            "Porque está desatualizado: versão do modelo, versão dos pressupostos, sem plano de recolha ou contentor "
            "de rua"
        )
    )
    onboarding: bool = Field(description="O plano por omissão do ecrã inicial e da introdução guiada")


class ScenarioOut(ScenarioSummary):
    solver_status: Literal["optimal", "feasible", "infeasible"]
    params: PlanningParams
    constraints: dict[str, list[CollectionMode]]
    result: ScenarioResult

    def siting_options(self) -> dict[str, object]:
        """Campos de `ScenarioRequest` que repetem os modos e a rede por locais ao duplicar ou alterar este cenário."""
        s = self.result.siting
        if s is None:
            return {"default_modes": self.result.default_modes}
        return {
            "default_modes": self.result.default_modes,
            "siting": "sites",
            "site_candidates": s.site_candidates,
            "site_radius_m": s.radius_m,
            "site_mode": s.site_mode,
            "site_on_demand": s.on_demand,
        }
