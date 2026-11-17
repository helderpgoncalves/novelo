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
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field, replace
from typing import Literal

from ortools.sat.python import cp_model

from novelo.domain import fleet, network
from novelo.domain.geo import haversine_km
from novelo.domain.vocab import CollectionFrequency

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
    demand_t: Sequence[float],
    site_t: Sequence[float],
    site_capture: float,
    zone_of: Sequence[str],
    near: Sequence[Sequence[int]],
    site_cost_eur: float,
    od_variants: Mapping[str, Sequence[OnDemandZone]],
    budget_eur: float,
) -> tuple[tuple[int, ...], frozenset[str]]:
    """Solução inicial dos locais e da recolha a pedido: a ação com mais têxtil novo por euro, até acabar o orçamento.

    Ligar a recolha a pedido numa freguesia vale, por ponto, o que o DEGRAU escolhido capta sozinho
    (`demand_t · capture_v`) menos ooverlap já servido pelos locais; abrir um local vale `site_t` por ponto ainda
    não servido (a união dos canais não conta duas vezes). Os degraus são ações distintas: escolher o degrau é
    parte da decisão (ADR: política de paragem).
    """
    by_site: dict[int, list[int]] = defaultdict(list)
    by_zone: dict[str, list[int]] = defaultdict(list)
    for i, row in enumerate(near):
        by_zone[zone_of[i]].append(i)
        for j in row:
            by_site[j].append(i)
    served = [False] * len(near)
    od_on: set[str] = set()
    od_capture: dict[str, float] = {}  # captura do degrau ligado em cada freguesia (para o overlap com os locais)
    chosen: list[int] = []
    spent = 0.0

    def best_action() -> tuple[float, str, int | str] | None:
        best: tuple[float, str, int | str] | None = None
        for j, pts in by_site.items():
            if j in chosen or spent + site_cost_eur > budget_eur:
                continue
            gain = sum(
                site_t[i] - (demand_t[i] * site_capture * od_capture[zone_of[i]] if zone_of[i] in od_capture else 0.0)
                for i in pts if not served[i]
            )  # fmt: skip
            ratio = gain / site_cost_eur if site_cost_eur > 0 else gain
            if ratio > 1e-12 and (best is None or ratio > best[0] + 1e-12):
                best = (ratio, "s", j)
        for p, variants in od_variants.items():
            for i, v in enumerate(variants):
                key = f"{p}#{i}"
                if key in od_on or v.capture <= 0 or spent + v.cost_eur > budget_eur:
                    continue
                gain = sum(
                    demand_t[k] * v.capture - (demand_t[k] * site_capture * v.capture if served[k] else 0.0)
                    for k in by_zone.get(p, ())
                )
                ratio = gain / v.cost_eur if v.cost_eur > 0 else gain
                if ratio > 1e-12 and (best is None or ratio > best[0] + 1e-12):
                    best = (ratio, "z", key)
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
            v = next(v for p, vs in od_variants.items() for i, v in enumerate(vs) if f"{p}#{i}" == ref)
            od_capture[v.zone_id] = v.capture
            spent += v.cost_eur
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
    """Recolha a pedido numa freguesia: saco fechado à porta, numa ronda da viatura dedicada (`network.mode_cost`).

    Na política dinâmica cada freguesia traz uma LISTA de variantes (uma por degrau da escada) e o MIP escolhe
    uma (`solve_hybrid`/`greedy_hybrid`); na fixa, uma só variante com o passo global (`rung` nulo).
    """

    zone_id: str
    capture: float  # c · f do modo AO DEGRAU ESCOLHIDO: fração do têxtil da freguesia que capta sozinho
    coverage: float  # fração da população que serve
    cost_eur: float  # custo anual com km (modelo `network.mode_cost`)
    km_year: float
    hours_year: float = 0.0  # horas da viatura dedicada
    stops_year: float = 0.0  # sacos por ano
    rounds_year: float = 0.0
    trips_per_round: int = 0
    rung: CollectionFrequency | None = None  # o degrau da escada; None = o passo global da política fixa


@dataclass(frozen=True)
class HybridSolution:
    sites: tuple[int, ...]
    on_demand: frozenset[str]
    status: Literal["optimal", "feasible", "infeasible"]


def solve_hybrid(  # noqa: PLR0915  (o kernel do MIP híbrido: grupos, degraus, dicas e objetivo num só modelo)
    demand_t: Sequence[float],
    site_t: Sequence[float],
    site_capture: float,
    zone_of: Sequence[str],
    near: Sequence[Sequence[int]],
    site_cost_eur: float,
    od_variants: Mapping[str, Sequence[OnDemandZone]],
    objective: Literal["max_tonnes", "min_cost"],
    *,
    budget_eur: float | None = None,
    target_tonnes: float | None = None,
    time_limit_s: float = 10.0,
    seed: int = 7,
    hint: Sequence[int] = (),
    hint_on_demand: frozenset[str] = frozenset(),
    required_od: frozenset[str] = frozenset(),
) -> HybridSolution:
    """Locais + recolha a pedido por freguesia, com o DEGRAU da escada escolhido pelo MIP.

    Os dois canais captam de forma independente, como no modelo por zonas; cada degrau é uma variável:

      têxtil do ponto i = site_i · y_i + D_i · c_v · z_v − overlap_i · y_i · z_v      (v = degrau da freguesia)

    `y_i` = ponto servido por um local aberto; `z_v` = o degrau v ligado na freguesia (no máximo um por freguesia).
    O produto y·z_v linearizase com `w_v ≥ y + z_v − 1` (coeficiente negativo: `w_v` não sobe sem necessidade).
    As chaves de `z` são `"{freguesia}#{índice da variante}"` e é nesse formato que a dica (`hint_on_demand`) fala.
    """
    groups: dict[tuple[str, tuple[int, ...]], list[float]] = defaultdict(lambda: [0.0, 0.0])
    for i, row in enumerate(near):
        g = groups[(zone_of[i], tuple(row))]
        g[0] += site_t[i]
        g[1] += demand_t[i]
    usable = sorted({j for _, row in groups for j in row})

    model = cp_model.CpModel()
    x = {j: model.new_bool_var(f"x{j}") for j in usable}
    z: dict[str, cp_model.IntVar] = {}
    variant_by_key: dict[str, OnDemandZone] = {}
    for p, variants in od_variants.items():
        for i, v in enumerate(variants):
            key = f"{p}#{i}"
            variant_by_key[key] = v
            z[key] = model.new_bool_var(f"z{key}")
        if variants:
            model.add_at_most_one(z[f"{p}#{i}"] for i in range(len(variants)))
        if p in required_od and variants:
            # aviso «sacos prontos» garantido: UM degrau tem de estar ligado (ADR: política de paragem)
            model.add(sum(z[f"{p}#{i}"] for i in range(len(variants))) == 1)

    kg_vars: list[cp_model.IntVar] = []
    kg_coefs: list[int] = []
    hint_vars: list[tuple[cp_model.IntVar, str, tuple[int, ...], str]] = []  # (var, tipo, locais, chave da variante)

    def group_terms(idx: int, zone: str, row: tuple[int, ...], s_t: float, d_t: float) -> None:
        """Termos de um grupo (freguesia, mesmos locais ao alcance): o y dos locais e o z (e w) de cada degrau."""
        live = [j for j in row if j in x]
        od_keys = [k for k, v in variant_by_key.items() if k.startswith(f"{zone}#") and v.capture > 0]
        if not live or s_t <= 0:
            # grupo sem local possível: a recolha a pedido ainda pode estar ligada (só o degrau conta)
            for k in od_keys:
                kg_vars.append(z[k])
                kg_coefs.append(round(d_t * variant_by_key[k].capture * SCALE_KG))
            return
        y = model.new_bool_var(f"y{idx}")
        model.add(sum(x[j] for j in live) >= 1).only_enforce_if(y)
        hint_vars.append((y, "y", tuple(live), zone))
        kg_vars.append(y)
        kg_coefs.append(round(s_t * SCALE_KG))
        for k in od_keys:
            kg_vars.append(z[k])
            kg_coefs.append(round(d_t * variant_by_key[k].capture * SCALE_KG))
            w = model.new_bool_var(f"w{k}")
            model.add(w >= y + z[k] - 1)
            hint_vars.append((w, "w", tuple(live), k))
            kg_vars.append(w)
            kg_coefs.append(-round(d_t * site_capture * variant_by_key[k].capture * SCALE_KG))

    for idx, ((zone, row), (s_t, d_t)) in enumerate(groups.items()):
        group_terms(idx, zone, row, s_t, d_t)
    total_kg = cp_model.LinearExpr.weighted_sum(kg_vars, kg_coefs)
    unit = round(site_cost_eur * SCALE_EUR)
    cost_vars = [*x.values(), *z.values()]
    cost_coefs = [unit] * len(x) + [round(variant_by_key[k].cost_eur * SCALE_EUR) for k in z]
    total_c = cp_model.LinearExpr.weighted_sum(cost_vars, cost_coefs)

    _set_goal(model, objective, total_kg, total_c, budget_eur, target_tonnes)
    hinted = set(hint)
    for j in usable:
        model.add_hint(x[j], 1 if j in hinted else 0)
    for key, var in z.items():
        model.add_hint(var, 1 if key in hint_on_demand else 0)
    for var, kind, reach, hz in hint_vars:  # dica completa: o solver parte de uma solução viável (a gulosa)
        served = any(j in hinted for j in reach)
        model.add_hint(var, int(served if kind == "y" else served and hz in hint_on_demand))
    solver, status = _solve_model(model, time_limit_s, seed)
    if status == "infeasible":
        return HybridSolution((), frozenset(), "infeasible")
    return HybridSolution(
        tuple(j for j in usable if solver.value(x[j])),
        frozenset(k for k, var in z.items() if solver.value(var)),
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


def chosen_od(variants: Mapping[str, Sequence[OnDemandZone]], keys: Iterable[str]) -> dict[str, OnDemandZone]:
    """As variantes ligadas (chaves `freguesia#índice`): uma por freguesia, no máximo."""
    out: dict[str, OnDemandZone] = {}
    for key in keys:
        p, i = key.rsplit("#", 1)
        out[p] = variants[p][int(i)]
    return out


def keys_of(variants: Mapping[str, Sequence[OnDemandZone]], od: Mapping[str, OnDemandZone]) -> frozenset[str]:
    """As chaves das variantes escolhidas (formato das dicas e das variáveis de `solve_hybrid`)."""
    out: set[str] = set()
    for p, v in od.items():
        for i, variant in enumerate(variants.get(p, ())):
            if variant == v:
                out.add(f"{p}#{i}")
                break
    return frozenset(out)


def plan_site_network(  # noqa: PLR0915  (a procura de orçamento para os km não lineares vive toda nesta função)
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
    on_demand: Mapping[str, Sequence[OnDemandZone]] | None = None,
    time_limit_s: float = 12.0,
    required_od: frozenset[str] = frozenset(),
) -> SitePlan:
    """Escolhe os locais (e as freguesias com recolha a pedido, escolhendo o degrau da escada) e planeia as rotas.

    Em `max_tonnes` o custo real (fixo + km das rotas + recolha a pedido) cabe no orçamento pedido. `required_od`
    garante a recolha a pedido nessas freguesias (o aviso «sacos prontos» garante paragem, ADR #42).
    """
    near = neighbours(demand, candidates, radius_m)
    demand_t = point_tonnes(demand, zone_demand_t, 1.0)
    tonnes = [t * capture_rate for t in demand_t]
    site_cost = [costs.annual_fixed_eur] * len(candidates)
    od_variants: Mapping[str, Sequence[OnDemandZone]] = on_demand or {}
    empty = SitePlan([], "infeasible", 0.0, 0.0, 0, len(demand), 0.0, 0.0, 0.0)
    zone_of = [d.zone_id for d in demand]

    def solve(
        budget: float | None, hint: Sequence[int], limit: float, hint_od: frozenset[str] = frozenset()
    ) -> tuple[tuple[int, ...], dict[str, OnDemandZone], str]:
        if od_variants:
            h = solve_hybrid(
                demand_t, tonnes, capture_rate, zone_of, near, costs.annual_fixed_eur,
                od_variants, objective,
                budget_eur=budget, target_tonnes=target_tonnes, time_limit_s=limit, hint=hint,
                hint_on_demand=hint_od, required_od=required_od,
            )  # fmt: skip
            if budget is not None and h.status == "infeasible" and (hint or hint_od):
                # Com orçamento, abrir nada é sempre válido: "infeasible" aqui é o CP-SAT sem solução no tempo dado.
                # A dica (gulosa ou a volta anterior) é uma solução; o custo real decide depois se cabe no orçamento.
                return tuple(hint), chosen_od(od_variants, hint_od), "feasible"
            return h.sites, chosen_od(od_variants, h.on_demand), h.status
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

    def greedy() -> tuple[tuple[int, ...], frozenset[str]]:
        """A dica inicial (solução viável): gulosa nos locais e nos degraus, com as paragens garantidas incluídas."""
        if not od_variants:
            return greedy_coverage(tonnes, near, site_cost, solver_budget), frozenset()
        hint, hint_od = greedy_hybrid(
            demand_t, tonnes, capture_rate, zone_of, near, costs.annual_fixed_eur, od_variants, solver_budget,
        )  # fmt: skip
        # nas freguesias com paragem garantida, a dica tem de incluir um degrau (o mais barato: solução viável)
        forced = set(hint_od)
        for p, vs in od_variants.items():
            if p in required_od and vs:
                forced.add(f"{p}#{min(range(len(vs)), key=lambda i: vs[i].cost_eur)}")
        return hint, frozenset(forced)

    def search_budget(
        budget_limit: float, solver_budget: float, hint: tuple[int, ...], hint_od: frozenset[str]
    ) -> SitePlan:
        """A volta gulosa com o orçamento do solver a subir ou a descer até o custo REAL caber em `budget_limit`."""
        best: SitePlan | None = None
        for it in range(1, MAX_BUDGET_ITERATIONS + 1):
            chosen, od, status = solve(solver_budget, hint, time_limit_s / 3, hint_od)
            if not chosen and not od:
                solver_budget *= 0.5
                continue
            hint, hint_od = chosen, keys_of(od_variants, od)
            plan = build(chosen, od, 3)
            cost = plan.annual_cost_eur
            if cost <= budget_limit + 1e-6:
                if best is None or plan.tonnes > best.tonnes:
                    best = _with(plan, status, it)  # type: ignore[arg-type]
                slack = budget_limit - cost
                if slack <= 0.02 * budget_limit:
                    break
                solver_budget += slack * 0.9
            else:
                # Corta a partir do custo que o solver viu para ESTA solução (pode estar bem abaixo do orçamento):
                # cortar só ao orçamento devolvia a mesma solução e o cenário ficava "infeasible" com dinheiro de sobra.
                seen_cost = len(chosen) * costs.annual_fixed_eur + sum(v.cost_eur for v in od.values())
                solver_budget = min(solver_budget, seen_cost) - (cost - budget_limit) * 1.02
                solver_budget -= 0.005 * budget_limit
            if solver_budget <= 0:
                break
        return best if best is not None else empty

    if budget_eur_year is None:
        raise ValueError("max_tonnes exige budget_eur_year")
    # Os km e as viaturas não são lineares nos locais escolhidos: o solver trabalha com o custo fixo e o orçamento do
    # solver sobe ou desce pela folga ou excesso do custo REAL (fixo + km do VRP + viaturas) até caber no pedido. A
    # primeira volta desconta logo uma viatura dedicada.
    solver_budget = budget_eur_year - params.vehicle_annual_eur
    hint, hint_od = greedy()
    return search_budget(budget_eur_year, solver_budget, hint, hint_od)


def _with(plan: SitePlan, status: Literal["optimal", "feasible", "infeasible"], iterations: int) -> SitePlan:
    return replace(plan, status=status, iterations=iterations)
