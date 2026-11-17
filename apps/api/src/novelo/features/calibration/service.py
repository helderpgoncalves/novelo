"""Recomputação dos agregados de calibração: a ÚNICA ponte entre os eventos e o planeamento.

Aqui (e só aqui) se leem os eventos — partidas da viatura com pesos medidos (`lots`/`lot_units`, #58)
e pedidos de recolha (`collection_requests`, #60) — para reconstruir a tabela `calibration_aggregates`
(métrica × unidade × janela de 12 semanas). O gatilho é sempre o recálculo de um cenário
(`planning.service.run_scenario`); nunca há agenda nem fundo de service. O planeamento depois lê
APENAS esta tabela (`load_rows` → `calibration_of_rows` → `compute`, tudo puro): eventos individuais
e moradas nunca chegam ao otimizador (ADR: captura anual é derivada; RGPD da conta de doador).

Priors (pressupostos documentados em docs/engenharia/dados-e-modelo.md §Calibração):
  taxa de geração por local   D_z ÷ n.º de locais da freguesia ÷ 365 (repartição uniforme, estimativa)
  captura prior               capture_rate × coverage_factor do modo a pedido
  kg por saco                 `on_demand_kg_per_pickup` (25 kg)
  sacos por ronda             D_z × captura prior ÷ kg por saco ÷ rondas por ano
  pedidos por semana          0 (sinal de arranque: não há prior)
Os locais não visitados melhoram pela conversão observada nos visitados (`improved_prior`), nunca para
além desse blend; o `q` da APA nunca é substituído (a procura entra pronta nos priores). A tabela
reconstrói-se inteira a cada recálculo (idempotente): é sempre a última fotografia completa.
"""

import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.domain import calibration, fleet
from novelo.domain.calibration import (
    PSEUDO_K_LOCAL,
    PSEUDO_K_PARISH,
    Calibration,
    Reading,
    blend,
    improved_prior,
    median,
    observed_weeks,
    observed_weight,
    pooled_kg_per_bag,
    sample_label,
    visit_rates,
    weekly_means,
    weekly_request_rate,
    window_start,
)
from novelo.domain.vocab import CalibrationMetric, CalibrationScope, CollectionMode
from novelo.features.calibration.models import CalibrationAggregate
from novelo.features.calibration.schemas import CalibrationOut, CalibrationPhoto, CalibrationReadingOut
from novelo.features.collection_requests.models import CollectionRequest
from novelo.features.lots.models import Lot, LotUnit
from novelo.features.network.models import Locality, Parish
from novelo.features.planning.schemas import PlanningParams

WINDOW_WEEKS = calibration.WINDOW_WEEKS
PICKUP_CODE = "concelho"


@dataclass
class _Context:
    """Os priores e a janela de um recálculo (derivam dos pressupostos do cenário que o aciona)."""

    now: datetime
    start: datetime
    parishes: dict[uuid.UUID, Parish] = field(default_factory=dict)
    parish_by_code: dict[str, Parish] = field(default_factory=dict)
    localities: dict[uuid.UUID, Locality] = field(default_factory=dict)
    demand_kg: dict[uuid.UUID, float] = field(default_factory=dict)
    prior_taxa: dict[uuid.UUID, float] = field(default_factory=dict)  # por localidade
    prior_capture_rate: float = 0.0
    prior_kg_bag: float = 0.0
    prior_bags_round: dict[uuid.UUID, float] = field(default_factory=dict)  # por freguesia


# --- Leitura (o planeamento só vê isto) ---


async def load_rows(db: AsyncSession) -> list[CalibrationAggregate]:
    """As linhas atuais da tabela de agregados. Nem lotes, nem unidades, nem pedidos: só agregados."""
    return list((await db.execute(select(CalibrationAggregate))).scalars().all())


def calibration_of_rows(rows: list[CalibrationAggregate]) -> Calibration | None:
    """O objeto puro que o otimizador consome (None sem agregados: o cenário corre só com priores)."""
    if not rows:
        return None
    return Calibration(window_weeks=WINDOW_WEEKS, readings=[_reading(r) for r in rows])


def photo_of_rows(rows: list[CalibrationAggregate]) -> CalibrationPhoto | None:
    """A fotografia que o cenário guarda no resultado (None sem agregados: cenários antigos continuam válidos)."""
    if not rows:
        return None
    return CalibrationPhoto(
        window_weeks=WINDOW_WEEKS,
        computed_at=max(r.computed_at for r in rows),
        readings=[CalibrationReadingOut.model_validate(_reading(r), from_attributes=True) for r in rows],
    )


def panel_of_rows(rows: list[CalibrationAggregate]) -> CalibrationOut:
    """O painel «Calibração»: as mesmas linhas, ordenadas por métrica e unidade."""
    order = {m.value: i for i, m in enumerate(CalibrationMetric)}
    ordered = sorted(rows, key=lambda r: (order.get(r.metric, 99), r.scope, r.unit_name))
    return CalibrationOut(
        window_weeks=WINDOW_WEEKS,
        computed_at=max((r.computed_at for r in rows), default=None),
        rows=[CalibrationReadingOut.model_validate(_reading(r), from_attributes=True) for r in ordered],
    )


def _reading(row: CalibrationAggregate) -> Reading:
    return Reading(
        metric=CalibrationMetric(row.metric),
        scope=CalibrationScope(row.scope),
        unit_code=row.unit_code,
        unit_name=row.unit_name,
        parish_code=row.parish_code,
        n=row.n,
        pseudo_k=row.pseudo_k,
        observed=float(row.observed) if row.observed is not None else None,
        prior=float(row.prior),
        blended=float(row.blended),
        weight=float(row.weight),
        label=row.label,
    )


# --- Recomputação (o único sítio que lê eventos) ---


async def recompute(
    db: AsyncSession, params: PlanningParams, *, now: datetime | None = None
) -> list[CalibrationAggregate]:
    """Reconstrói a tabela de agregados com os eventos da janela de 12 semanas. Idempotente, numa transação."""
    ctx = await _context(db, params, now or datetime.now(UTC))
    events = await _observed_events(db, ctx)
    rows = [
        *_measured_rows(events.taxa, ctx),
        *_kg_per_bag_rows(events.taxa, events.bag_samples, ctx),
        *_bags_per_round_rows(events.bags_per_week, ctx),
        *_capture_rows([r for _, r in events.taxa], ctx),
        *_improved_prior_rows(events.taxa, ctx),
    ]
    rows += await _requests_rows(db, ctx)

    await db.execute(delete(CalibrationAggregate))
    for r in rows:
        db.add(r)
    await db.commit()
    return list((await db.execute(select(CalibrationAggregate))).scalars().all())


async def _context(db: AsyncSession, params: PlanningParams, now: datetime) -> _Context:
    parishes_all = (await db.execute(select(Parish))).scalars().all()
    parishes = {p.id: p for p in parishes_all if p.population}
    localities = (await db.execute(select(Locality).where(Locality.parish_id.is_not(None)))).scalars().all()
    locals_by_parish: dict[uuid.UUID, list[Locality]] = defaultdict(list)
    for loc in localities:
        if loc.parish_id is not None and loc.parish_id in parishes:
            locals_by_parish[loc.parish_id].append(loc)
    demand_kg: dict[uuid.UUID, float] = {}
    for pid, p in parishes.items():
        if p.population is not None:
            demand_kg[pid] = p.population * params.kg_per_inhab_month * 12
    prior_taxa: dict[uuid.UUID, float] = {}
    for loc in localities:
        if loc.parish_id is None or loc.parish_id not in demand_kg or not locals_by_parish[loc.parish_id]:
            continue
        prior_taxa[loc.id] = demand_kg[loc.parish_id] / len(locals_by_parish[loc.parish_id]) / calibration.DAYS_PER_YEAR
    on_demand = params.modes[CollectionMode.ON_DEMAND]
    prior_capture_rate = on_demand.capture_rate * on_demand.coverage_factor
    prior_kg_bag = params.on_demand_kg_per_pickup
    rounds_year = fleet.WEEKS_PER_YEAR / params.on_demand_every_weeks
    return _Context(
        now=now,
        start=window_start(now),
        parishes=parishes,
        parish_by_code={p.dicofre: p for p in parishes.values()},
        localities={loc.id: loc for loc in localities},
        demand_kg=demand_kg,
        prior_taxa=prior_taxa,
        prior_capture_rate=prior_capture_rate,
        prior_kg_bag=prior_kg_bag,
        prior_bags_round={pid: kg * prior_capture_rate / prior_kg_bag / rounds_year for pid, kg in demand_kg.items()},
    )


@dataclass
class _Events:
    """O que os eventos dizem, já agregado por unidade (nunca sai daqui para o planeamento)."""

    taxa: list[tuple[Locality, Reading]] = field(default_factory=list)  # taxa de geração por local medido
    bag_samples: dict[uuid.UUID, list[float]] = field(
        default_factory=lambda: defaultdict(list)
    )  # kg por saco, por local
    bags_per_week: dict[uuid.UUID, dict[int, list[float]]] = field(
        default_factory=lambda: defaultdict(lambda: defaultdict(list))
    )  # por freguesia


async def _observed_events(db: AsyncSession, ctx: _Context) -> _Events:
    """Lê partidas com pesos medidos e reparte-as por unidade. A janela corta os PESOS, nunca o tempo entre
    visitas: a primeira partida dentro da janela pode ter a anterior antes da janela (o intervalo conta)."""
    out = _Events()
    departed = (
        (await db.execute(select(Lot).where(Lot.departed_at.is_not(None), Lot.locality_id.is_not(None))))
        .scalars()
        .all()
    )
    unit_rows = (await db.execute(select(LotUnit.lot_id, LotUnit.weight_g))).all()
    units_by_lot: dict[uuid.UUID, list[float]] = defaultdict(list)
    for lot_id, grams in unit_rows:
        if grams is not None:
            units_by_lot[lot_id].append(grams / 1000)
    by_locality: dict[uuid.UUID, list[Lot]] = defaultdict(list)
    for lot in departed:
        if lot.locality_id is not None:
            by_locality[lot.locality_id].append(lot)

    for locality_id, lots in by_locality.items():
        loc = ctx.localities.get(locality_id)
        if loc is None or loc.parish_id not in ctx.parishes or locality_id not in ctx.prior_taxa:
            continue
        pairs: list[tuple[float | None, float]] = []
        previous: datetime | None = None
        for lot in sorted(lots, key=lambda x: x.departed_at or ctx.start):
            departed_at = lot.departed_at
            if departed_at is None:  # a consulta só traz partidas; guard para o tipo
                continue
            kg = sum(units_by_lot.get(lot.id, []))
            interval = (departed_at - previous).total_seconds() / 86400 if previous is not None else None
            pairs.append((interval, kg if departed_at >= ctx.start else 0.0))
            previous = departed_at
            if departed_at >= ctx.start and units_by_lot.get(lot.id):
                out.bag_samples[locality_id].extend(units_by_lot[lot.id])
                week = int((departed_at - ctx.start).total_seconds() // 604800)
                out.bags_per_week[loc.parish_id][week].append(float(len(units_by_lot[lot.id])))
        rates = visit_rates(pairs)
        if not rates:
            continue
        prior = ctx.prior_taxa[locality_id]
        observed = median(rates)
        out.taxa.append(
            (
                loc,
                Reading(
                    metric=CalibrationMetric.GENERATION_RATE,
                    scope=CalibrationScope.LOCAL,
                    unit_code=str(locality_id),
                    unit_name=loc.name,
                    parish_code=ctx.parishes[loc.parish_id].dicofre,
                    n=len(rates),
                    pseudo_k=PSEUDO_K_LOCAL,
                    observed=observed,
                    prior=prior,
                    blended=blend(prior, observed, len(rates), PSEUDO_K_LOCAL),
                    weight=observed_weight(len(rates), PSEUDO_K_LOCAL),
                    label=sample_label(len(rates), PSEUDO_K_LOCAL),
                ),
            )
        )
    return out


def _measured_rows(taxa: list[tuple[Locality, Reading]], ctx: _Context) -> list[CalibrationAggregate]:
    """As linhas de taxa de geração dos locais MEDIDOS (os não visitados entram em `_improved_prior_rows`)."""
    return [
        _row(
            CalibrationMetric.GENERATION_RATE,
            CalibrationScope.LOCAL,
            f"local:{loc.id}",
            str(loc.id),
            loc.name,
            reading.parish_code,
            locality_id=loc.id,
            parish_id=loc.parish_id,
            n=reading.n,
            pseudo_k=reading.pseudo_k,
            observed=reading.observed,
            prior=reading.prior,
            blended=reading.blended,
            ctx=ctx,
        )
        for loc, reading in taxa
    ]


def _kg_per_bag_rows(
    taxa: list[tuple[Locality, Reading]],
    bag_samples: dict[uuid.UUID, list[float]],
    ctx: _Context,
) -> list[CalibrationAggregate]:
    rows: list[CalibrationAggregate] = []
    bag_readings: list[Reading] = []
    for loc, generation in taxa:
        weights = bag_samples.get(loc.id, [])
        if not weights:
            continue
        n = len(weights)
        observed = median(weights)
        reading = Reading(
            metric=CalibrationMetric.KG_PER_BAG,
            scope=CalibrationScope.LOCAL,
            unit_code=str(loc.id),
            unit_name=loc.name,
            parish_code=generation.parish_code,
            n=n,
            pseudo_k=PSEUDO_K_LOCAL,
            observed=observed,
            prior=ctx.prior_kg_bag,
            blended=blend(ctx.prior_kg_bag, observed, n, PSEUDO_K_LOCAL),
            weight=observed_weight(n, PSEUDO_K_LOCAL),
            label=sample_label(n, PSEUDO_K_LOCAL),
        )
        bag_readings.append(reading)
        rows.append(
            _row(
                CalibrationMetric.KG_PER_BAG,
                CalibrationScope.LOCAL,
                f"local:{loc.id}",
                str(loc.id),
                loc.name,
                generation.parish_code,
                locality_id=loc.id,
                parish_id=loc.parish_id,
                n=n,
                pseudo_k=PSEUDO_K_LOCAL,
                observed=observed,
                prior=ctx.prior_kg_bag,
                blended=reading.blended,
                ctx=ctx,
            )
        )
    pooled = pooled_kg_per_bag(bag_readings)
    if pooled is not None:
        n = sum(r.n for r in bag_readings)
        rows.append(
            _row(
                CalibrationMetric.KG_PER_BAG,
                CalibrationScope.CONCELHO,
                PICKUP_CODE,
                PICKUP_CODE,
                "Concelho de Guimarães",
                "",
                n=n,
                pseudo_k=PSEUDO_K_LOCAL,
                observed=pooled,
                prior=ctx.prior_kg_bag,
                blended=blend(ctx.prior_kg_bag, pooled, n, PSEUDO_K_LOCAL),
                ctx=ctx,
            )
        )
    return rows


def _bags_per_round_rows(
    bags_per_week: dict[uuid.UUID, dict[int, list[float]]], ctx: _Context
) -> list[CalibrationAggregate]:
    """Sacos por ronda por freguesia: mediana das médias semanais; semana sem ronda não é amostra."""
    rows = []
    for parish_id, weeks in bags_per_week.items():
        parish = ctx.parishes[parish_id]
        samples = list(weekly_means(weeks).values())
        n = len(samples)
        observed = median(samples)
        rows.append(
            _row(
                CalibrationMetric.BAGS_PER_ROUND,
                CalibrationScope.PARISH,
                f"parish:{parish.dicofre}",
                parish.dicofre,
                parish.name,
                parish.dicofre,
                parish_id=parish.id,
                n=n,
                pseudo_k=PSEUDO_K_PARISH,
                observed=observed,
                prior=ctx.prior_bags_round[parish_id],
                blended=blend(ctx.prior_bags_round[parish_id], observed, n, PSEUDO_K_PARISH),
                ctx=ctx,
            )
        )
    return rows


async def _requests_rows(db: AsyncSession, ctx: _Context) -> list[CalibrationAggregate]:
    """Pedidos por semana por freguesia: total ÷ semanas observadas desde o primeiro pedido; prior 0
    (sinal de arranque). Nunca multiplicam kg — KPI por freguesia e calibração do n."""
    first = (
        await db.execute(select(CollectionRequest.created_at).order_by(CollectionRequest.created_at).limit(1))
    ).scalar_one_or_none()
    if first is None:
        return []
    weeks = observed_weeks(first, ctx.now)
    counts: dict[uuid.UUID, int] = defaultdict(int)
    result = await db.execute(
        select(CollectionRequest.parish_id).where(
            CollectionRequest.created_at >= ctx.start, CollectionRequest.parish_id.is_not(None)
        )
    )
    for (pid,) in result.all():
        if pid is not None:
            counts[pid] += 1
    rows = []
    for pid, count in counts.items():
        parish = ctx.parishes.get(pid)
        if parish is None:
            continue
        observed = weekly_request_rate([count], weeks)
        rows.append(
            _row(
                CalibrationMetric.REQUESTS_PER_WEEK,
                CalibrationScope.PARISH,
                f"parish:{parish.dicofre}",
                parish.dicofre,
                parish.name,
                parish.dicofre,
                parish_id=parish.id,
                n=weeks,
                pseudo_k=PSEUDO_K_PARISH,
                observed=observed,
                prior=0.0,
                blended=blend(0.0, observed, weeks, PSEUDO_K_PARISH),
                ctx=ctx,
            )
        )
    return rows


def _capture_rows(taxa_readings: list[Reading], ctx: _Context) -> list[CalibrationAggregate]:
    """Captura anual DERIVADA do saco à porta (taxa × degrau, limitada por D_z): nunca medida, nunca
    guardada como fonte de verdade — é o que o otimizador usa nas freguesias com amostras."""
    demand_by_code = {p.dicofre: ctx.demand_kg[pid] for pid, p in ctx.parishes.items()}
    captures = calibration.on_demand_capture_readings(
        taxa_readings,
        demand_kg_year=demand_by_code,
        prior_capture={code: ctx.prior_capture_rate for code in demand_by_code},
    )
    return [
        _row(
            CalibrationMetric.ON_DEMAND_CAPTURE,
            CalibrationScope.PARISH,
            f"parish:{code}",
            code,
            ctx.parish_by_code[code].name,
            code,
            parish_id=ctx.parish_by_code[code].id,
            n=reading.n,
            pseudo_k=reading.pseudo_k,
            observed=reading.observed,
            prior=reading.prior,
            blended=reading.blended,
            ctx=ctx,
        )
        for code, reading in captures.items()
    ]


def _improved_prior_rows(taxa: list[tuple[Locality, Reading]], ctx: _Context) -> list[CalibrationAggregate]:
    """Os locais NÃO visitados melhoram pela conversão observada nos visitados — concelho afora, sempre
    dentro do blend documentado; sem amostras o valor fica intacto (nunca auto-substituído)."""
    measured = [r for _, r in taxa if r.observed is not None]
    if not measured:
        return []
    ratio = sum(r.observed or 0.0 for r in measured) / sum(r.prior for r in measured)
    visited_ids = {uuid.UUID(r.unit_code) for r in measured}
    total_n = sum(r.n for r in measured)
    rows = []
    for loc_id, prior in ctx.prior_taxa.items():
        if loc_id in visited_ids:
            continue
        improved = improved_prior(prior, ratio, total_n, PSEUDO_K_LOCAL)
        loc = ctx.localities[loc_id]
        if loc.parish_id is None or loc.parish_id not in ctx.parishes:
            continue
        rows.append(
            _row(
                CalibrationMetric.GENERATION_RATE,
                CalibrationScope.LOCAL,
                f"local:{loc.id}",
                str(loc.id),
                loc.name,
                ctx.parishes[loc.parish_id].dicofre,
                locality_id=loc.id,
                parish_id=loc.parish_id,
                n=0,
                pseudo_k=PSEUDO_K_LOCAL,
                observed=None,
                prior=improved,
                blended=improved,
                ctx=ctx,
            )
        )
    return rows


def _row(
    metric: CalibrationMetric,
    scope: CalibrationScope,
    unit_key: str,
    unit_code: str,
    unit_name: str,
    parish_code: str,
    locality_id: uuid.UUID | None = None,
    parish_id: uuid.UUID | None = None,
    *,
    n: int,
    pseudo_k: int,
    observed: float | None,
    prior: float,
    blended: float,
    ctx: _Context,
) -> CalibrationAggregate:
    return CalibrationAggregate(
        metric=metric,
        scope=scope,
        unit_key=unit_key,
        unit_code=unit_code,
        unit_name=unit_name,
        parish_code=parish_code,
        locality_id=locality_id,
        parish_id=parish_id,
        n=n,
        pseudo_k=pseudo_k,
        observed=None if observed is None else Decimal(str(round(observed, 8))),
        prior=Decimal(str(round(prior, 8))),
        blended=Decimal(str(round(blended, 8))),
        weight=Decimal(str(round(observed_weight(n, pseudo_k), 8))),
        label=sample_label(n, pseudo_k),
        window_start=ctx.start,
        window_end=ctx.now,
        computed_at=ctx.now,
    )
