"""Modelo da rede de recolha: opções por zona, otimização (MIP) e rotas (VRP). Funções puras, sem I/O.

Fórmulas e pressupostos: docs/engenharia/dados-e-modelo.md.

  procura da zona         D_z = P_z · q · 12 / 1000                (t/ano)
  têxtil captado          C_z,m = D_z · c_m · f_m                  (t/ano)
  custo anual da opção    capex/N + recolhas · c_recolha + km · c_km
  custo por tonelada      custo anual total / toneladas captadas

Cada zona (freguesia) escolhe uma COMBINAÇÃO de modos (ou nenhum). Os canais captam de forma independente,
por isso o têxtil captado por uma combinação S é

  C_z,S = D_z · (1 − Π_{m∈S} (1 − c_m · f_m))

e os custos somam. É um problema de escolha múltipla com orçamento, que o CP-SAT do OR-Tools resolve de
forma exata para as 48 freguesias de Guimarães.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from itertools import combinations
from typing import Literal

from ortools.constraint_solver import pywrapcp, routing_enums_pb2
from ortools.sat.python import cp_model

from novelo.domain.demand import yearly_demand_t
from novelo.domain.geo import haversine_km
from novelo.domain.vocab import CollectionMode as Mode

SCALE_T = 1000  # toneladas -> quilogramas inteiros no solver
SCALE_EUR = 100  # euros -> cêntimos inteiros no solver


@dataclass(frozen=True)
class ModeParams:
    capture_rate: float  # fração do têxtil gerado que o modo capta (0 a 1)
    coverage_factor: float  # fração da população da zona que o modo serve (distância a pé)
    capex_per_point_eur: float
    people_per_point: int  # 1 ponto por cada N habitantes (mínimo `min_points`)
    min_points: int
    lifetime_years: float
    collections_per_year: float  # recolhas por ano de cada ponto (ou pedidos médios, no modo a pedido)


@dataclass(frozen=True)
class Params:
    kg_per_inhab_month: float
    modes: dict[Mode, ModeParams]
    cost_per_collection_eur: float  # custo de uma recolha num ponto (tripulação e tempo)
    cost_per_km_eur: float
    detour_factor: float  # estrada real / linha reta
    on_demand_kg_per_pickup: float
    piggyback_extra_km: float  # desvio médio quando já passa um circuito
    piggyback_min_days: int  # dias/semana de circuito para a recolha a pedido "aproveitar" a rota
    vehicle_capacity_t: float
    depot: tuple[float, float]


@dataclass(frozen=True)
class Zone:
    id: str
    name: str
    population: int
    lat: float
    lon: float
    service_days: int  # dias por semana em que já passa um circuito da Vitrus (0 a 7)


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
    collections_year: float


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


def zone_demand_t(zone: Zone, params: Params) -> float:
    return yearly_demand_t(zone.population, params.kg_per_inhab_month)


def radial_km(zone: Zone, params: Params) -> float:
    """Ida e volta ao depósito, em estrada (linha reta x desvio)."""
    d = haversine_km(params.depot[0], params.depot[1], zone.lat, zone.lon)
    return 2 * d * params.detour_factor


def mode_cost(zone: Zone, mode: Mode, params: Params) -> ModeCost:
    mp = params.modes[mode]
    capture = mp.capture_rate * mp.coverage_factor
    tonnes = zone_demand_t(zone, params) * capture  # o que este canal captaria sozinho
    covered = zone.population * mp.coverage_factor
    round_trip = radial_km(zone, params)

    if mode == Mode.ON_DEMAND:
        pickups = tonnes * 1000 / params.on_demand_kg_per_pickup
        piggyback = zone.service_days >= params.piggyback_min_days
        km = pickups * (params.piggyback_extra_km if piggyback else round_trip)
        return ModeCost(
            mode=mode,
            points=0,
            capture=capture,
            population_covered=covered,
            capex_eur=0.0,
            opex_eur_year=pickups * params.cost_per_collection_eur + km * params.cost_per_km_eur,
            annual_cost_eur=pickups * params.cost_per_collection_eur + km * params.cost_per_km_eur,
            km_year=km,
            collections_year=pickups,
        )

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


def build_options(zones: list[Zone], params: Params, allowed: dict[str, set[Mode]] | None = None) -> list[Option]:
    """Todas as combinações de modos por zona. `allowed` restringe os modos (ex.: "só a pedido em Serzedelo")."""
    options = []
    for zone in zones:
        modes = [m for m in Mode if m in (allowed.get(zone.id, set(Mode)) if allowed else set(Mode))]
        for size in range(1, len(modes) + 1):
            options += [build_option(zone, combo, params) for combo in combinations(modes, size)]
    return options


Objective = Literal["max_tonnes", "min_cost"]


@dataclass(frozen=True)
class SolveResult:
    chosen: list[Option]
    status: Literal["optimal", "feasible", "infeasible"]
    objective: Objective


def solve(
    options: list[Option],
    objective: Objective,
    *,
    budget_eur_year: float | None = None,
    target_tonnes: float | None = None,
    time_limit_s: float = 20.0,
    seed: int = 7,
) -> SolveResult:
    """Escolhe no máximo um modo por zona.

    - `max_tonnes`: maximiza as toneladas com custo anual total <= `budget_eur_year`.
    - `min_cost`: minimiza o custo anual total garantindo toneladas >= `target_tonnes`.
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
    return SolveResult(chosen, "optimal" if status == cp_model.OPTIMAL else "feasible", objective)


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


@dataclass(frozen=True)
class RoutePlan:
    routes: list[Route]
    km_per_round: float


def plan_routes(
    stops: list[Stop],
    params: Params,
    *,
    max_vehicles: int = 6,
    time_limit_s: int = 5,
) -> RoutePlan:
    """VRP com capacidade: quantos camiões e que ordem, minimizando os quilómetros de uma ronda."""
    if not stops:
        return RoutePlan([], 0.0)
    nodes = [(params.depot[0], params.depot[1]), *[(s.lat, s.lon) for s in stops]]
    # Distâncias em metros inteiros (o solver só trabalha com inteiros), com o desvio da estrada.
    dist = [[round(haversine_km(a[0], a[1], b[0], b[1]) * params.detour_factor * 1000) for b in nodes] for a in nodes]
    demand = [0] + [max(1, round(s.load_t * SCALE_T)) for s in stops]
    capacity = round(params.vehicle_capacity_t * SCALE_T)
    # Uma só paragem que já enche o camião não pode ficar de fora: a capacidade efetiva sobe até ela.
    capacity = max(capacity, *demand)

    manager = pywrapcp.RoutingIndexManager(len(nodes), max_vehicles, 0)
    routing = pywrapcp.RoutingModel(manager)
    transit = routing.RegisterTransitCallback(lambda i, j: dist[manager.IndexToNode(i)][manager.IndexToNode(j)])
    routing.SetArcCostEvaluatorOfAllVehicles(transit)
    load = routing.RegisterUnaryTransitCallback(lambda i: demand[manager.IndexToNode(i)])
    routing.AddDimensionWithVehicleCapacity(load, 0, [capacity] * max_vehicles, True, "Capacity")
    # Pequena penalização por veículo usado: prefere menos camiões a igualdade de quilómetros.
    routing.SetFixedCostOfAllVehicles(1000)

    search = pywrapcp.DefaultRoutingSearchParameters()
    search.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    search.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    search.time_limit.seconds = time_limit_s
    solution = routing.SolveWithParameters(search)
    if solution is None:
        raise RuntimeError("O VRP não encontrou solução")

    routes: list[Route] = []
    for v in range(max_vehicles):
        index = routing.Start(v)
        visited: list[int] = []
        meters = 0
        load_kg = 0
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            if node != 0:
                visited.append(node)
                load_kg += demand[node]
            nxt = solution.Value(routing.NextVar(index))
            meters += routing.GetArcCostForVehicle(index, nxt, v)
            index = nxt
        if visited:
            path = [params.depot, *[(stops[n - 1].lat, stops[n - 1].lon) for n in visited], params.depot]
            routes.append(
                Route(
                    vehicle=len(routes) + 1,
                    stops=[stops[n - 1].zone_id for n in visited],
                    km=meters / 1000,
                    load_t=load_kg / SCALE_T,
                    path=path,
                )
            )
    return RoutePlan(routes, sum(r.km for r in routes))
