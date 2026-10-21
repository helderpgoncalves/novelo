"""Visão geral para a página inicial: junta o ponto de partida, as referências, os prazos, as freguesias e os cenários.

Só lê. Todos os números vêm da BD, do baseline existente ou de constantes com fonte em `references.py`.
"""

from collections import defaultdict
from datetime import date
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import defer

from novelo.domain.benchmarks import target_tonnes
from novelo.domain.overview import days_until, pareto_ids, parish_potential_t, share_pct
from novelo.domain.parish_area import geometry_area_km2
from novelo.domain.vocab import CollectionMode, ContainerStatus, ScenarioStatus, WasteCategory, WasteScope
from novelo.features.datasets.models import DataSource
from novelo.features.network.models import (
    Circuit,
    CircuitLocality,
    Container,
    FleetCapacity,
    Locality,
    Parish,
    ShiftAssignment,
)
from novelo.features.planning.models import Scenario
from novelo.features.textile import service
from novelo.features.textile.models import TextileFlow, WasteShare
from novelo.features.textile.references import (
    EXTERNAL_REFERENCES,
    FRANCE_KEY,
    KG_PER_INHAB_MONTH,
    MILESTONES,
    POTENTIAL_SOURCE_LABEL,
)
from novelo.features.textile.schemas import (
    FrontierPoint,
    Overview,
    OverviewDataSource,
    OverviewDestinations,
    OverviewGap,
    OverviewHighlight,
    OverviewMilestone,
    OverviewParish,
    OverviewPoint,
    OverviewReference,
    TextileBaseline,
)

MONTHS = 12
MAX_SCENARIOS = 200
TOP_PARISHES = 5

_SOURCE_KIND = {
    "vitrus_textile_2025": "operator",
    "vitrus_circuits_2026_09": "operator",
    "ine_census_2021": "public_statistics",
    "osm_nominatim": "public_geodata",
    "vitrus_apa_rsu_2025": "operator",
}
_GEOCODED_SOURCE = "osm_nominatim"


def _gap(base: TextileBaseline, parishes_count: int) -> OverviewGap:
    potential = base.estimated_demand_t  # gerado = por desviar + recolhido
    per_inhab_month = potential * 1000 / base.population / MONTHS if base.population else 0.0
    return OverviewGap(
        year=base.year,
        potential_t=potential,
        collected_t=base.total_t,
        missing_t=base.gap_t,  # o que ainda vai para o lixo: 43 051 t × 5,4%
        capture_pct=base.capture_of_demand_pct,
        destinations=OverviewDestinations(reuse_t=base.reuse_t, recycle_t=base.recycle_t, reject_t=base.reject_t),
        kg_per_inhab_year=round(base.kg_per_inhab_month * MONTHS, 2),
        kg_per_inhab_month=base.kg_per_inhab_month,
        potential_kg_per_inhab_year=round(per_inhab_month * MONTHS, 2),
        potential_kg_per_inhab_month=round(per_inhab_month, 3),
        missing_kg_per_inhab_year=round(KG_PER_INHAB_MONTH * MONTHS, 2),
        missing_kg_per_inhab_month=round(KG_PER_INHAB_MONTH, 3),
        potential_source_label=POTENTIAL_SOURCE_LABEL,
        population=base.population,
        parishes_count=parishes_count,
    )


def _references(gap: OverviewGap) -> list[OverviewReference]:
    refs = [
        OverviewReference(
            key="guimaraes_2025",
            label="Guimarães hoje",
            kg_per_inhab_year=gap.kg_per_inhab_year,
            year=gap.year,
            scope="municipality",
            source_label="Vitrus (dados_textil.xlsx) e INE (Censos 2021); cálculo nosso",
            source_url=None,
            verified=True,
            evidence="dado_vitrus",
            is_estimate=False,
        ),
        OverviewReference(
            key="guimaraes_potential",
            label="Têxtil gerado em Guimarães (estimativa)",
            kg_per_inhab_year=gap.potential_kg_per_inhab_year,
            year=gap.year,
            scope="municipality",
            source_label=f"{POTENTIAL_SOURCE_LABEL}; cálculo nosso",
            source_url=None,
            verified=True,
            evidence="dado_vitrus",
            is_estimate=True,
        ),
    ]
    refs += [
        OverviewReference(
            key=r.key,
            label=r.label,
            kg_per_inhab_year=r.kg_per_inhab_year,
            year=r.year,
            scope=r.scope,
            source_label=r.source_label,
            source_url=r.source_url,
            verified=r.verified,
            evidence=r.evidence,
            is_estimate=r.evidence != "primary",
        )
        for r in EXTERNAL_REFERENCES
    ]
    return refs


def _timeline(today: date) -> list[OverviewMilestone]:
    out = []
    for m in MILESTONES:
        remaining = days_until(m.date, today)
        out.append(
            OverviewMilestone(
                date=m.date,
                key=m.key,
                status="upcoming" if remaining is not None else "done",
                days_remaining=remaining,
                who_pays=m.who_pays,
                source_label=m.source_label,
                source_url=m.source_url,
                verified=m.verified,
            )
        )
    return out


async def _count_by_parish(db: AsyncSession, column: Any, *where: Any, joins: Any = None) -> dict[Any, int]:
    stmt = select(Locality.parish_id, func.count(column)).where(Locality.parish_id.is_not(None), *where)
    if joins is not None:
        stmt = stmt.join(CircuitLocality, CircuitLocality.locality_id == Locality.id)
    rows = (await db.execute(stmt.group_by(Locality.parish_id))).all()
    return {pid: int(n) for pid, n in rows}


async def _parishes(db: AsyncSession) -> list[OverviewParish]:
    rows = (await db.execute(select(Parish))).scalars().all()
    total_pop = sum(p.population or 0 for p in rows)
    localities = await _count_by_parish(db, Locality.id)
    circuits = await _count_by_parish(db, func.distinct(CircuitLocality.circuit_id), joins=True)
    containers = {
        pid: int(n)
        for pid, n in (
            await db.execute(
                select(Container.parish_id, func.count())
                .where(Container.parish_id.is_not(None), Container.status == ContainerStatus.ACTIVE)
                .group_by(Container.parish_id)
            )
        ).all()
    }
    out = []
    for p in sorted(rows, key=lambda r: (-(r.population or 0), r.name)):
        pop = p.population or 0
        area = float(p.area_km2) if p.area_km2 is not None else geometry_area_km2(p.geometry)
        centroid = (
            OverviewPoint(lat=float(p.latitude), lon=float(p.longitude))
            if p.latitude is not None and p.longitude is not None
            else None
        )
        out.append(
            OverviewParish(
                code=p.dicofre,
                name=p.name,
                population=pop,
                tipau=p.tipau,
                potential_t=round(parish_potential_t(pop, KG_PER_INHAB_MONTH), 2),
                circuits_count=circuits.get(p.id, 0),
                localities_count=localities.get(p.id, 0),
                containers_count=containers.get(p.id, 0),
                area_km2=round(area, 2) if area is not None else None,
                centroid=centroid,
                share_of_population_pct=round(share_pct(pop, total_pop), 2),
            )
        )
    return out


MIN_SITE_SCENARIOS = 2


async def _frontier(db: AsyncSession) -> tuple[list[FrontierPoint], list[Any]]:
    stmt = (
        select(Scenario)
        .options(defer(Scenario.result), defer(Scenario.params), defer(Scenario.constraints))
        .order_by(Scenario.created_at.desc())
        .limit(MAX_SCENARIOS)
    )
    rows = list((await db.execute(stmt)).scalars())
    # A rede por locais reais é a que respeita onde há pontos de recolha: com pelo menos dois cenários assim, a
    # fronteira e o controlo de orçamento da sala de decisão usam só esses (misturar com a rede por freguesia, mais
    # otimista, faria a interpolação saltar entre dois modelos).
    # Os cenários de referência (recalculados no arranque, sempre com o modelo atual) têm prioridade: a sala de decisão
    # não pode depender de cenários de teste ou rascunhos que alguém guardou.
    reference_sites = [r for r in rows if r.reference_key is not None and r.siting == "sites"]
    by_sites = [r for r in rows if r.siting == "sites"]
    if len(reference_sites) >= MIN_SITE_SCENARIOS:
        rows = reference_sites
    elif len(by_sites) >= MIN_SITE_SCENARIOS:
        rows = by_sites
    points: list[FrontierPoint] = []
    for s in rows:
        modes = [CollectionMode(m) for m in s.modes]
        points.append(
            FrontierPoint(
                id=s.id,
                label=s.label,
                tonnes_year=float(s.tonnes_year),
                eur_per_tonne=float(s.eur_per_tonne) if s.eur_per_tonne is not None else None,
                annual_cost_eur=float(s.annual_cost_eur),
                capex_eur=float(s.capex_eur),
                modes=modes,
                status="feasible" if s.status == ScenarioStatus.COMPUTED else "infeasible",
                objective=s.objective,
                is_pareto=False,
            )
        )
    candidates = [(p.id, p.eur_per_tonne, p.tonnes_year) for p in points if p.status == "feasible" and p.eur_per_tonne]
    front = set(pareto_ids(candidates))
    for p in points:
        p.is_pareto = p.id in front
    return points, [p.id for p in points if p.is_pareto]


async def _data_sources(db: AsyncSession) -> list[OverviewDataSource]:
    sources = (await db.execute(select(DataSource).order_by(DataSource.received_on, DataSource.key))).scalars().all()
    rows: dict[Any, int] = defaultdict(int)
    for model in (TextileFlow, WasteShare, Circuit, ShiftAssignment, Parish, Container, FleetCapacity):
        for source_id, n in (await db.execute(select(model.source_id, func.count()).group_by(model.source_id))).all():
            if source_id is not None:
                rows[source_id] += int(n)
    geocoded = int(
        await db.scalar(select(func.count()).select_from(Locality).where(Locality.latitude.is_not(None))) or 0
    )
    methods: dict[Any, list[Any]] = defaultdict(list)
    for source_id, method in (await db.execute(select(TextileFlow.source_id, TextileFlow.method).distinct())).all():
        methods[source_id].append(method)
    out = []
    for s in sources:
        n = rows[s.id] + (geocoded if s.key == _GEOCODED_SOURCE else 0)
        out.append(
            OverviewDataSource(
                key=s.key,
                name=s.title,
                provider=s.provider,
                kind=_SOURCE_KIND.get(s.key, "other"),
                period_start=s.period_start,
                period_end=s.period_end,
                methods=sorted(methods.get(s.id, [])),
                rows=n,
            )
        )
    return out


async def _textile_share_in_mixed_waste(db: AsyncSession) -> float | None:
    value = await db.scalar(
        select(WasteShare.share_pct).where(
            WasteShare.scope == WasteScope.PORTUGAL, WasteShare.category == WasteCategory.TEXTILES
        )
    )
    return float(value) if value is not None else None


async def _highlights(
    db: AsyncSession, base: TextileBaseline, parishes: list[OverviewParish]
) -> list[OverviewHighlight]:
    out: list[OverviewHighlight] = []
    if base.entities and base.total_t > 0:
        top = base.entities[0]
        out.append(
            OverviewHighlight(
                key="top_entity_share",
                value=round(share_pct(top.total_t, base.total_t), 1),
                unit="pct",
                text_key="overview.highlights.topEntityShare",
                context={"entity": top.entity, "tonnes": top.total_t, "total_t": base.total_t},
                source_label="Vitrus, dados_textil.xlsx",
                verified=True,
                is_estimate=False,
            )
        )
        out.append(
            OverviewHighlight(
                key="reuse_share",
                value=round(share_pct(base.reuse_t, base.total_t), 1),
                unit="pct",
                text_key="overview.highlights.reuseShare",
                context={"reuse_t": base.reuse_t, "total_t": base.total_t},
                source_label="Vitrus, dados_textil.xlsx (duas entidades por percentagens de relatório)",
                verified=True,
                is_estimate=True,
            )
        )
    france = next(r for r in EXTERNAL_REFERENCES if r.key == FRANCE_KEY)
    france_t = target_tonnes(france.kg_per_inhab_year, base.population)
    out.append(
        OverviewHighlight(
            key="france_equivalent_t",
            value=round(france_t, 1),
            unit="t",
            text_key="overview.highlights.franceEquivalent",
            context={
                "kg_per_inhab_year": france.kg_per_inhab_year,
                "collected_t": base.total_t,
                "multiple": round(france_t / base.total_t, 1) if base.total_t else 0.0,
            },
            source_label=f"{france.source_label}; cálculo nosso",
            verified=france.verified,
            is_estimate=True,
        )
    )
    mixed = await _textile_share_in_mixed_waste(db)
    if mixed is not None:
        out.append(
            OverviewHighlight(
                key="textile_in_mixed_waste",
                value=mixed,
                unit="pct",
                text_key="overview.highlights.textileInMixedWaste",
                context={},
                source_label="Caracterização dos resíduos urbanos (Vitrus, dados_textil.xlsx), Portugal",
                verified=True,
                is_estimate=False,
            )
        )
    sized = [p for p in parishes if p.population > 0]
    if len(sized) >= 2:
        largest, smallest = sized[0], sized[-1]
        out.append(
            OverviewHighlight(
                key="parish_size_ratio",
                value=round(largest.population / smallest.population, 1),
                unit="x",
                text_key="overview.highlights.parishSizeRatio",
                context={
                    "largest": largest.name,
                    "largest_population": largest.population,
                    "smallest": smallest.name,
                    "smallest_population": smallest.population,
                },
                source_label="INE, Censos 2021",
                verified=True,
                is_estimate=False,
            )
        )
        top_pop = sum(p.population for p in sized[:TOP_PARISHES])
        out.append(
            OverviewHighlight(
                key="top_parishes_share",
                value=round(share_pct(top_pop, sum(p.population for p in sized)), 1),
                unit="pct",
                text_key="overview.highlights.topParishesShare",
                context={"count": TOP_PARISHES},
                source_label="INE, Censos 2021",
                verified=True,
                is_estimate=False,
            )
        )
    return out


async def get_overview(db: AsyncSession, today: date) -> Overview:
    base = await service.get_baseline(db)
    parishes = await _parishes(db)
    gap = _gap(base, len(parishes))
    frontier, front_ids = await _frontier(db)
    return Overview(
        gap=gap,
        references=_references(gap),
        timeline=_timeline(today),
        parishes=parishes,
        scenario_frontier=frontier,
        pareto_ids=front_ids,
        data_sources=await _data_sources(db),
        highlights=await _highlights(db, base, parishes),
    )
