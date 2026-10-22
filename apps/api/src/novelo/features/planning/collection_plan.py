"""Plano da viatura dedicada ao têxtil: por freguesia e canal, o dia, a viatura, as rondas, os km e as horas.

Partilhado pelos cenários por freguesia e por locais. A Vitrus confirmou a 22 out 2026 que o saco de têxtil não pode ir
na compactadora do porta a porta: toda a recolha (saco fechado à porta e paragens nos locais) é feita por uma viatura
nova, de caixa fechada, a partir do estaleiro. Fórmulas e regra do dia em `domain/fleet.py`.
"""

from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass

from novelo.domain import fleet, network
from novelo.domain.vocab import CollectionMode
from novelo.features.planning.schemas import Allocation, CollectionPlanEntry, RouteOut, ZoneOut


@dataclass(frozen=True)
class ChannelLoad:
    """O que a viatura dedicada faz numa freguesia por um canal (já com os km reais das rotas)."""

    parish_code: str
    mode: CollectionMode
    tonnes: float
    km_year: float
    stops_year: float  # sacos à porta ou paragens nos locais
    rounds_year: float
    trips_per_round: int | None = None  # só porta a porta


@dataclass(frozen=True)
class FleetFigures:
    vehicles: int
    hours_year: float
    days_per_week: float
    capex_eur: float
    annual_eur: float


def load_hours(load: ChannelLoad, dp: network.Params) -> float:
    return network.part_hours(load.mode, load.km_year, load.stops_year, dp)


def fleet_figures(hours_year: float, dp: network.Params) -> FleetFigures:
    """Viaturas, dias por semana e custo das viaturas dedicadas para as horas do plano."""
    n = fleet.vehicles_needed(hours_year, dp.shift_hours)
    return FleetFigures(
        vehicles=n,
        hours_year=hours_year,
        days_per_week=fleet.vehicle_days_per_week(hours_year, dp.shift_hours),
        capex_eur=n * dp.vehicle_capex_eur,
        annual_eur=n * dp.vehicle_annual_eur,
    )


def _main_route(routes: Sequence[RouteOut]) -> dict[tuple[CollectionMode, str], str]:
    """Rota principal de cada (modo, freguesia): a que lá leva mais têxtil (empate: a viagem de número mais baixo)."""
    load: dict[tuple[CollectionMode, str], dict[int, float]] = defaultdict(lambda: defaultdict(float))
    for r in routes:
        for s in r.stops:
            load[(r.mode, s.parish_code)][r.vehicle] += s.load_t
    return {key: f"{key[0].value}:{min(v, key=lambda n: (-v[n], n))}" for key, v in load.items()}


def build_collection_plan(
    zones: Sequence[ZoneOut],
    loads: Sequence[ChannelLoad],
    routes: Sequence[RouteOut],
    dp: network.Params,
    vehicles: int,
) -> list[CollectionPlanEntry]:
    """Uma linha por freguesia e canal com têxtil. Ordem: toneladas decrescentes, depois código e canal.

    Dia e viatura: cada ronda porta a porta é uma tarefa; as paragens nos locais seguem a rota (viagem do VRP) que
    mais têxtil leva da freguesia. As tarefas repartem-se pelos dias úteis com `fleet.assign_weekdays`.
    """
    names = {z.code: z.name for z in zones}
    main = _main_route(routes)
    job_of: dict[int, str] = {}
    job_hours: dict[str, float] = defaultdict(float)
    for i, ld in enumerate(loads):
        if ld.tonnes <= 0:
            continue
        job = (
            f"on_demand:{ld.parish_code}"
            if ld.mode == CollectionMode.ON_DEMAND
            else main.get((ld.mode, ld.parish_code), f"{ld.mode.value}:{ld.parish_code}")
        )
        job_of[i] = job
        job_hours[job] += load_hours(ld, dp) / fleet.WEEKS_PER_YEAR
    slots = fleet.assign_weekdays(
        [fleet.Job(j, h) for j, h in job_hours.items() if h > 0], max(vehicles, 1 if job_hours else 0)
    )
    out: list[CollectionPlanEntry] = []
    for i, ld in enumerate(loads):
        if i not in job_of:
            continue
        slot = slots.get(job_of[i])
        rounds = ld.rounds_year
        out.append(
            CollectionPlanEntry(
                parish_code=ld.parish_code,
                parish_name=names.get(ld.parish_code, ld.parish_code),
                channel=ld.mode,
                weekday=slot.weekday if slot else None,
                vehicle=slot.vehicle if slot else None,
                every_weeks=round(fleet.WEEKS_PER_YEAR / rounds, 2) if rounds > 0 else 0.0,
                rounds_year=round(rounds, 1),
                trips_per_round=ld.trips_per_round,
                stops_year=round(ld.stops_year, 1),
                tonnes_year=round(ld.tonnes, 3),
                kg_per_round=round(ld.tonnes * 1000 / rounds, 1) if rounds > 0 else 0.0,
                km_year=round(ld.km_year, 1),
                hours_year=round(load_hours(ld, dp), 1),
            )
        )
    return sorted(out, key=lambda e: (-e.tonnes_year, e.parish_code, e.channel.value))


def with_vehicle_share(
    allocations: Sequence[Allocation], loads: Sequence[ChannelLoad], dp: network.Params, vehicles: FleetFigures
) -> list[Allocation]:
    """Reparte o investimento e o custo anual das viaturas dedicadas pelas freguesias e canais, na proporção das horas.

    Assim a soma das freguesias (mapa, matriz de cobertura, €/t por TIPAU) bate com os KPIs do cenário.
    """
    total = sum(load_hours(ld, dp) for ld in loads)
    if total <= 0 or vehicles.vehicles == 0:
        return list(allocations)
    share: dict[tuple[str, CollectionMode], float] = defaultdict(float)
    for ld in loads:
        share[(ld.parish_code, ld.mode)] += load_hours(ld, dp) / total
    out: list[Allocation] = []
    for a in allocations:
        if not a.parts:
            out.append(a)
            continue
        parts = [
            p.model_copy(
                update={
                    "capex_eur": round(p.capex_eur + vehicles.capex_eur * share[(a.parish_code, p.mode)], 2),
                    "annual_cost_eur": round(
                        p.annual_cost_eur + vehicles.annual_eur * share[(a.parish_code, p.mode)], 2
                    ),
                }
            )
            for p in a.parts
        ]
        out.append(
            a.model_copy(
                update={
                    "parts": parts,
                    "capex_eur": round(sum(p.capex_eur for p in parts), 2),
                    "annual_cost_eur": round(sum(p.annual_cost_eur for p in parts), 2),
                }
            )
        )
    return out
