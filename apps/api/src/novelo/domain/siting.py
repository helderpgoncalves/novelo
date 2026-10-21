"""Rede por locais reais: escolhe QUE locais abrir (não só que freguesias servir). Funções puras, sem I/O.

Os locais candidatos são os pontos de recolha municipais que a Vitrus enviou (`municipal_sites`). Cada habitante é
representado pelos locais públicos da sua freguesia: a procura de uma freguesia reparte-se pelos seus locais públicos
na proporção do número de contentores que lá estão (os contentores seguem a população: ver `domain/validation.py`).
É um proxy, não população por quarteirão (esse dado, o BGRI, não chegou): o resultado leva "estimativa".

Um ponto de procura fica servido se houver um local aberto a menos de `radius_m`. Vários locais a servir a mesma
pessoa não captam duas vezes (cobertura por união, não por canais independentes como no modelo por freguesia).

  têxtil do ponto i       t_i = D_z · (w_i / Σ_z w) · c               (t/ano; c = taxa de captura do modo)
  custo fixo do local j   capex/N + recolhas/ano · c_recolha
  km                      o VRP sobre os locais abertos dá os km de uma ronda; km/ano = rondas · km_ronda

O CP-SAT resolve a cobertura máxima com orçamento (ou o custo mínimo para uma meta). Como os km não são lineares nos
locais escolhidos, o orçamento do solver desce até o custo real (fixo + km das rotas) caber no pedido.
"""

from __future__ import annotations

import math
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Literal

from ortools.sat.python import cp_model

from novelo.domain import network
from novelo.domain.geo import haversine_km

SCALE_KG = 1000  # t -> kg inteiros no solver
SCALE_EUR = 100
GRID_DEG = 0.02  # ~2,2 km: maior que o raio máximo (1 000 m), por isso bastam as 3×3 células vizinhas
MAX_BUDGET_ITERATIONS = 6


@dataclass(frozen=True)
class DemandPoint:
    id: str
    zone_id: str
    lat: float
    lon: float
    weight: float  # contentores no local (proxy da população que o usa)


@dataclass(frozen=True)
class Candidate:
    id: str
    zone_id: str
    lat: float
    lon: float


@dataclass(frozen=True)
class SiteCosts:
    """Custos de UM local: o que não depende dos km."""

    capex_eur: float
    annual_fixed_eur: float  # capex anualizado + recolhas
    collections_year: float


def distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    return haversine_km(lat1, lon1, lat2, lon2) * 1000


def neighbours(demand: Sequence[DemandPoint], candidates: Sequence[Candidate], radius_m: float) -> list[list[int]]:
    """Para cada ponto de procura, os índices dos candidatos a menos de `radius_m` (grelha para não comparar tudo)."""
    grid: dict[tuple[int, int], list[int]] = defaultdict(list)
    for j, c in enumerate(candidates):
        grid[(math.floor(c.lat / GRID_DEG), math.floor(c.lon / GRID_DEG))].append(j)
    out: list[list[int]] = []
    for d in demand:
        gx, gy = math.floor(d.lat / GRID_DEG), math.floor(d.lon / GRID_DEG)
        near = [
            j
            for dx in (-1, 0, 1)
            for dy in (-1, 0, 1)
            for j in grid.get((gx + dx, gy + dy), ())
            if distance_m(d.lat, d.lon, candidates[j].lat, candidates[j].lon) <= radius_m
        ]
        out.append(sorted(near))
    return out


def point_tonnes(demand: Sequence[DemandPoint], zone_demand_t: dict[str, float], capture_rate: float) -> list[float]:
    """Têxtil captado em cada ponto SE estiver servido: a procura da freguesia repartida pelo peso dos seus pontos."""
    total_w: dict[str, float] = defaultdict(float)
    for d in demand:
        total_w[d.zone_id] += d.weight
    return [
        zone_demand_t.get(d.zone_id, 0.0) * d.weight / total_w[d.zone_id] * capture_rate if total_w[d.zone_id] else 0.0
        for d in demand
    ]


@dataclass(frozen=True)
class CoverageSolution:
    chosen: tuple[int, ...]  # índices dos candidatos
    status: Literal["optimal", "feasible", "infeasible"]


def solve_coverage(
    tonnes: Sequence[float],
    near: Sequence[Sequence[int]],
    site_cost_eur: Sequence[float],
    objective: Literal["max_tonnes", "min_cost"],
    *,
    budget_eur: float | None = None,
    target_tonnes: float | None = None,
    time_limit_s: float = 10.0,
    seed: int = 7,
) -> CoverageSolution:
    """Cobertura máxima com orçamento, ou custo mínimo para uma meta, sobre os locais candidatos."""
    model = cp_model.CpModel()
    usable = sorted({j for row in near for j in row})
    x = {j: model.new_bool_var(f"x{j}") for j in usable}
    served = {}
    for i, row in enumerate(near):
        if row and tonnes[i] > 0:
            y = model.new_bool_var(f"y{i}")
            model.add(sum(x[j] for j in row) >= 1).only_enforce_if(y)
            served[i] = y
    kg = {i: round(tonnes[i] * SCALE_KG) for i in served}
    total_kg = sum(kg[i] * served[i] for i in served)
    cents = {j: round(site_cost_eur[j] * SCALE_EUR) for j in usable}
    total_c = sum(cents[j] * x[j] for j in usable)

    if objective == "max_tonnes":
        if budget_eur is None:
            raise ValueError("max_tonnes exige budget_eur")
        model.add(total_c <= round(budget_eur * SCALE_EUR))
        # Desempate: a igualdade de kg, o mais barato (1 kg vale mais do que qualquer poupança possível).
        model.maximize(total_kg * 1_000_000 - total_c)
    else:
        if target_tonnes is None:
            raise ValueError("min_cost exige target_tonnes")
        model.add(total_kg >= round(target_tonnes * SCALE_KG))
        model.minimize(total_c)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_s
    solver.parameters.random_seed = seed
    solver.parameters.num_workers = 1
    solver.parameters.relative_gap_limit = 5e-3
    status = solver.solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return CoverageSolution((), "infeasible")
    chosen = tuple(j for j in usable if solver.value(x[j]))
    return CoverageSolution(chosen, "optimal" if status == cp_model.OPTIMAL else "feasible")


@dataclass(frozen=True)
class SiteResult:
    candidate: Candidate
    tonnes: float  # têxtil dos pontos cujo local aberto mais próximo é este
    population_covered: float
    served_points: int


@dataclass(frozen=True)
class SitePlan:
    sites: list[SiteResult]
    status: Literal["optimal", "feasible", "infeasible"]
    tonnes: float
    population_covered: float
    served_points: int
    total_points: int
    fixed_cost_eur: float  # custo anual sem km (capex anualizado + recolhas)
    km_year: float
    cost_km_eur: float
    routes: list[network.Route] = field(default_factory=list)
    zone_tonnes: dict[str, float] = field(default_factory=dict)
    zone_population_covered: dict[str, float] = field(default_factory=dict)
    iterations: int = 1

    @property
    def annual_cost_eur(self) -> float:
        return self.fixed_cost_eur + self.cost_km_eur


def assign_to_nearest(
    chosen: Sequence[int], near: Sequence[Sequence[int]], demand: Sequence[DemandPoint], candidates: Sequence[Candidate]
) -> list[int | None]:
    """O local aberto mais próximo de cada ponto servido (None = sem local aberto ao alcance)."""
    open_set = set(chosen)
    out: list[int | None] = []
    for i, row in enumerate(near):
        options = [j for j in row if j in open_set]
        out.append(
            min(options, key=lambda j: distance_m(demand[i].lat, demand[i].lon, candidates[j].lat, candidates[j].lon))
            if options
            else None
        )
    return out


def evaluate(
    chosen: Sequence[int],
    demand: Sequence[DemandPoint],
    candidates: Sequence[Candidate],
    near: Sequence[Sequence[int]],
    tonnes: Sequence[float],
    zone_population: dict[str, int],
    costs: SiteCosts,
    params: network.Params,
    *,
    collections_per_year: float,
    route_time_limit_s: int = 3,
) -> SitePlan:
    """Toneladas, população servida, custos e rotas (VRP) de um conjunto de locais abertos."""
    owner = assign_to_nearest(chosen, near, demand, candidates)
    total_w: dict[str, float] = defaultdict(float)
    for d in demand:
        total_w[d.zone_id] += d.weight
    t_by_site: dict[int, float] = defaultdict(float)
    pop_by_site: dict[int, float] = defaultdict(float)
    served_by_site: dict[int, int] = defaultdict(int)
    zone_t: dict[str, float] = defaultdict(float)
    zone_pop: dict[str, float] = defaultdict(float)
    for i, j in enumerate(owner):
        if j is None:
            continue
        d = demand[i]
        pop = zone_population.get(d.zone_id, 0) * d.weight / total_w[d.zone_id] if total_w[d.zone_id] else 0.0
        t_by_site[j] += tonnes[i]
        pop_by_site[j] += pop
        served_by_site[j] += 1
        zone_t[d.zone_id] += tonnes[i]
        zone_pop[d.zone_id] += pop

    fixed = len(chosen) * costs.annual_fixed_eur
    routes: list[network.Route] = []
    km_year = 0.0
    if chosen:
        freq = max(collections_per_year, 1.0)
        stops = [
            network.Stop(candidates[j].id, candidates[j].lat, candidates[j].lon, t_by_site.get(j, 0.0) / freq)
            for j in chosen
        ]
        plan = network.plan_routes(stops, params, time_limit_s=route_time_limit_s)
        routes = plan.routes
        km_year = plan.km_per_round * collections_per_year
    sites = [
        SiteResult(candidates[j], t_by_site.get(j, 0.0), pop_by_site.get(j, 0.0), served_by_site.get(j, 0))
        for j in chosen
    ]
    return SitePlan(
        sites=sites,
        status="optimal",
        tonnes=sum(zone_t.values()),
        population_covered=sum(zone_pop.values()),
        served_points=sum(1 for j in owner if j is not None),
        total_points=len(demand),
        fixed_cost_eur=fixed,
        km_year=km_year,
        cost_km_eur=km_year * params.cost_per_km_eur,
        routes=routes,
        zone_tonnes=dict(zone_t),
        zone_population_covered=dict(zone_pop),
    )


def plan_site_network(
    demand: Sequence[DemandPoint],
    candidates: Sequence[Candidate],
    zone_demand_t: dict[str, float],
    zone_population: dict[str, int],
    costs: SiteCosts,
    params: network.Params,
    *,
    capture_rate: float,
    radius_m: float,
    collections_per_year: float,
    objective: Literal["max_tonnes", "min_cost"],
    budget_eur_year: float | None = None,
    target_tonnes: float | None = None,
    time_limit_s: float = 12.0,
) -> SitePlan:
    """Escolhe os locais e planeia as rotas. Em `max_tonnes` o custo real (fixo + km) cabe no orçamento pedido."""
    near = neighbours(demand, candidates, radius_m)
    tonnes = point_tonnes(demand, zone_demand_t, capture_rate)
    site_cost = [costs.annual_fixed_eur] * len(candidates)
    empty = SitePlan([], "infeasible", 0.0, 0.0, 0, len(demand), 0.0, 0.0, 0.0)

    if objective == "min_cost":
        sol = solve_coverage(
            tonnes, near, site_cost, "min_cost", target_tonnes=target_tonnes, time_limit_s=time_limit_s
        )
        if sol.status == "infeasible":
            return empty
        plan = evaluate(
            sol.chosen, demand, candidates, near, tonnes, zone_population, costs, params,
            collections_per_year=collections_per_year, route_time_limit_s=6,
        )  # fmt: skip
        return _with(plan, sol.status, 1)

    if budget_eur_year is None:
        raise ValueError("max_tonnes exige budget_eur_year")
    solver_budget = budget_eur_year
    best: SitePlan | None = None
    status: Literal["optimal", "feasible", "infeasible"] = "infeasible"
    for it in range(1, MAX_BUDGET_ITERATIONS + 1):
        sol = solve_coverage(
            tonnes, near, site_cost, "max_tonnes", budget_eur=max(solver_budget, 0.0), time_limit_s=time_limit_s / 2
        )
        status = sol.status
        if not sol.chosen:
            break
        plan = evaluate(
            sol.chosen, demand, candidates, near, tonnes, zone_population, costs, params,
            collections_per_year=collections_per_year, route_time_limit_s=3,
        )  # fmt: skip
        over = plan.annual_cost_eur - budget_eur_year
        if over <= 1e-6:
            best = _with(plan, status, it)
            break
        # Os km custaram mais do que o previsto: baixa o orçamento dos locais por esse excesso e volta a resolver.
        solver_budget -= over * 1.02
        if solver_budget <= 0:
            break
    if best is None:
        return empty
    return best


def _with(plan: SitePlan, status: Literal["optimal", "feasible", "infeasible"], iterations: int) -> SitePlan:
    return SitePlan(
        sites=plan.sites,
        status=status,
        tonnes=plan.tonnes,
        population_covered=plan.population_covered,
        served_points=plan.served_points,
        total_points=plan.total_points,
        fixed_cost_eur=plan.fixed_cost_eur,
        km_year=plan.km_year,
        cost_km_eur=plan.cost_km_eur,
        routes=plan.routes,
        zone_tonnes=plan.zone_tonnes,
        zone_population_covered=plan.zone_population_covered,
        iterations=iterations,
    )
