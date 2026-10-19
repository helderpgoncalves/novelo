from collections import defaultdict
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.domain.demand import Baseline
from novelo.domain.vocab import TextileDestination, WeighingMethod
from novelo.features.textile.models import TextileEntity, TextileFlow, WasteShare
from novelo.features.textile.schemas import (
    EntityBaseline,
    FlowLink,
    FlowNode,
    Flows,
    TextileBaseline,
    WasteComposition,
    WasteShareOut,
)

# Plano de Ação para a Circularidade Têxtil de Guimarães (nov. 2025).
POPULATION = 156_277
KG_PER_INHAB_MONTH_PLAN = 0.7
PT_KG_PER_INHAB_YEAR = 517  # Portugal continental, 2024
BASELINE_YEAR = 2025

_ZERO = Decimal(0)


async def _entity_rows(db: AsyncSession, year: int) -> list[EntityBaseline]:
    rows = (
        await db.execute(
            select(
                TextileEntity.name,
                TextileFlow.destination,
                TextileFlow.tonnes,
                TextileFlow.method,
                TextileFlow.provenance,
            )
            .join(TextileFlow, TextileFlow.entity_id == TextileEntity.id)
            .where(TextileFlow.year == year)
            .order_by(TextileEntity.name)
        )
    ).all()
    tonnes: dict[str, dict[TextileDestination, Decimal]] = defaultdict(lambda: defaultdict(lambda: _ZERO))
    meta: dict[str, tuple[WeighingMethod, str | None]] = {}
    for name, destination, value, method, provenance in rows:
        tonnes[name][destination] += value
        meta[name] = (method, provenance)

    entities = []
    for name in sorted(tonnes, key=lambda n: -sum(tonnes[n].values())):
        t = tonnes[name]
        total = float(sum(t.values()))
        part = {d: float(t[d]) for d in TextileDestination}
        entities.append(
            EntityBaseline(
                entity=name,
                total_t=round(total, 3),
                reuse_t=round(part[TextileDestination.REUSE], 3),
                recycle_t=round(part[TextileDestination.RECYCLE], 3),
                reject_t=round(part[TextileDestination.REJECT], 3),
                reuse_pct=round(part[TextileDestination.REUSE] / total * 100, 1),
                recycle_pct=round(part[TextileDestination.RECYCLE] / total * 100, 1),
                reject_pct=round(part[TextileDestination.REJECT] / total * 100, 1),
                method=meta[name][0],
                provenance=meta[name][1],
            )
        )
    return entities


async def get_baseline(db: AsyncSession, year: int = BASELINE_YEAR) -> TextileBaseline:
    entities = await _entity_rows(db, year)
    total = sum(e.total_t for e in entities)
    base = Baseline(total, POPULATION, KG_PER_INHAB_MONTH_PLAN)
    return TextileBaseline(
        year=year,
        population=POPULATION,
        entities=entities,
        total_t=round(total, 3),
        reuse_t=round(sum(e.reuse_t for e in entities), 3),
        recycle_t=round(sum(e.recycle_t for e in entities), 3),
        reject_t=round(sum(e.reject_t for e in entities), 3),
        kg_per_inhab_month=round(base.observed_kg_per_inhab_month, 3),
        estimated_demand_t=round(base.demand_t, 1),
        capture_of_demand_pct=round(base.observed_capture_rate * 100, 1),
        gap_t=round(base.demand_t - total, 1),
    )


async def get_observed_flows(db: AsyncSession, year: int = BASELINE_YEAR) -> Flows:
    """Fluxo observado entidade → destino, em toneladas (Sankey do ponto de partida)."""
    entities = await _entity_rows(db, year)
    nodes = [FlowNode(id=d.value, column=1, destination=d) for d in TextileDestination]
    links: list[FlowLink] = []
    for e in entities:
        nodes.append(FlowNode(id=e.entity, column=0, label=e.entity))
        for destination, tonnes in (
            (TextileDestination.REUSE, e.reuse_t),
            (TextileDestination.RECYCLE, e.recycle_t),
            (TextileDestination.REJECT, e.reject_t),
        ):
            links.append(FlowLink(source=e.entity, target=destination.value, tonnes=tonnes))
    return Flows(observed=True, nodes=nodes, links=links)


async def get_waste_composition(db: AsyncSession) -> WasteComposition:
    rows = (await db.execute(select(WasteShare.scope, WasteShare.category, WasteShare.share_pct))).all()
    shares = [WasteShareOut(scope=s, category=c, share_pct=float(p)) for s, c, p in rows]
    return WasteComposition(shares=shares, kg_per_inhab_year_pt=PT_KG_PER_INHAB_YEAR)
