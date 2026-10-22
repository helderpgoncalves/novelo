"""Rede por locais reais: escolhe QUE locais abrir (não só que freguesias servir). Funções puras, sem I/O.

Os locais candidatos são os pontos de recolha municipais que a Vitrus enviou (`municipal_sites`). Cada habitante é
representado pelos locais públicos da sua freguesia: a procura de uma freguesia reparte-se pelos seus locais públicos
na proporção da CAPACIDADE (litros) dos contentores que lá estão (`capacity_weights`; a capacidade segue a população
melhor do que o número de contentores: R² 0,80 contra 0,76 por freguesia, ver docs/engenharia/dados-e-modelo.md).
É um proxy, não população por quarteirão (esse dado, o BGRI, não chegou): o resultado leva "estimativa".

Um ponto de procura fica servido se houver um local aberto a menos de `radius_m`. Vários locais a servir a mesma
pessoa não captam duas vezes (cobertura por união, não por canais independentes como no modelo por freguesia).

  têxtil do ponto i       t_i = D_z · (w_i / Σ_z w) · c               (t/ano; c = taxa de captura do modo)
  custo fixo do local j   capex/N + recolhas/ano · c_recolha
  km                      o VRP sobre os locais abertos dá os km de uma ronda; km/ano = rondas · km_ronda
  viaturas dedicadas      ⌈horas (rotas + recolha a pedido) ÷ horas de uma viatura⌉ · capex/vida útil

O CP-SAT resolve a cobertura máxima com orçamento (ou o custo mínimo para uma meta). Como os km e as viaturas não são
lineares nos locais escolhidos, o orçamento do solver desce até o custo real (fixo + km das rotas + viaturas) caber no
pedido. A primeira volta já desconta uma viatura (há sempre uma logo que se recolha alguma coisa).
"""

from __future__ import annotations

import math
import statistics
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass, field, replace
from typing import Literal

from ortools.sat.python import cp_model

from novelo.domain import fleet, network
from novelo.domain.geo import haversine_km

SCALE_KG = 1000  # t -> kg inteiros no solver
SCALE_EUR = 100
GRID_DEG = 0.02  # ~2,2 km: maior que o raio máximo (1 000 m), por isso bastam as 3×3 células vizinhas
MAX_BUDGET_ITERATIONS = 4


@dataclass(frozen=True)
class DemandPoint:
    id: str
    zone_id: str
    lat: float
    lon: float
    weight: float  # litros de contentores no local (proxy da população que o usa)


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


def median_capacity_by_kind(containers: Sequence[tuple[str, int | None]]) -> dict[str, float]:
    """Mediana dos litros conhecidos de cada tipo de contentor (`(tipo, litros ou None)`)."""
    known: dict[str, list[float]] = defaultdict(list)
    for kind, litres in containers:
        if litres is not None:
            known[kind].append(float(litres))
    return {kind: statistics.median(values) for kind, values in known.items()}


def capacity_weights(containers: Sequence[tuple[str, str, int | None]]) -> dict[str, float]:
    """Litros por local (`(local, tipo, litros ou None)`).

    Regra para a capacidade desconhecida: a mediana do tipo; se o tipo não tiver nenhum valor conhecido, a mediana de
    todos os contentores com litros conhecidos (0 se nenhum).
    """
    by_kind = median_capacity_by_kind([(kind, litres) for _, kind, litres in containers])
    known = [float(litres) for _, _, litres in containers if litres is not None]
    fallback = statistics.median(known) if known else 0.0
    out: dict[str, float] = defaultdict(float)
    for site, kind, litres in containers:
        out[site] += float(litres) if litres is not None else by_kind.get(kind, fallback)
    return dict(out)


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


def _group(
    tonnes: Sequence[float], near: Sequence[Sequence[int]]
) -> tuple[list[int], list[tuple[float, tuple[int, ...]]]]:
    """Junta os pontos com os mesmos locais ao alcance (não muda o ótimo) e lista os locais que servem alguém."""
    groups: dict[tuple[int, ...], float] = defaultdict(float)
    for i, row in enumerate(near):
        if row and tonnes[i] > 0:
            groups[tuple(row)] += tonnes[i]
    usable = sorted({j for key in groups for j in key})
    return usable, [(t, key) for key, t in groups.items()]


def greedy_coverage(
    tonnes: Sequence[float], near: Sequence[Sequence[int]], site_cost: Sequence[float], budget_eur: float
) -> tuple[int, ...]:
    """Solução inicial: o local com mais têxtil novo por euro, até acabar o orçamento (dica para o CP-SAT)."""
    by_site: dict[int, list[int]] = defaultdict(list)
    for i, row in enumerate(near):
        for j in row:
            by_site[j].append(i)
    covered: set[int] = set()
    spent = 0.0
    chosen: list[int] = []
    while True:
        best, best_ratio = None, 0.0
        for j, pts in by_site.items():
            if j in chosen or spent + site_cost[j] > budget_eur:
                continue
            gain = sum(tonnes[i] for i in pts if i not in covered)
            ratio = gain / site_cost[j] if site_cost[j] > 0 else gain
            if ratio > best_ratio + 1e-12 or (abs(ratio - best_ratio) <= 1e-12 and best is not None and j < best):
                best, best_ratio = j, ratio
        if best is None:
            return tuple(sorted(chosen))
        chosen.append(best)
        spent += site_cost[best]
        covered.update(by_site[best])


def greedy_hybrid(
    site_t: Sequence[float],
    od_t: Sequence[float],
    overlap_t: Sequence[float],
    zone_of: Sequence[str],
    near: Sequence[Sequence[int]],
    site_cost_eur: float,
    od_cost_eur: dict[str, float],
    budget_eur: float,
) -> tuple[tuple[int, ...], frozenset[str]]:
    """Solução inicial dos locais e da recolha a pedido: a ação com mais têxtil novo por euro, até acabar o orçamento.

    Ligar a recolha a pedido numa freguesia vale `od_i − overlap_i·y_i` por ponto; abrir um local vale
    `site_i − overlap_i·z_p` por ponto que ainda não estava servido (a união dos canais não conta duas vezes).
    """
    by_site: dict[int, list[int]] = defaultdict(list)
    by_zone: dict[str, list[int]] = defaultdict(list)
    for i, row in enumerate(near):
        by_zone[zone_of[i]].append(i)
        for j in row:
            by_site[j].append(i)
    served = [False] * len(near)
    od_on: set[str] = set()
    chosen: list[int] = []
    spent = 0.0

    def best_action() -> tuple[float, str, int | str] | None:
        best: tuple[float, str, int | str] | None = None
        for j, pts in by_site.items():
            if j in chosen or spent + site_cost_eur > budget_eur:
                continue
            gain = sum(site_t[i] - (overlap_t[i] if zone_of[i] in od_on else 0.0) for i in pts if not served[i])
            ratio = gain / site_cost_eur if site_cost_eur > 0 else gain
            if ratio > 1e-12 and (best is None or ratio > best[0] + 1e-12):
                best = (ratio, "s", j)
        for p, cost in od_cost_eur.items():
            if p in od_on or spent + cost > budget_eur:
                continue
            gain = sum(od_t[i] - (overlap_t[i] if served[i] else 0.0) for i in by_zone.get(p, ()))
            ratio = gain / cost if cost > 0 else gain
            if ratio > 1e-12 and (best is None or ratio > best[0] + 1e-12):
                best = (ratio, "z", p)
        return best

    while (action := best_action()) is not None:
        _, _, ref = action
        if isinstance(ref, int):
            chosen.append(ref)
            spent += site_cost_eur
            for i in by_site[ref]:
                served[i] = True
        else:
            od_on.add(ref)
            spent += od_cost_eur[ref]
    return tuple(sorted(chosen)), frozenset(od_on)


def _set_goal(
    model: cp_model.CpModel,
    objective: Literal["max_tonnes", "min_cost"],
    total_kg: cp_model.LinearExpr,
    total_c: cp_model.LinearExpr,
    budget_eur: float | None,
    target_tonnes: float | None,
) -> None:
    if objective == "max_tonnes":
        if budget_eur is None:
            raise ValueError("max_tonnes exige budget_eur")
        model.add(total_c <= round(budget_eur * SCALE_EUR))
        # Desempate: a igualdade de kg, o mais barato (1 kg vale mais do que qualquer poupança possível).
        model.maximize(total_kg * 1_000_000 - total_c)
        return
    if target_tonnes is None:
        raise ValueError("min_cost exige target_tonnes")
    model.add(total_kg >= round(target_tonnes * SCALE_KG))
    model.minimize(total_c)


def _solve_model(
    model: cp_model.CpModel, time_limit_s: float, seed: int
) -> tuple[cp_model.CpSolver, Literal["optimal", "feasible", "infeasible"]]:
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_s
    solver.parameters.random_seed = seed
    solver.parameters.num_workers = 1  # determinismo: mesma entrada, mesmo cenário
    solver.parameters.relative_gap_limit = 5e-3
    status = solver.solve(model)
    if status == cp_model.OPTIMAL:
        return solver, "optimal"
    return solver, "feasible" if status == cp_model.FEASIBLE else "infeasible"


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
    hint: Sequence[int] = (),
) -> CoverageSolution:
    """Cobertura máxima com orçamento, ou custo mínimo para uma meta, sobre os locais candidatos.

    O custo é o mesmo em todos os locais: o orçamento fixa quantos abrem.
    """
    if len(set(site_cost_eur)) > 1:
        raise ValueError("o modelo exige o mesmo custo fixo em todos os locais")
    usable, groups = _group(tonnes, near)
    model = cp_model.CpModel()
    x = {j: model.new_bool_var(f"x{j}") for j in usable}
    served = []
    for g, (_, key) in enumerate(groups):
        y = model.new_bool_var(f"y{g}")
        model.add(sum(x[j] for j in key if j in x) >= 1).only_enforce_if(y)
        served.append(y)
    kg = [round(t * SCALE_KG) for t, _ in groups]
    total_kg = cp_model.LinearExpr.weighted_sum(served, kg)
    unit = round(site_cost_eur[0] * SCALE_EUR) if site_cost_eur else 0
    total_c = cp_model.LinearExpr.weighted_sum(list(x.values()), [unit] * len(x))

    _set_goal(model, objective, total_kg, total_c, budget_eur, target_tonnes)
    hinted = set(hint)
    for j in usable:
        model.add_hint(x[j], 1 if j in hinted else 0)
    for y, (_, key) in zip(served, groups, strict=True):  # dica completa: parte de uma solução viável (a gulosa)
        model.add_hint(y, int(any(j in hinted for j in key)))
    solver, status = _solve_model(model, time_limit_s, seed)
    if status == "infeasible":
        return CoverageSolution((), "infeasible")
    chosen = tuple(j for j in usable if solver.value(x[j]))
    return CoverageSolution(chosen, status)


@dataclass(frozen=True)
class OnDemandZone:
    """Recolha a pedido numa freguesia: saco fechado à porta, numa ronda da viatura dedicada (`network.mode_cost`)."""

    zone_id: str
    capture: float  # c · f do modo: fração do têxtil da freguesia que capta sozinho
    coverage: float  # fração da população que serve
    cost_eur: float  # custo anual com km (modelo `network.mode_cost`)
    km_year: float
    hours_year: float = 0.0  # horas da viatura dedicada
    stops_year: float = 0.0  # sacos por ano
    rounds_year: float = 0.0
    trips_per_round: int = 0


@dataclass(frozen=True)
class HybridSolution:
    sites: tuple[int, ...]
    on_demand: frozenset[str]
    status: Literal["optimal", "feasible", "infeasible"]


def solve_hybrid(
    site_t: Sequence[float],
    od_t: Sequence[float],
    overlap_t: Sequence[float],
    zone_of: Sequence[str],
    near: Sequence[Sequence[int]],
    site_cost_eur: float,
    od_cost_eur: dict[str, float],
    objective: Literal["max_tonnes", "min_cost"],
    *,
    budget_eur: float | None = None,
    target_tonnes: float | None = None,
    time_limit_s: float = 10.0,
    seed: int = 7,
    hint: Sequence[int] = (),
    hint_on_demand: frozenset[str] = frozenset(),
) -> HybridSolution:
    """Locais + recolha a pedido por freguesia. Os dois canais captam de forma independente, como no modelo por zonas:

      têxtil do ponto i = site_i · y_i + od_i · z_p − overlap_i · y_i · z_p     (overlap = site · od / procura)

    `y_i` = ponto servido por um local aberto; `z_p` = recolha a pedido ligada na freguesia. O produto y·z linearizase
    com `w ≥ y + z − 1` (como o coeficiente é negativo, `w` não sobe sem necessidade).
    """
    groups: dict[tuple[str, tuple[int, ...]], list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0])
    for i, row in enumerate(near):
        g = groups[(zone_of[i], tuple(row))]
        g[0] += site_t[i]
        g[1] += od_t[i]
        g[2] += overlap_t[i]
    usable = sorted({j for _, row in groups for j in row})

    model = cp_model.CpModel()
    x = {j: model.new_bool_var(f"x{j}") for j in usable}
    z = {p: model.new_bool_var(f"z{p}") for p in od_cost_eur}
    kg_vars: list[cp_model.IntVar] = []
    kg_coefs: list[int] = []
    hint_vars: list[tuple[cp_model.IntVar, str, tuple[int, ...], str]] = []  # (var, tipo, locais, freguesia)
    for idx, ((zone, row), (s_t, o_t, v_t)) in enumerate(groups.items()):
        if zone in z and o_t > 0:
            kg_vars.append(z[zone])
            kg_coefs.append(round(o_t * SCALE_KG))
        live = [j for j in row if j in x]
        if not live or s_t <= 0:
            continue
        y = model.new_bool_var(f"y{idx}")
        model.add(sum(x[j] for j in live) >= 1).only_enforce_if(y)
        hint_vars.append((y, "y", tuple(live), zone))
        kg_vars.append(y)
        kg_coefs.append(round(s_t * SCALE_KG))
        if zone in z and v_t > 0:
            w = model.new_bool_var(f"w{idx}")
            model.add(w >= y + z[zone] - 1)
            hint_vars.append((w, "w", tuple(live), zone))
            kg_vars.append(w)
            kg_coefs.append(-round(v_t * SCALE_KG))
    total_kg = cp_model.LinearExpr.weighted_sum(kg_vars, kg_coefs)
    unit = round(site_cost_eur * SCALE_EUR)
    cost_vars = [*x.values(), *z.values()]
    cost_coefs = [unit] * len(x) + [round(od_cost_eur[p] * SCALE_EUR) for p in z]
    total_c = cp_model.LinearExpr.weighted_sum(cost_vars, cost_coefs)

    _set_goal(model, objective, total_kg, total_c, budget_eur, target_tonnes)
    hinted = set(hint)
    for j in usable:
        model.add_hint(x[j], 1 if j in hinted else 0)
    for p, var in z.items():
        model.add_hint(var, 1 if p in hint_on_demand else 0)
    for var, kind, reach, hz in hint_vars:  # dica completa: o solver parte de uma solução viável (a gulosa)
        served = any(j in hinted for j in reach)
        model.add_hint(var, int(served if kind == "y" else served and hz in hint_on_demand))
    solver, status = _solve_model(model, time_limit_s, seed)
    if status == "infeasible":
        return HybridSolution((), frozenset(), "infeasible")
    return HybridSolution(
        tuple(j for j in usable if solver.value(x[j])),
        frozenset(p for p in z if solver.value(z[p])),
        status,
    )


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
    on_demand: dict[str, OnDemandZone] = field(default_factory=dict)  # freguesias com recolha a pedido ligada
    zone_tonnes_on_demand: dict[str, float] = field(default_factory=dict)
    zone_served_share: dict[str, float] = field(
        default_factory=dict
    )  # fração da procura da freguesia servida por locais
    hours_year: float = 0.0  # horas da viatura dedicada: rotas pelos locais + recolha a pedido
    vehicles: int = 0  # viaturas dedicadas: ⌈horas ÷ horas de uma viatura⌉
    vehicle_cost_eur: float = 0.0  # viaturas · capex ÷ vida útil

    @property
    def on_demand_cost_eur(self) -> float:
        return sum(z.cost_eur for z in self.on_demand.values())

    @property
    def annual_cost_eur(self) -> float:
        return self.fixed_cost_eur + self.cost_km_eur + self.on_demand_cost_eur + self.vehicle_cost_eur


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
    demand_t: Sequence[float],
    zone_population: dict[str, int],
    costs: SiteCosts,
    params: network.Params,
    *,
    site_capture: float,
    collections_per_year: float,
    on_demand: dict[str, OnDemandZone] | None = None,
    route_time_limit_s: int = 3,
) -> SitePlan:
    """Toneladas, população servida, custos e rotas (VRP) de um conjunto de locais abertos (e recolha a pedido).

    Por ponto, com `y` = servido por um local e `z` = recolha a pedido ligada: têxtil = D·(1 − (1 − c_s·y)(1 − c_o·z)).
    A recolha a pedido leva o que capta sozinha (D·c_o·z); os locais levam o resto, por isso a soma é a união.
    """
    od = on_demand or {}
    owner = assign_to_nearest(chosen, near, demand, candidates)
    total_w: dict[str, float] = defaultdict(float)
    for d in demand:
        total_w[d.zone_id] += d.weight
    t_by_site: dict[int, float] = defaultdict(float)
    pop_by_site: dict[int, float] = defaultdict(float)
    served_by_site: dict[int, int] = defaultdict(int)
    zone_t: dict[str, float] = defaultdict(float)
    zone_od_t: dict[str, float] = defaultdict(float)
    zone_served: dict[str, float] = defaultdict(float)
    zone_pop: dict[str, float] = defaultdict(float)
    for i, j in enumerate(owner):
        d = demand[i]
        z = od.get(d.zone_id)
        c_o = z.capture if z else 0.0
        f_o = z.coverage if z else 0.0
        od_t = demand_t[i] * c_o
        site_t = demand_t[i] * site_capture * (1 - c_o) if j is not None else 0.0
        pop_zone = zone_population.get(d.zone_id, 0) * d.weight / total_w[d.zone_id] if total_w[d.zone_id] else 0.0
        pop = pop_zone if j is not None else pop_zone * f_o
        if j is not None:
            zone_served[d.zone_id] += d.weight / total_w[d.zone_id] if total_w[d.zone_id] else 0.0
            t_by_site[j] += site_t
            pop_by_site[j] += pop_zone
            served_by_site[j] += 1
        zone_t[d.zone_id] += site_t + od_t
        zone_od_t[d.zone_id] += od_t
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
    hours = fleet.hours(km_year, len(chosen) * collections_per_year, params.vehicle_speed_kmh, params.site_stop_minutes)
    hours += sum(z.hours_year for z in od.values())
    vehicles = fleet.vehicles_needed(hours, params.shift_hours)
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
        on_demand=dict(od),
        zone_tonnes_on_demand=dict(zone_od_t),
        zone_served_share=dict(zone_served),
        hours_year=hours,
        vehicles=vehicles,
        vehicle_cost_eur=vehicles * params.vehicle_annual_eur,
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
    on_demand: dict[str, OnDemandZone] | None = None,
    time_limit_s: float = 12.0,
) -> SitePlan:
    """Escolhe os locais (e as freguesias com recolha a pedido) e planeia as rotas.

    Em `max_tonnes` o custo real (fixo + km das rotas + recolha a pedido) cabe no orçamento pedido.
    """
    near = neighbours(demand, candidates, radius_m)
    demand_t = point_tonnes(demand, zone_demand_t, 1.0)
    tonnes = [t * capture_rate for t in demand_t]
    site_cost = [costs.annual_fixed_eur] * len(candidates)
    od_zones = on_demand or {}
    empty = SitePlan([], "infeasible", 0.0, 0.0, 0, len(demand), 0.0, 0.0, 0.0)
    zone_of = [d.zone_id for d in demand]
    od_t = [t * od_zones[z].capture if z in od_zones else 0.0 for t, z in zip(demand_t, zone_of, strict=True)]
    overlap_t = [
        t * capture_rate * od_zones[z].capture if z in od_zones else 0.0 for t, z in zip(demand_t, zone_of, strict=True)
    ]

    def solve(
        budget: float | None, hint: Sequence[int], limit: float, hint_od: frozenset[str] = frozenset()
    ) -> tuple[tuple[int, ...], dict[str, OnDemandZone], str]:
        if od_zones:
            h = solve_hybrid(
                tonnes, od_t, overlap_t, zone_of, near, costs.annual_fixed_eur,
                {z: v.cost_eur for z, v in od_zones.items()}, objective,
                budget_eur=budget, target_tonnes=target_tonnes, time_limit_s=limit, hint=hint,
                hint_on_demand=hint_od,
            )  # fmt: skip
            if budget is not None and h.status == "infeasible" and (hint or hint_od):
                # Com orçamento, abrir nada é sempre válido: "infeasible" aqui é o CP-SAT sem solução no tempo dado.
                # A dica (gulosa ou a volta anterior) é uma solução; o custo real decide depois se cabe no orçamento.
                return tuple(hint), {z: od_zones[z] for z in hint_od}, "feasible"
            return h.sites, {z: od_zones[z] for z in h.on_demand}, h.status
        c = solve_coverage(
            tonnes, near, site_cost, objective, budget_eur=budget, target_tonnes=target_tonnes,
            time_limit_s=limit, hint=hint,
        )  # fmt: skip
        if budget is not None and c.status == "infeasible" and hint:
            return tuple(hint), {}, "feasible"  # idem: sem solução no tempo dado, fica a dica
        return c.chosen, {}, c.status

    def build(chosen: Sequence[int], od: dict[str, OnDemandZone], route_s: int) -> SitePlan:
        return evaluate(
            chosen, demand, candidates, near, demand_t, zone_population, costs, params,
            site_capture=capture_rate, collections_per_year=collections_per_year, on_demand=od,
            route_time_limit_s=route_s,
        )  # fmt: skip

    if objective == "min_cost":
        chosen, od, status = solve(None, (), time_limit_s)
        if status == "infeasible":
            return empty
        return _with(build(chosen, od, 6), status, 1)  # type: ignore[arg-type]

    if budget_eur_year is None:
        raise ValueError("max_tonnes exige budget_eur_year")
    # Os km e as viaturas não são lineares nos locais escolhidos: o solver trabalha com o custo fixo e o orçamento do
    # solver sobe ou desce pela folga ou excesso do custo REAL (fixo + km do VRP + viaturas) até caber no pedido. A
    # primeira volta desconta logo uma viatura dedicada.
    solver_budget = budget_eur_year - params.vehicle_annual_eur
    best: SitePlan | None = None
    hint: tuple[int, ...]
    hint_od: frozenset[str] = frozenset()
    if od_zones:
        hint, hint_od = greedy_hybrid(
            tonnes, od_t, overlap_t, zone_of, near, costs.annual_fixed_eur,
            {z: v.cost_eur for z, v in od_zones.items()}, solver_budget,
        )  # fmt: skip
    else:
        hint = greedy_coverage(tonnes, near, site_cost, solver_budget)
    for it in range(1, MAX_BUDGET_ITERATIONS + 1):
        chosen, od, status = solve(solver_budget, hint, time_limit_s / 3, hint_od)
        if not chosen and not od:
            solver_budget *= 0.5
            continue
        hint, hint_od = chosen, frozenset(od)
        plan = build(chosen, od, 3)
        cost = plan.annual_cost_eur
        if cost <= budget_eur_year + 1e-6:
            if best is None or plan.tonnes > best.tonnes:
                best = _with(plan, status, it)  # type: ignore[arg-type]
            slack = budget_eur_year - cost
            if slack <= 0.02 * budget_eur_year:
                break
            solver_budget += slack * 0.9
        else:
            # Corta a partir do custo que o solver viu para ESTA solução (pode estar bem abaixo do orçamento do solver):
            # cortar só ao orçamento devolvia a mesma solução e o cenário acabava "infeasible" com dinheiro de sobra.
            seen = len(chosen) * costs.annual_fixed_eur + sum(v.cost_eur for v in od.values())
            solver_budget = min(solver_budget, seen) - (cost - budget_eur_year) * 1.02 - 0.005 * budget_eur_year
        if solver_budget <= 0:
            break
    return best if best is not None else empty


def _with(plan: SitePlan, status: Literal["optimal", "feasible", "infeasible"], iterations: int) -> SitePlan:
    return replace(plan, status=status, iterations=iterations)
