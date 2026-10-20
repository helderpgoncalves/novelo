"""Simulador: lê as zonas e os pressupostos, corre o otimizador e guarda o cenário."""

import asyncio
import uuid
from collections import defaultdict
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import defer, selectinload

from novelo.core.errors import NotFoundError
from novelo.domain import network
from novelo.domain.demand import yearly_demand_t
from novelo.domain.vocab import CollectionMode, ContainerKind, ContainerStatus, ScenarioStatus, TextileDestination
from novelo.features.network.models import Circuit, Container, Locality, Parish
from novelo.features.planning.models import ParameterSet, Scenario
from novelo.features.planning.params import default_params, params_meta
from novelo.features.planning.schemas import (
    Allocation,
    AllocationPart,
    Kpis,
    ModeSummary,
    ParametersOut,
    PlanningParams,
    RouteOut,
    RouteStop,
    ScenarioOut,
    ScenarioRequest,
    ScenarioResult,
    ScenarioSummary,
    ZoneOut,
)
from novelo.features.textile import service as textile
from novelo.features.textile.schemas import FlowLink, FlowNode, Flows
from novelo.features.users.models import User

DEFAULT_SET_NAME = "Pressupostos da equipa"


# --- Pressupostos ---


async def ensure_default_parameters(db: AsyncSession) -> ParameterSet:
    existing = (await db.execute(select(ParameterSet).where(ParameterSet.is_default))).scalars().first()
    if existing:
        return existing
    row = ParameterSet(
        name=DEFAULT_SET_NAME,
        description="Pressupostos iniciais; os custos unitários aguardam validação da Vitrus.",
        is_default=True,
        values=default_params().model_dump(mode="json"),
    )
    db.add(row)
    await db.commit()
    return row


async def get_parameters(db: AsyncSession) -> ParametersOut:
    row = await ensure_default_parameters(db)
    return ParametersOut(
        values=PlanningParams.model_validate(row.values),
        version=row.version,
        meta=params_meta(),
        updated_at=row.updated_at,
    )


async def update_parameters(db: AsyncSession, params: PlanningParams, user: User) -> ParametersOut:
    row = await ensure_default_parameters(db)
    row.values = params.model_dump(mode="json")
    row.version += 1
    row.updated_by_id = user.id
    await db.commit()
    return await get_parameters(db)


# --- Zonas ---


async def load_zone_rows(db: AsyncSession, kg_per_inhab_month: float) -> list[ZoneOut]:
    parishes = (
        (await db.execute(select(Parish).where(Parish.population.is_not(None)).order_by(Parish.name))).scalars().all()
    )
    localities = (await db.execute(select(Locality).where(Locality.parish_id.is_not(None)))).scalars().all()
    # Dias por semana com serviço: o máximo entre os circuitos que passam em localidades da freguesia.
    days_by_locality: dict[uuid.UUID, int] = {}
    circuits = (
        (await db.execute(select(Circuit).options(selectinload(Circuit.days), selectinload(Circuit.localities))))
        .scalars()
        .all()
    )
    for c in circuits:
        for cl in c.localities:
            days_by_locality[cl.locality_id] = max(days_by_locality.get(cl.locality_id, 0), len(c.days))
    # Contentores têxteis ativos por freguesia (vazio até chegarem as localizações da Vitrus).
    container_counts = await db.execute(
        select(Container.parish_id, func.count())
        .where(
            Container.kind == ContainerKind.TEXTILE,
            Container.status == ContainerStatus.ACTIVE,
            Container.parish_id.is_not(None),
        )
        .group_by(Container.parish_id)
    )
    containers_by_parish = {pid: n for pid, n in container_counts.all() if pid is not None}
    by_parish: dict[uuid.UUID, list[Locality]] = defaultdict(list)
    for loc in localities:
        if loc.parish_id:
            by_parish[loc.parish_id].append(loc)

    zones = []
    for p in parishes:
        if p.latitude is None or p.longitude is None or p.population is None:
            continue
        locs = by_parish.get(p.id, [])
        zones.append(
            ZoneOut(
                code=p.dicofre,
                name=p.name,
                population=p.population,
                population_year=p.population_year,
                demand_t=round(yearly_demand_t(p.population, kg_per_inhab_month), 2),
                latitude=float(p.latitude),
                longitude=float(p.longitude),
                tipau=p.tipau,
                service_days=max((days_by_locality.get(loc.id, 0) for loc in locs), default=0),
                existing_containers=containers_by_parish.get(p.id, 0),
                localities=sorted(loc.name for loc in locs),
                geometry=p.geometry,
            )
        )
    return zones


async def list_zones(db: AsyncSession) -> list[ZoneOut]:
    params = await get_parameters(db)
    return await load_zone_rows(db, params.values.kg_per_inhab_month)


# --- Cenários ---


def _domain_params(p: PlanningParams) -> network.Params:
    return network.Params(
        kg_per_inhab_month=p.kg_per_inhab_month,
        modes={m: network.ModeParams(**mp.model_dump()) for m, mp in p.modes.items()},
        cost_per_collection_eur=p.cost_per_collection_eur,
        cost_per_km_eur=p.cost_per_km_eur,
        detour_factor=p.detour_factor,
        on_demand_kg_per_pickup=p.on_demand_kg_per_pickup,
        piggyback_extra_km=p.piggyback_extra_km,
        piggyback_min_days=p.piggyback_min_days,
        vehicle_capacity_t=p.vehicle_capacity_t,
        depot=(p.depot_lat, p.depot_lon),
    )


def compute(
    zones: list[ZoneOut], params: PlanningParams, request: ScenarioRequest, baseline_t: float
) -> tuple[ScenarioResult, str]:
    """Núcleo puro do simulador (sem base de dados): escolhe as combinações de modos, planeia rotas e calcula KPIs."""
    dp = _domain_params(params)
    dzones = [
        network.Zone(
            z.code, z.name, z.population, z.latitude, z.longitude, z.service_days, z.existing_containers or None
        )
        for z in zones
    ]
    allowed = {code: set(modes) for code, modes in request.constraints.items()}
    options = network.build_options(dzones, dp, allowed or None)

    solved = network.solve(
        options,
        request.objective.value,
        budget_eur_year=request.budget_eur_year,
        target_tonnes=request.target_tonnes,
        time_limit_s=params.solver_time_limit_s,
    )
    zone_by_code = {z.code: z for z in zones}

    # Têxtil de cada canal numa opção combinada: partilha proporcional à captura de cada canal.
    tonnes_by_part: dict[tuple[str, CollectionMode], float] = {}
    for o in solved.chosen:
        total_capture = sum(p.capture for p in o.parts) or 1.0
        for p in o.parts:
            tonnes_by_part[(o.zone_id, p.mode)] = o.tonnes * p.capture / total_capture

    # Rotas (VRP) por modo com paragens fixas; os km reais substituem a estimativa radial.
    routes: list[RouteOut] = []
    km_scale: dict[CollectionMode, float] = {}
    for mode in (CollectionMode.STREET, CollectionMode.EXISTING):
        group = [o for o in solved.chosen if mode in o.modes]
        if not group:
            continue
        freq = params.modes[mode].collections_per_year
        loads = {o.zone_id: tonnes_by_part[(o.zone_id, mode)] / max(freq, 1) for o in group}
        stops = [
            network.Stop(
                o.zone_id, zone_by_code[o.zone_id].latitude, zone_by_code[o.zone_id].longitude, loads[o.zone_id]
            )
            for o in group
        ]
        plan = network.plan_routes(stops, dp, time_limit_s=max(1, params.solver_time_limit_s // 10))
        radial = sum(p.km_year for o in group for p in o.parts if p.mode == mode)
        km_scale[mode] = plan.km_per_round * freq / radial if radial else 1.0
        for r in plan.routes:
            routes.append(
                RouteOut(
                    mode=mode,
                    vehicle=r.vehicle,
                    stops=[
                        RouteStop(
                            parish_code=code,
                            parish_name=zone_by_code[code].name,
                            latitude=zone_by_code[code].latitude,
                            longitude=zone_by_code[code].longitude,
                            load_t=round(loads[code], 3),
                        )
                        for code in r.stops
                    ],
                    km=round(r.km, 2),
                    load_t=round(r.load_t, 3),
                    path=[[lat, lon] for lat, lon in r.path],
                )
            )

    chosen_by_zone = {o.zone_id: o for o in solved.chosen}
    allocations: list[Allocation] = []
    for z in zones:
        option = chosen_by_zone.get(z.code)
        if option is None:
            allocations.append(
                Allocation(
                    parish_code=z.code,
                    parish_name=z.name,
                    population=z.population,
                    demand_t=z.demand_t,
                    mode=None,
                    modes=[],
                    parts=[],
                    points=0,
                    tonnes=0,
                    covered_population=0,
                    capex_eur=0,
                    annual_cost_eur=0,
                    km_year=0,
                )
            )
            continue
        parts = []
        for p in option.parts:
            km = p.km_year * km_scale.get(p.mode, 1.0)
            opex = p.opex_eur_year + (km - p.km_year) * params.cost_per_km_eur
            parts.append(
                AllocationPart(
                    mode=p.mode,
                    points=p.points,
                    tonnes=round(tonnes_by_part[(z.code, p.mode)], 3),
                    capex_eur=round(p.capex_eur, 2),
                    annual_cost_eur=round(p.capex_eur / params.modes[p.mode].lifetime_years + opex, 2),
                    km_year=round(km, 1),
                )
            )
        parts.sort(key=lambda x: -x.tonnes)
        allocations.append(
            Allocation(
                parish_code=z.code,
                parish_name=z.name,
                population=z.population,
                demand_t=z.demand_t,
                mode=parts[0].mode,
                modes=[x.mode for x in parts],
                parts=parts,
                points=sum(x.points for x in parts),
                tonnes=round(option.tonnes, 3),
                covered_population=round(option.population_covered),
                capex_eur=round(sum(x.capex_eur for x in parts), 2),
                annual_cost_eur=round(sum(x.annual_cost_eur for x in parts), 2),
                km_year=round(sum(x.km_year for x in parts), 1),
            )
        )

    total_pop = sum(z.population for z in zones)
    tonnes = sum(a.tonnes for a in allocations)
    capex = sum(a.capex_eur for a in allocations)
    annual = sum(a.annual_cost_eur for a in allocations)
    annuity = sum(x.capex_eur / params.modes[x.mode].lifetime_years for a in allocations for x in a.parts)
    kpis = Kpis(
        capex_eur=round(capex, 2),
        opex_eur_year=round(annual - annuity, 2),
        annual_cost_eur=round(annual, 2),
        tonnes_year=round(tonnes, 3),
        eur_per_tonne=round(annual / tonnes, 2) if tonnes > 0 else None,
        coverage_pct=round(sum(a.covered_population for a in allocations) / total_pop * 100, 1) if total_pop else 0.0,
        points=sum(a.points for a in allocations),
        km_year=round(sum(a.km_year for a in allocations), 1),
        potential_t=round(sum(z.demand_t for z in zones), 1),
        baseline_observed_t=round(baseline_t, 1),
    )
    modes = [
        ModeSummary(
            mode=m,
            zones=sum(1 for a in allocations if m in a.modes),
            points=sum(x.points for a in allocations for x in a.parts if x.mode == m),
            tonnes=round(sum(x.tonnes for a in allocations for x in a.parts if x.mode == m), 3),
            annual_cost_eur=round(sum(x.annual_cost_eur for a in allocations for x in a.parts if x.mode == m), 2),
        )
        for m in CollectionMode
        if any(m in a.modes for a in allocations)
    ]
    result = ScenarioResult(
        kpis=kpis, allocations=allocations, routes=routes, modes=modes, depot=[params.depot_lat, params.depot_lon]
    )
    return result, solved.status


def _summary(row: Scenario) -> ScenarioSummary:
    return ScenarioSummary(
        id=row.id,
        label=row.label,
        objective=row.objective,
        status=row.status,
        budget_eur_year=float(row.budget_eur_year) if row.budget_eur_year is not None else None,
        target_tonnes=float(row.target_tonnes) if row.target_tonnes is not None else None,
        tonnes_year=float(row.tonnes_year),
        capex_eur=float(row.capex_eur),
        annual_cost_eur=float(row.annual_cost_eur),
        eur_per_tonne=float(row.eur_per_tonne) if row.eur_per_tonne is not None else None,
        coverage_pct=float(row.coverage_pct),
        parent_id=row.parent_id,
        created_at=row.created_at,
    )


def _out(row: Scenario) -> ScenarioOut:
    return ScenarioOut(
        **_summary(row).model_dump(),
        solver_status=row.solver_status,
        params=PlanningParams.model_validate(row.params),
        constraints=row.constraints,
        result=ScenarioResult.model_validate(row.result),
    )


async def run_scenario(db: AsyncSession, request: ScenarioRequest, user: User) -> ScenarioOut:
    stored = await ensure_default_parameters(db)
    params = request.params or PlanningParams.model_validate(stored.values)
    zones = await load_zone_rows(db, params.kg_per_inhab_month)
    baseline = await textile.get_baseline(db)
    # CP-SAT e VRP são CPU síncrono (até `solver_time_limit_s`): fora do event loop, com dados puros (sem sessão).
    result, solver_status = await asyncio.to_thread(compute, zones, params, request, baseline.total_t)

    infeasible = solver_status == "infeasible"
    kpis = result.kpis
    row = Scenario(
        label=request.label,
        objective=request.objective,
        budget_eur_year=Decimal(str(request.budget_eur_year)) if request.budget_eur_year is not None else None,
        target_tonnes=Decimal(str(request.target_tonnes)) if request.target_tonnes is not None else None,
        status=ScenarioStatus.INFEASIBLE if infeasible else ScenarioStatus.COMPUTED,
        solver_status=solver_status,
        params=params.model_dump(mode="json"),
        parameter_set_version=stored.version,
        constraints={k: [m.value for m in v] for k, v in request.constraints.items()},
        result=result.model_dump(mode="json"),
        modes=[m.mode.value for m in result.modes if m.zones > 0],
        tonnes_year=Decimal(str(kpis.tonnes_year)),
        capex_eur=Decimal(str(kpis.capex_eur)),
        annual_cost_eur=Decimal(str(kpis.annual_cost_eur)),
        eur_per_tonne=Decimal(str(kpis.eur_per_tonne)) if kpis.eur_per_tonne is not None else None,
        coverage_pct=Decimal(str(kpis.coverage_pct)),
        parent_id=request.parent_id,
        created_by_id=user.id,
    )
    db.add(row)
    await db.commit()
    return _out(row)


async def list_scenarios(db: AsyncSession, limit: int | None = None) -> list[ScenarioSummary]:
    """Resumos (KPIs desnormalizados): o JSON do resultado, dos pressupostos e das restrições fica na base."""
    stmt = (
        select(Scenario)
        .options(defer(Scenario.result), defer(Scenario.params), defer(Scenario.constraints))
        .order_by(Scenario.created_at.desc())
    )
    if limit is not None:
        stmt = stmt.limit(limit)
    rows = (await db.execute(stmt)).scalars().all()
    return [_summary(r) for r in rows]


async def get_scenario(db: AsyncSession, scenario_id: uuid.UUID) -> ScenarioOut:
    row = await db.get(Scenario, scenario_id)
    if row is None:
        raise NotFoundError("Scenario not found")
    return _out(row)


async def rename_scenario(db: AsyncSession, scenario_id: uuid.UUID, label: str) -> ScenarioSummary:
    row = await db.get(Scenario, scenario_id)
    if row is None:
        raise NotFoundError("Scenario not found")
    row.label = label
    await db.commit()
    return _summary(row)


async def delete_scenario(db: AsyncSession, scenario_id: uuid.UUID) -> None:
    row = await db.get(Scenario, scenario_id)
    if row is None:
        raise NotFoundError("Scenario not found")
    await db.delete(row)
    await db.commit()


async def scenario_flows(db: AsyncSession, scenario_id: uuid.UUID) -> Flows:
    """Sankey previsto: freguesia -> modo de recolha -> destino (com a repartição observada em 2025)."""
    scenario = await get_scenario(db, scenario_id)
    baseline = await textile.get_baseline(db)
    split = {
        TextileDestination.REUSE: baseline.reuse_t / baseline.total_t,
        TextileDestination.RECYCLE: baseline.recycle_t / baseline.total_t,
        TextileDestination.REJECT: baseline.reject_t / baseline.total_t,
    }
    active = [a for a in scenario.result.allocations if a.parts and a.tonnes > 0]
    top = sorted(active, key=lambda a: -a.tonnes)[:12]
    rest = [a for a in active if a not in top]

    nodes: list[FlowNode] = []
    links: list[FlowLink] = []
    by_mode: dict[CollectionMode, float] = defaultdict(float)
    for a in top:
        nodes.append(FlowNode(id=f"z:{a.parish_code}", column=0, label=a.parish_name))
        for part in a.parts:
            links.append(FlowLink(source=f"z:{a.parish_code}", target=f"m:{part.mode.value}", tonnes=part.tonnes))
            by_mode[part.mode] += part.tonnes
    if rest:
        nodes.append(FlowNode(id="z:others", column=0, label=None))
        for mode in CollectionMode:
            t = sum(part.tonnes for a in rest for part in a.parts if part.mode == mode)
            if t:
                links.append(FlowLink(source="z:others", target=f"m:{mode.value}", tonnes=round(t, 3)))
                by_mode[mode] += t
    for mode, t in by_mode.items():
        nodes.append(FlowNode(id=f"m:{mode.value}", column=1, mode=mode))
        for destination, share in split.items():
            links.append(FlowLink(source=f"m:{mode.value}", target=destination.value, tonnes=round(t * share, 3)))
    nodes += [FlowNode(id=d.value, column=2, destination=d) for d in TextileDestination]
    return Flows(observed=False, nodes=nodes, links=links)
