"""Cenários por locais reais: o otimizador escolhe locais da rede municipal (ver `domain/siting.py`).

O resultado usa o mesmo contrato dos cenários por freguesia (alocações, rotas, KPIs), por isso comparação, fluxos,
relatório e mapa funcionam sem mudanças; `result.sites` e `result.siting` trazem o que é próprio desta rede.
"""

from collections import defaultdict
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.domain import siting
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


def compute_sites(
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
    candidates = [c for c in inputs.candidates if c.zone_id not in blocked]
    zone_by_code = {z.code: z for z in zones}
    known = set(zone_by_code)
    demand = [d for d in inputs.demand if d.zone_id in known]
    candidates = [c for c in candidates if c.zone_id in known]

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
        time_limit_s=float(params.solver_time_limit_s),
    )

    freq = max(mp.collections_per_year, 1.0)
    vehicle_of: dict[str, int] = {}
    routes: list[RouteOut] = []
    site_tonnes = {s.candidate.id: s.tonnes for s in plan.sites}
    for r in plan.routes:
        stops = []
        for site_id in r.stops:
            vehicle_of[site_id] = r.vehicle
            m = inputs.meta[site_id]
            cand = next(c for c in candidates if c.id == site_id)
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

    sites = sorted(
        (
            SiteSelection(
                site_id=s.candidate.id,
                latitude=s.candidate.lat,
                longitude=s.candidate.lon,
                parish_code=s.candidate.zone_id,
                parish_name=inputs.meta[s.candidate.id].parish_name,
                street=inputs.meta[s.candidate.id].street,
                containers=inputs.meta[s.candidate.id].containers,
                coord_precision="approximate" if inputs.meta[s.candidate.id].precision == "approximate" else "precise",
                tonnes=round(s.tonnes, 3),
                population_covered=round(s.population_covered),
                served_points=s.served_points,
                vehicle=vehicle_of.get(s.candidate.id),
            )
            for s in plan.sites
        ),
        key=lambda x: -x.tonnes,
    )

    points_by_zone: dict[str, int] = defaultdict(int)
    for s in plan.sites:
        points_by_zone[s.candidate.zone_id] += 1
    n_sites = len(plan.sites)
    capex_site = costs.capex_eur
    allocations: list[Allocation] = []
    for z in zones:
        pts = points_by_zone.get(z.code, 0)
        t = plan.zone_tonnes.get(z.code, 0.0)
        if pts == 0 and t <= 0:
            allocations.append(
                Allocation(
                    parish_code=z.code, parish_name=z.name, population=z.population, demand_t=z.demand_t, mode=None,
                    modes=[], parts=[], points=0, tonnes=0, covered_population=0, capex_eur=0, annual_cost_eur=0,
                    km_year=0,
                )
            )  # fmt: skip
            continue
        km = plan.km_year * pts / n_sites if n_sites else 0.0
        cost = pts * costs.annual_fixed_eur + km * params.cost_per_km_eur
        part = AllocationPart(
            mode=mode,
            points=pts,
            tonnes=round(t, 3),
            capex_eur=round(pts * capex_site, 2),
            annual_cost_eur=round(cost, 2),
            km_year=round(km, 1),
        )
        allocations.append(
            Allocation(
                parish_code=z.code,
                parish_name=z.name,
                population=z.population,
                demand_t=z.demand_t,
                mode=mode,
                modes=[mode],
                parts=[part],
                points=pts,
                tonnes=round(t, 3),
                covered_population=round(plan.zone_population_covered.get(z.code, 0.0)),
                capex_eur=part.capex_eur,
                annual_cost_eur=part.annual_cost_eur,
                km_year=part.km_year,
            )
        )

    total_pop = sum(z.population for z in zones)
    capex = n_sites * capex_site
    annual = plan.annual_cost_eur
    kpis = Kpis(
        capex_eur=round(capex, 2),
        opex_eur_year=round(annual - capex / mp.lifetime_years, 2),
        annual_cost_eur=round(annual, 2),
        tonnes_year=round(plan.tonnes, 3),
        eur_per_tonne=round(annual / plan.tonnes, 2) if plan.tonnes > 0 else None,
        coverage_pct=round(plan.population_covered / total_pop * 100, 1) if total_pop else 0.0,
        points=n_sites,
        km_year=round(plan.km_year, 1),
        potential_t=round(sum(z.demand_t for z in zones), 1),
        baseline_observed_t=round(baseline_t, 1),
    )
    summary = [
        ModeSummary(
            mode=mode,
            zones=sum(1 for a in allocations if a.parts),
            points=n_sites,
            tonnes=round(plan.tonnes, 3),
            annual_cost_eur=round(annual, 2),
        )
    ]
    result = ScenarioResult(
        kpis=kpis,
        allocations=allocations,
        routes=routes,
        modes=summary if n_sites else [],
        depot=[params.depot_lat, params.depot_lon],
        sites=sites,
        siting=SitingSummary(
            radius_m=request.site_radius_m,
            site_mode=mode,
            candidates=len(candidates),
            demand_points=len(demand),
            served_points=plan.served_points,
            opened=n_sites,
            solver_iterations=plan.iterations,
            population_proxy=POPULATION_PROXY,
        ),
    )
    return result, plan.status
