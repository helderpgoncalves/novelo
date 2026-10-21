"""Cenários por locais reais: o otimizador escolhe locais da rede municipal (ver `domain/siting.py`).

O resultado usa o mesmo contrato dos cenários por freguesia (alocações, rotas, KPIs), por isso comparação, fluxos,
relatório e mapa funcionam sem mudanças; `result.sites` e `result.siting` trazem o que é próprio desta rede.
"""

import hashlib
import json
import threading
from collections import OrderedDict, defaultdict
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.domain import network, siting
from novelo.domain.vocab import CollectionMode, SiteClass
from novelo.features.municipal.models import MunicipalSite
from novelo.features.planning.params import to_domain_params
from novelo.features.planning.schemas import (
    Allocation,
    AllocationPart,
    Kpis,
    ModeSummary,
    PlanningParams,
    RouteOut,
    RouteStop,
    ScenarioRequest,
    ScenarioResult,
    SiteSelection,
    SitingSummary,
    ZoneOut,
)

POPULATION_PROXY = (
    "A população de cada freguesia reparte-se pelos seus locais públicos na proporção dos contentores municipais que "
    "lá estão (estimativa: não há população por quarteirão)."
)


@dataclass(frozen=True)
class SiteMeta:
    street: str | None
    containers: int
    precision: str
    parish_name: str


@dataclass(frozen=True)
class SiteInputs:
    demand: list[siting.DemandPoint]
    candidates: list[siting.Candidate]
    meta: dict[str, SiteMeta]


async def load_site_inputs(db: AsyncSession) -> SiteInputs:
    """Pontos de procura (locais públicos) e candidatos (`textile_candidate`) do pacote municipal de 20 de outubro."""
    rows = (
        await db.execute(
            select(
                MunicipalSite.site_id,
                MunicipalSite.latitude,
                MunicipalSite.longitude,
                MunicipalSite.parish_code,
                MunicipalSite.parish_name,
                MunicipalSite.site_class,
                MunicipalSite.containers,
                MunicipalSite.textile_candidate,
                MunicipalSite.coord_precision,
                MunicipalSite.streets,
            )
            .where(MunicipalSite.parish_code.is_not(None))
            .order_by(MunicipalSite.site_id)
        )
    ).all()
    demand: list[siting.DemandPoint] = []
    candidates: list[siting.Candidate] = []
    meta: dict[str, SiteMeta] = {}
    for r in rows:
        code = r.parish_code
        if code is None:
            continue
        if r.site_class != SiteClass.PRODUCER and r.containers > 0:
            demand.append(siting.DemandPoint(r.site_id, code, r.latitude, r.longitude, float(r.containers)))
        if r.textile_candidate:
            candidates.append(siting.Candidate(r.site_id, code, r.latitude, r.longitude))
            meta[r.site_id] = SiteMeta(
                street=r.streets[0] if r.streets else None,
                containers=r.containers,
                precision=str(getattr(r.coord_precision, "value", r.coord_precision)),
                parish_name=r.parish_name or code,
            )
    return SiteInputs(demand, candidates, meta)


def _on_demand_zones(
    zones: list[ZoneOut], params: PlanningParams, dp: network.Params, request: ScenarioRequest
) -> dict[str, siting.OnDemandZone]:
    """Recolha a pedido por freguesia, com o custo do modelo por zonas (aproveita os circuitos que já passam)."""
    if not request.site_on_demand:
        return {}
    out: dict[str, siting.OnDemandZone] = {}
    coverage = params.modes[CollectionMode.ON_DEMAND].coverage_factor
    for z in zones:
        allowed = request.constraints.get(z.code)
        if allowed is not None and CollectionMode.ON_DEMAND not in allowed:
            continue
        zone = network.Zone(z.code, z.name, z.population, z.latitude, z.longitude, z.service_days)
        c = network.mode_cost(zone, CollectionMode.ON_DEMAND, dp)
        out[z.code] = siting.OnDemandZone(z.code, c.capture, coverage, c.annual_cost_eur, c.km_year)
    return out


def _routes_out(
    plan: siting.SitePlan, mode: CollectionMode, candidates: list[siting.Candidate], inputs: SiteInputs, freq: float
) -> tuple[list[RouteOut], dict[str, int]]:
    vehicle_of: dict[str, int] = {}
    cand_by_id = {c.id: c for c in candidates}
    site_tonnes = {s.candidate.id: s.tonnes for s in plan.sites}
    routes: list[RouteOut] = []
    for r in plan.routes:
        stops = []
        for site_id in r.stops:
            vehicle_of[site_id] = r.vehicle
            m, cand = inputs.meta[site_id], cand_by_id[site_id]
            stops.append(
                RouteStop(
                    parish_code=cand.zone_id,
                    parish_name=m.parish_name,
                    latitude=cand.lat,
                    longitude=cand.lon,
                    load_t=round(site_tonnes.get(site_id, 0.0) / freq, 3),
                    site_id=site_id,
                    label=m.street,
                )
            )
        routes.append(
            RouteOut(
                mode=mode,
                vehicle=r.vehicle,
                stops=stops,
                km=round(r.km, 2),
                load_t=round(r.load_t, 3),
                path=[[lat, lon] for lat, lon in r.path],
            )
        )
    return routes, vehicle_of


def _site_selections(plan: siting.SitePlan, inputs: SiteInputs, vehicle_of: dict[str, int]) -> list[SiteSelection]:
    out = []
    for s in plan.sites:
        m = inputs.meta[s.candidate.id]
        out.append(
            SiteSelection(
                site_id=s.candidate.id,
                latitude=s.candidate.lat,
                longitude=s.candidate.lon,
                parish_code=s.candidate.zone_id,
                parish_name=m.parish_name,
                street=m.street,
                containers=m.containers,
                coord_precision="approximate" if m.precision == "approximate" else "precise",
                tonnes=round(s.tonnes, 3),
                population_covered=round(s.population_covered),
                served_points=s.served_points,
                vehicle=vehicle_of.get(s.candidate.id),
            )
        )
    return sorted(out, key=lambda x: -x.tonnes)


def _allocations(
    zones: list[ZoneOut], plan: siting.SitePlan, costs: siting.SiteCosts, mode: CollectionMode, params: PlanningParams
) -> list[Allocation]:
    points_by_zone: dict[str, int] = defaultdict(int)
    for s in plan.sites:
        points_by_zone[s.candidate.zone_id] += 1
    n_sites = len(plan.sites)
    out: list[Allocation] = []
    for z in zones:
        pts = points_by_zone.get(z.code, 0)
        t = plan.zone_tonnes.get(z.code, 0.0)
        od = plan.on_demand.get(z.code)
        if pts == 0 and t <= 0 and od is None:
            out.append(
                Allocation(
                    parish_code=z.code, parish_name=z.name, population=z.population, demand_t=z.demand_t, mode=None,
                    modes=[], parts=[], points=0, tonnes=0, covered_population=0, capex_eur=0, annual_cost_eur=0,
                    km_year=0, served_share=0.0,
                )
            )  # fmt: skip
            continue
        parts: list[AllocationPart] = []
        od_t = plan.zone_tonnes_on_demand.get(z.code, 0.0) if od else 0.0
        if pts or t - od_t > 0:
            km = plan.km_year * pts / n_sites if n_sites else 0.0
            parts.append(
                AllocationPart(
                    mode=mode,
                    points=pts,
                    tonnes=round(t - od_t, 3),
                    capex_eur=round(pts * costs.capex_eur, 2),
                    annual_cost_eur=round(pts * costs.annual_fixed_eur + km * params.cost_per_km_eur, 2),
                    km_year=round(km, 1),
                )
            )
        if od is not None:
            parts.append(
                AllocationPart(
                    mode=CollectionMode.ON_DEMAND,
                    points=0,
                    tonnes=round(od_t, 3),
                    capex_eur=0,
                    annual_cost_eur=round(od.cost_eur, 2),
                    km_year=round(od.km_year, 1),
                )
            )
        parts.sort(key=lambda p: -p.tonnes)
        out.append(
            Allocation(
                parish_code=z.code,
                parish_name=z.name,
                population=z.population,
                demand_t=z.demand_t,
                mode=parts[0].mode,
                modes=[p.mode for p in parts],
                parts=parts,
                points=pts,
                tonnes=round(t, 3),
                covered_population=round(plan.zone_population_covered.get(z.code, 0.0)),
                capex_eur=round(sum(p.capex_eur for p in parts), 2),
                annual_cost_eur=round(sum(p.annual_cost_eur for p in parts), 2),
                km_year=round(sum(p.km_year for p in parts), 1),
                served_share=round(plan.zone_served_share.get(z.code, 0.0), 6),
            )
        )
    return out


CACHE_SIZE = 32
_cache: OrderedDict[str, tuple[ScenarioResult, str]] = OrderedDict()
_cache_lock = threading.Lock()
_key_locks: dict[str, threading.Lock] = {}


def _cache_key(
    zones: list[ZoneOut], params: PlanningParams, request: ScenarioRequest, baseline_t: float, inputs: SiteInputs
) -> str:
    """Identifica um cálculo: os mesmos dados, pressupostos e pedido (sem o nome) dão o mesmo cenário."""
    body = {
        "request": request.model_dump(mode="json", exclude={"label", "parent_id"}),
        "params": params.model_dump(mode="json"),
        "baseline": round(baseline_t, 3),
        "zones": [(z.code, z.population, z.demand_t, z.service_days, z.latitude, z.longitude) for z in zones],
        "sites": [(d.id, d.zone_id, d.weight) for d in inputs.demand],
        "candidates": [(c.id, c.zone_id) for c in inputs.candidates],
    }
    return hashlib.sha256(json.dumps(body, sort_keys=True, default=str).encode()).hexdigest()


def compute_sites(
    zones: list[ZoneOut], params: PlanningParams, request: ScenarioRequest, baseline_t: float, inputs: SiteInputs
) -> tuple[ScenarioResult, str]:
    """Simulador por locais com cache em memória: o mesmo pedido sobre os mesmos dados não volta ao solver.

    Pedidos iguais em simultâneo esperam pelo primeiro (um só cálculo). O resultado é uma cópia profunda.
    """
    key = _cache_key(zones, params, request, baseline_t, inputs)
    with _cache_lock:
        hit = _cache.get(key)
        if hit is not None:
            _cache.move_to_end(key)
            return hit[0].model_copy(deep=True), hit[1]
        lock = _key_locks.setdefault(key, threading.Lock())
    with lock:
        with _cache_lock:
            hit = _cache.get(key)
        if hit is None:
            hit = _compute_sites(zones, params, request, baseline_t, inputs)
            with _cache_lock:
                _cache[key] = hit
                while len(_cache) > CACHE_SIZE:
                    _cache.popitem(last=False)
        with _cache_lock:
            _key_locks.pop(key, None)
    return hit[0].model_copy(deep=True), hit[1]


def _compute_sites(
    zones: list[ZoneOut], params: PlanningParams, request: ScenarioRequest, baseline_t: float, inputs: SiteInputs
) -> tuple[ScenarioResult, str]:
    """Núcleo puro do simulador por locais (sem base de dados)."""
    dp = to_domain_params(params)
    mode: CollectionMode = request.site_mode
    mp = params.modes[mode]
    costs = siting.SiteCosts(
        capex_eur=mp.capex_per_point_eur,
        annual_fixed_eur=mp.capex_per_point_eur / mp.lifetime_years
        + mp.collections_per_year * params.cost_per_collection_eur,
        collections_year=mp.collections_per_year,
    )
    # Restrições por freguesia: se o modo dos locais não é permitido lá, os seus locais deixam de ser candidatos.
    blocked = {code for code, modes in request.constraints.items() if mode not in modes}
    known = {z.code for z in zones}
    demand = [d for d in inputs.demand if d.zone_id in known]
    candidates = [c for c in inputs.candidates if c.zone_id in known and c.zone_id not in blocked]

    plan = siting.plan_site_network(
        demand,
        candidates,
        {z.code: z.demand_t for z in zones},
        {z.code: z.population for z in zones},
        costs,
        dp,
        capture_rate=mp.capture_rate,
        radius_m=request.site_radius_m,
        collections_per_year=mp.collections_per_year,
        objective=request.objective.value,
        budget_eur_year=request.budget_eur_year,
        target_tonnes=request.target_tonnes,
        on_demand=_on_demand_zones(zones, params, dp, request),
        time_limit_s=float(params.solver_time_limit_s),
    )

    freq = max(mp.collections_per_year, 1.0)
    routes, vehicle_of = _routes_out(plan, mode, candidates, inputs, freq)
    allocations = _allocations(zones, plan, costs, mode, params)

    n_sites = len(plan.sites)
    total_pop = sum(z.population for z in zones)
    capex = n_sites * costs.capex_eur
    annual = plan.annual_cost_eur
    kpis = Kpis(
        capex_eur=round(capex, 2),
        opex_eur_year=round(annual - capex / mp.lifetime_years, 2),
        annual_cost_eur=round(annual, 2),
        tonnes_year=round(plan.tonnes, 3),
        eur_per_tonne=round(annual / plan.tonnes, 2) if plan.tonnes > 0 else None,
        coverage_pct=round(plan.population_covered / total_pop * 100, 1) if total_pop else 0.0,
        points=n_sites,
        km_year=round(plan.km_year + sum(z.km_year for z in plan.on_demand.values()), 1),
        potential_t=round(sum(z.demand_t for z in zones), 1),
        baseline_observed_t=round(baseline_t, 1),
    )
    summaries = []
    for m in (mode, CollectionMode.ON_DEMAND):
        parts = [(a, p) for a in allocations for p in a.parts if p.mode == m]
        if parts:
            summaries.append(
                ModeSummary(
                    mode=m,
                    zones=len(parts),
                    points=sum(p.points for _, p in parts),
                    tonnes=round(sum(p.tonnes for _, p in parts), 3),
                    annual_cost_eur=round(sum(p.annual_cost_eur for _, p in parts), 2),
                )
            )
    result = ScenarioResult(
        kpis=kpis,
        allocations=allocations,
        routes=routes,
        modes=summaries,
        depot=[params.depot_lat, params.depot_lon],
        sites=_site_selections(plan, inputs, vehicle_of),
        siting=SitingSummary(
            radius_m=request.site_radius_m,
            site_mode=mode,
            candidates=len(candidates),
            demand_points=len(demand),
            served_points=plan.served_points,
            opened=n_sites,
            on_demand=request.site_on_demand,
            on_demand_zones=len(plan.on_demand),
            solver_iterations=plan.iterations,
            population_proxy=POPULATION_PROXY,
        ),
    )
    return result, plan.status
