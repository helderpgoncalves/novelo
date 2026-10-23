"""Modelo da rede de recolha: opções por zona, otimização (MIP) e rotas (VRP). Funções puras, sem I/O.

Fórmulas e pressupostos: docs/engenharia/dados-e-modelo.md.

  procura da zona         D_z = P_z · q · 12 / 1000                (t/ano)
  têxtil captado          C_z,m = D_z · c_m · f_m                  (t/ano)
  custo anual da opção    capex/N + recolhas · c_recolha + km · c_km
  viatura dedicada        ⌈horas ÷ horas de uma viatura⌉ · (capex da viatura ÷ vida útil)
  custo por tonelada      custo anual total / toneladas captadas

Toda a recolha é feita por uma viatura NOVA, dedicada ao têxtil e sem compactação, a partir do estaleiro (Vitrus,
22 out 2026: o saco não pode ir na compactadora do porta a porta). Ver `domain/fleet.py`.

Cada zona (freguesia) escolhe uma COMBINAÇÃO de modos (ou nenhum). Os canais captam de forma independente,
por isso o têxtil captado por uma combinação S é

  C_z,S = D_z · (1 − Π_{m∈S} (1 − c_m · f_m))

e os custos somam. É um problema de escolha múltipla com orçamento, que o CP-SAT do OR-Tools resolve de
forma exata para as 48 freguesias de Guimarães, com o número de viaturas dedicadas como variável inteira.
"""

from __future__ import annotations

import math
from collections.abc import Collection, Sequence
from dataclasses import dataclass, field, replace
from itertools import combinations
from typing import Literal

from ortools.constraint_solver import pywrapcp, routing_enums_pb2
from ortools.sat.python import cp_model

from novelo.domain import fleet, routing
from novelo.domain.demand import yearly_demand_t
from novelo.domain.geo import haversine_km, simplify_polyline
from novelo.domain.routing import PlanSource, RoadRouter, RoutingSource
from novelo.domain.vocab import CollectionMode as Mode

SCALE_T = 1000  # toneladas -> quilogramas inteiros no solver
SCALE_EUR = 100  # euros -> cêntimos inteiros no solver
SCALE_H = 100  # horas -> centésimas de hora no solver
PATH_TOLERANCE_M = 3.0  # o traçado por estrada perde os pontos a menos de 3 m da reta (guarda-se em cada cenário)


@dataclass(frozen=True)
class ModeParams:
    capture_rate: float  # fração do têxtil gerado que o modo capta (0 a 1)
    coverage_factor: float  # fração da população da zona que o modo serve (distância a pé)
    capex_per_point_eur: float
    people_per_point: int  # 1 ponto por cada N habitantes (mínimo `min_points`)
    min_points: int
    lifetime_years: float
    collections_per_year: float  # recolhas por ano de cada ponto (o modo a pedido usa `on_demand_every_weeks`)


@dataclass(frozen=True)
class Params:
    kg_per_inhab_month: float
    modes: dict[Mode, ModeParams]
    cost_per_collection_eur: float  # custo de uma recolha num ponto ou de um saco à porta (tripulação e tempo)
    cost_per_km_eur: float
    detour_factor: float  # estrada real / linha reta
    on_demand_kg_per_pickup: float
    vehicle_capacity_t: float  # carga útil da viatura dedicada
    depot: tuple[float, float]
    # Viatura dedicada ao têxtil, sem compactação (Vitrus, 22 out 2026). Valores por omissão = sem viatura a pagar,
    # para os testes de fórmulas; os pressupostos do simulador vêm de `features/planning/params.py`.
    on_demand_every_weeks: float = 2.0  # uma ronda porta a porta por freguesia a cada N semanas
    vehicle_capex_eur: float = 0.0
    vehicle_lifetime_years: float = 8.0
    vehicle_speed_kmh: float = 30.0
    door_stop_minutes: float = 2.0  # paragem para levar um saco à porta
    site_stop_minutes: float = 10.0  # paragem num local (ponto existente ou contentor)
    shift_hours: float = 7.0  # horas úteis de um turno da viatura
    # Motor de rotas por estrada (OSRM), injetado pelo serviço. Sem ele (testes, OSRM em baixo) os km são estimativa
    # (linha reta × `detour_factor`). Fora da igualdade e do repr: não é um pressuposto, é uma dependência.
    road: RoadRouter | None = field(default=None, compare=False, repr=False)

    @property
    def vehicle_annual_eur(self) -> float:
        return fleet.annuity_eur(self.vehicle_capex_eur, self.vehicle_lifetime_years)

    def stop_minutes(self, mode: Mode) -> float:
        return self.door_stop_minutes if mode == Mode.ON_DEMAND else self.site_stop_minutes


@dataclass(frozen=True)
class Zone:
    id: str
    name: str
    population: int
    lat: float
    lon: float
    service_days: int  # dias por semana em que já passa um circuito de indiferenciado da Vitrus (0 a 7)
    existing_points: int | None = None  # contentores têxteis ativos já na freguesia (None = sem dados)
    area_km2: float | None = None  # área da freguesia (CAOP 2019): volta da viatura porta a porta
    road_round_trip_km: float | None = None  # ida e volta estaleiro-freguesia por estrada (OSRM); None = estimativa


@dataclass(frozen=True)
class ModeCost:
    """Custo e alcance de UM modo numa zona (as peças que compõem uma opção)."""

    mode: Mode
    points: int
    capture: float  # c_m · f_m: fração do têxtil da zona que este canal capta sozinho
    population_covered: float
    capex_eur: float
    opex_eur_year: float  # recolhas + km (estimativa radial, usada na escolha)
    annual_cost_eur: float  # capex anualizado + opex
    km_year: float
    collections_year: float  # paragens por ano: recolhas nos pontos ou sacos à porta
    hours_year: float = 0.0  # horas da viatura dedicada
    rounds_year: float = 0.0  # rondas por ano (todas as paragens da zona numa ronda)
    trips_per_round: int = 0  # viagens ao estaleiro numa ronda (carga acima da capacidade)


@dataclass(frozen=True)
class Option:
    """Uma combinação de modos numa zona."""

    zone_id: str
    parts: tuple[ModeCost, ...]
    tonnes: float
    population_covered: float

    @property
    def modes(self) -> tuple[Mode, ...]:
        return tuple(p.mode for p in self.parts)

    @property
    def capex_eur(self) -> float:
        return sum(p.capex_eur for p in self.parts)

    @property
    def annual_cost_eur(self) -> float:
        return sum(p.annual_cost_eur for p in self.parts)

    @property
    def km_year(self) -> float:
        return sum(p.km_year for p in self.parts)

    @property
    def hours_year(self) -> float:
        return sum(p.hours_year for p in self.parts)


def zone_demand_t(zone: Zone, params: Params) -> float:
    return yearly_demand_t(zone.population, params.kg_per_inhab_month)


def radial_km(zone: Zone, params: Params) -> float:
    """Ida e volta estaleiro-zona: por estrada quando o OSRM respondeu, senão linha reta × desvio."""
    if zone.road_round_trip_km is not None:
        return zone.road_round_trip_km
    d = haversine_km(params.depot[0], params.depot[1], zone.lat, zone.lon)
    return 2 * d * params.detour_factor


def with_road_distances(zones: Sequence[Zone], params: Params) -> list[Zone]:
    """Põe em cada zona a ida e volta ao estaleiro por estrada (uma só chamada ao router). Sem router, devolve igual.

    Zonas sem caminho (centróide fora da rede) ficam com a estimativa. O CP-SAT escolhe a rede com estes km, por isso
    os custos da escolha e os das rotas finais partem da mesma estrada.
    """
    if params.road is None or not zones:
        return list(zones)
    nodes = [params.depot, *[(z.lat, z.lon) for z in zones]]
    m = routing.resolve(nodes, params.road.matrix(nodes), params.detour_factor, params.vehicle_speed_kmh)
    out: list[Zone] = []
    for i, zone in enumerate(zones, start=1):
        if m.exact[0][i] and m.exact[i][0]:
            out.append(replace(zone, road_round_trip_km=(m.distance_m[0][i] + m.distance_m[i][0]) / 1000))
        else:
            out.append(zone)
    return out


def part_hours(mode: Mode, km_year: float, stops_year: float, params: Params) -> float:
    """Horas por ano da viatura dedicada num canal: km ÷ velocidade + paragens · minutos ÷ 60."""
    return fleet.hours(km_year, stops_year, params.vehicle_speed_kmh, params.stop_minutes(mode))


def mode_cost(zone: Zone, mode: Mode, params: Params) -> ModeCost:
    mp = params.modes[mode]
    capture = mp.capture_rate * mp.coverage_factor
    tonnes = zone_demand_t(zone, params) * capture  # o que este canal captaria sozinho
    covered = zone.population * mp.coverage_factor
    round_trip = radial_km(zone, params)

    if mode == Mode.ON_DEMAND:
        # Saco fechado à porta, recolhido pela viatura dedicada numa ronda por freguesia a cada N semanas.
        pickups = tonnes * 1000 / params.on_demand_kg_per_pickup
        rounds = fleet.rounds_per_year(params.on_demand_every_weeks) if tonnes > 0 else 0.0
        trips = 0
        km = 0.0
        if rounds:
            trips = fleet.trips_per_round(tonnes * 1000 / rounds, params.vehicle_capacity_t * 1000)
            tour = fleet.tour_km(pickups / rounds, zone.area_km2, params.detour_factor)
            km = rounds * (trips * round_trip + tour)
        opex = pickups * params.cost_per_collection_eur + km * params.cost_per_km_eur
        return ModeCost(
            mode=mode,
            points=0,
            capture=capture,
            population_covered=covered,
            capex_eur=0.0,
            opex_eur_year=opex,
            annual_cost_eur=opex,
            km_year=km,
            collections_year=pickups,
            hours_year=part_hours(mode, km, pickups, params),
            rounds_year=rounds,
            trips_per_round=trips,
        )

    if mode == Mode.EXISTING and zone.existing_points:
        points = zone.existing_points  # localizações reais da Vitrus em vez da densidade assumida
    else:
        points = max(mp.min_points, math.ceil(zone.population / mp.people_per_point))
    collections = points * mp.collections_per_year
    # Uma ronda por frequência: os pontos da zona são recolhidos na mesma viagem.
    km = mp.collections_per_year * round_trip
    capex = points * mp.capex_per_point_eur
    opex = collections * params.cost_per_collection_eur + km * params.cost_per_km_eur
    return ModeCost(
        mode=mode,
        points=points,
        capture=capture,
        population_covered=covered,
        capex_eur=capex,
        opex_eur_year=opex,
        annual_cost_eur=capex / mp.lifetime_years + opex,
        km_year=km,
        collections_year=collections,
        hours_year=part_hours(mode, km, collections, params),
        rounds_year=mp.collections_per_year,
        trips_per_round=1 if mp.collections_per_year > 0 else 0,
    )


def build_option(zone: Zone, modes: tuple[Mode, ...], params: Params) -> Option:
    """Opção (zona, combinação de modos): toneladas por captura independente, custos somados."""
    parts = tuple(mode_cost(zone, m, params) for m in modes)
    miss = 1.0
    uncovered = 1.0
    for p in parts:
        miss *= 1 - p.capture
        uncovered *= 1 - p.population_covered / zone.population if zone.population else 1.0
    return Option(
        zone_id=zone.id,
        parts=parts,
        tonnes=zone_demand_t(zone, params) * (1 - miss),
        population_covered=zone.population * (1 - uncovered),
    )


def build_options(
    zones: list[Zone],
    params: Params,
    allowed: dict[str, set[Mode]] | None = None,
    default_modes: Collection[Mode] | None = None,
) -> list[Option]:
    """Todas as combinações de modos por zona.

    `allowed` restringe os modos por zona (ex.: "só a pedido em Serzedelo"); as zonas sem entrada usam `default_modes`
    (omitido = todos os modos).
    """
    fallback = set(default_modes) if default_modes is not None else set(Mode)
    options = []
    for zone in zones:
        modes = [m for m in Mode if m in (allowed or {}).get(zone.id, fallback)]
        for size in range(1, len(modes) + 1):
            options += [build_option(zone, combo, params) for combo in combinations(modes, size)]
    return options


@dataclass(frozen=True)
class FleetCost:
    """Viaturas dedicadas no MIP: custo anual de cada uma e horas úteis por ano."""

    annual_eur_per_vehicle: float
    hours_per_vehicle_year: float


def fleet_cost(params: Params) -> FleetCost:
    return FleetCost(params.vehicle_annual_eur, fleet.hours_per_vehicle_year(params.shift_hours))


Objective = Literal["max_tonnes", "min_cost"]


@dataclass(frozen=True)
class SolveResult:
    chosen: list[Option]
    status: Literal["optimal", "feasible", "infeasible"]
    objective: Objective
    vehicles: int = 0  # viaturas dedicadas que o MIP pagou (as horas reais, depois do VRP, podem pedir menos)


def solve(
    options: list[Option],
    objective: Objective,
    *,
    budget_eur_year: float | None = None,
    target_tonnes: float | None = None,
    time_limit_s: float = 20.0,
    seed: int = 7,
    vehicles: FleetCost | None = None,
) -> SolveResult:
    """Escolhe no máximo um modo por zona.

    - `max_tonnes`: maximiza as toneladas com custo anual total <= `budget_eur_year`.
    - `min_cost`: minimiza o custo anual total garantindo toneladas >= `target_tonnes`.

    Com `vehicles`, o número de viaturas dedicadas `V` é uma variável inteira: as horas das opções escolhidas cabem em
    `V · horas de uma viatura`, há pelo menos uma viatura logo que se recolha alguma coisa, e o custo soma `V · custo
    anual de uma viatura`.
    """
    model = cp_model.CpModel()
    pick = {i: model.new_bool_var(f"x{i}") for i in range(len(options))}
    by_zone: dict[str, list[int]] = {}
    for i, o in enumerate(options):
        by_zone.setdefault(o.zone_id, []).append(i)
    for idx in by_zone.values():
        model.add_at_most_one(pick[i] for i in idx)

    tonnes = [round(o.tonnes * SCALE_T) for o in options]
    cost = [round(o.annual_cost_eur * SCALE_EUR) for o in options]
    total_t = sum(tonnes[i] * pick[i] for i in pick)
    total_c = sum(cost[i] * pick[i] for i in pick)

    v_var: cp_model.IntVar | None = None
    if vehicles is not None and options:
        h_unit = max(1, round(vehicles.hours_per_vehicle_year * SCALE_H))
        by_zone_max = sum(max(options[i].hours_year for i in idx) for idx in by_zone.values())
        upper = max(1, math.ceil(by_zone_max * SCALE_H / h_unit))
        v_var = model.new_int_var(0, upper, "vehicles")
        hours = [round(o.hours_year * SCALE_H) for o in options]
        model.add(sum(hours[i] * pick[i] for i in pick) <= h_unit * v_var)
        for var in pick.values():
            model.add(v_var >= 1).only_enforce_if(var)
        total_c = total_c + round(vehicles.annual_eur_per_vehicle * SCALE_EUR) * v_var

    if objective == "max_tonnes":
        if budget_eur_year is None:
            raise ValueError("max_tonnes exige budget_eur_year")
        model.add(total_c <= round(budget_eur_year * SCALE_EUR))
        # Desempate: a igualdade de toneladas, o mais barato (peso pequeno face a 1 kg).
        model.maximize(total_t * 1_000_000 - total_c)
    else:
        if target_tonnes is None:
            raise ValueError("min_cost exige target_tonnes")
        model.add(total_t >= round(target_tonnes * SCALE_T))
        model.minimize(total_c)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_s
    solver.parameters.random_seed = seed
    solver.parameters.num_workers = 1  # determinismo: mesma entrada, mesmo cenário
    solver.parameters.relative_gap_limit = 1e-3  # 0,1% do ótimo chega: evita provar o ótimo até ao último cêntimo
    status = solver.solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return SolveResult([], "infeasible", objective)
    chosen = [options[i] for i in pick if solver.value(pick[i])]
    n_vehicles = int(solver.value(v_var)) if v_var is not None else 0
    return SolveResult(chosen, "optimal" if status == cp_model.OPTIMAL else "feasible", objective, n_vehicles)


# --- Rotas (VRP) -----------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Stop:
    zone_id: str
    lat: float
    lon: float
    load_t: float  # toneladas recolhidas numa ronda


@dataclass(frozen=True)
class Route:
    vehicle: int
    stops: list[str]  # zone_ids, por ordem de visita
    km: float
    load_t: float
    path: list[tuple[float, float]] = field(default_factory=list)  # (lat, lon): depósito -> paragens -> depósito
    duration_s: float | None = None  # só a condução, por estrada, sem paragens nem trânsito; None = estimativa
    source: RoutingSource = "estimate"  # "road": todos os troços (km) vêm da estrada
    road_path: bool = False  # `path` segue as estradas; False = linhas retas entre as paragens


@dataclass(frozen=True)
class RoutePlan:
    routes: list[Route]
    km_per_round: float
    source: PlanSource = "estimate"  # "road" só se todas as rotas o são
    duration_s: float | None = None  # soma da condução das rotas (None se alguma é estimativa)


def plan_routes(
    stops: list[Stop],
    params: Params,
    *,
    max_vehicles: int = 6,
    time_limit_s: int = 5,
) -> RoutePlan:
    """VRP com capacidade: quantas viagens e que ordem, minimizando os quilómetros de uma ronda.

    Cada "veículo" do VRP é uma viagem a partir do estaleiro (a mesma viatura dedicada pode fazer várias, em dias
    diferentes); há sempre viagens suficientes para a carga da ronda.
    """
    if not stops:
        return RoutePlan([], 0.0)
    total_load = sum(s.load_t for s in stops)
    max_vehicles = max(max_vehicles, math.ceil(total_load / params.vehicle_capacity_t) + 2)
    nodes = [(params.depot[0], params.depot[1]), *[(s.lat, s.lon) for s in stops]]
    # Distâncias em metros inteiros (o solver só trabalha com inteiros): por estrada (OSRM) onde houver caminho e,
    # nos pares sem caminho ou sem OSRM, linha reta × desvio da estrada.
    road = params.road.matrix(nodes) if params.road is not None else None
    matrix = routing.resolve(nodes, road, params.detour_factor, params.vehicle_speed_kmh)
    dist = matrix.distance_m
    demand = [0] + [max(1, round(s.load_t * SCALE_T)) for s in stops]
    capacity = round(params.vehicle_capacity_t * SCALE_T)
    # Uma só paragem que já enche o camião não pode ficar de fora: a capacidade efetiva sobe até ela.
    capacity = max(capacity, *demand)

    manager = pywrapcp.RoutingIndexManager(len(nodes), max_vehicles, 0)
    routing_model = pywrapcp.RoutingModel(manager)
    transit = routing_model.RegisterTransitCallback(lambda i, j: dist[manager.IndexToNode(i)][manager.IndexToNode(j)])
    routing_model.SetArcCostEvaluatorOfAllVehicles(transit)
    load = routing_model.RegisterUnaryTransitCallback(lambda i: demand[manager.IndexToNode(i)])
    routing_model.AddDimensionWithVehicleCapacity(load, 0, [capacity] * max_vehicles, True, "Capacity")
    # Pequena penalização por veículo usado: prefere menos camiões a igualdade de quilómetros.
    routing_model.SetFixedCostOfAllVehicles(1000)

    search = pywrapcp.DefaultRoutingSearchParameters()
    search.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    search.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    search.time_limit.seconds = time_limit_s
    solution = routing_model.SolveWithParameters(search)
    if solution is None:
        raise RuntimeError("O VRP não encontrou solução")

    routes: list[Route] = []
    for v in range(max_vehicles):
        index = routing_model.Start(v)
        visited: list[int] = []
        load_kg = 0
        while not routing_model.IsEnd(index):
            node = manager.IndexToNode(index)
            if node != 0:
                visited.append(node)
                load_kg += demand[node]
            index = solution.Value(routing_model.NextVar(index))
        if not visited:
            continue
        order = [0, *visited, 0]
        straight = [nodes[n] for n in order]
        exact = matrix.arcs_exact(order)
        traced = params.road.geometry(straight) if exact and params.road is not None else None
        routes.append(
            Route(
                vehicle=len(routes) + 1,
                stops=[stops[n - 1].zone_id for n in visited],
                km=matrix.length_m(order) / 1000,
                load_t=load_kg / SCALE_T,
                path=simplify_polyline(traced, PATH_TOLERANCE_M) if traced else straight,
                duration_s=float(matrix.duration_of_s(order)) if exact else None,
                source="road" if exact else "estimate",
                road_path=traced is not None,
            )
        )
    duration = None if any(r.duration_s is None for r in routes) else sum(r.duration_s or 0.0 for r in routes)
    return RoutePlan(
        routes,
        sum(r.km for r in routes),
        source=routing.overall_source([r.source for r in routes]),
        duration_s=duration,
    )
