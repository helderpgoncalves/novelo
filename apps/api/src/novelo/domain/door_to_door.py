"""Têxtil nos circuitos porta a porta (PAP) que já existem. Funções puras, sem I/O.

Um saco de têxtil fechado, posto à porta num dia fixo da semana, é recolhido pela viatura do circuito PAP que já passa
nessa freguesia nesse dia: sem km novos e sem contentor. Fórmulas e regra (docs/engenharia/dados-e-modelo.md, secção 9):

  rondas por ano        52 (um dia fixo por semana)
  kg por ronda          t/ano × 1000 / 52
  recolhas por ano      t/ano × 1000 / kg por recolha
  custo anual           recolhas × custo de uma recolha no circuito PAP          (0 km novos)

Regra do dia (explícita e determinista): as freguesias entram por ordem decrescente de toneladas (empate: código) e
cada uma fica com a passagem (circuito, dia) que tem menos kg de têxtil já atribuídos; empate: o dia mais cedo da
semana, depois o código do circuito. Assim a carga reparte-se pelas rondas em vez de cair toda na primeira.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Literal

WEEKS_PER_YEAR = 52

DayGroup = Literal["weekday", "saturday", "sunday"]


@dataclass(frozen=True)
class Pass:
    """Uma passagem semanal de um circuito PAP numa freguesia: dia da semana (1 = segunda) e viatura do planeamento."""

    circuit: str
    weekday: int
    vehicle: str | None = None
    crew: int | None = None


@dataclass(frozen=True)
class Assignment:
    zone_id: str
    circuit: str
    weekday: int
    vehicle: str | None
    crew: int | None
    tonnes_year: float
    kg_per_round: float  # só o têxtil desta freguesia nessa ronda


def day_group(weekday: int) -> DayGroup:
    """Grupo de dias do planeamento de turnos da Vitrus: segunda a sexta, sábado, domingo."""
    if not 1 <= weekday <= 7:
        raise ValueError("o dia da semana vai de 1 (segunda) a 7 (domingo)")
    return "weekday" if weekday <= 5 else "saturday" if weekday == 6 else "sunday"


@dataclass(frozen=True)
class Crewing:
    """Uma linha do planeamento de turnos de um circuito: grupo de dias, turno (0 = manhã), viatura e tripulação."""

    day_group: str  # "weekday", "saturday" ou "sunday" (ver `day_group`)
    shift: int
    vehicle: str
    crew: int


def circuit_passes(circuit: str, weekdays: Iterable[int], crewing: Sequence[Crewing]) -> list[Pass]:
    """Passagens semanais de um circuito: só os dias com viatura no planeamento desse grupo de dias (sem viatura não
    há quem leve o saco). Com várias viaturas no mesmo dia fica a do primeiro turno (empate: a matrícula)."""
    out: list[Pass] = []
    for d in sorted(set(weekdays)):
        options = [c for c in crewing if c.day_group == day_group(d)]
        if options:
            first = min(options, key=lambda c: (c.shift, c.vehicle))
            out.append(Pass(circuit, d, first.vehicle, first.crew))
    return out


def kg_per_round(tonnes_year: float) -> float:
    """Têxtil de uma ronda semanal: t/ano × 1000 / 52."""
    if tonnes_year < 0:
        raise ValueError("as toneladas não podem ser negativas")
    return tonnes_year * 1000 / WEEKS_PER_YEAR


def pickups_per_year(tonnes_year: float, kg_per_pickup: float) -> float:
    """Recolhas (sacos ou pedidos) por ano: t/ano × 1000 / kg por recolha."""
    if kg_per_pickup <= 0 or tonnes_year < 0:
        raise ValueError("kg por recolha tem de ser positivo e as toneladas não podem ser negativas")
    return tonnes_year * 1000 / kg_per_pickup


def assign_days(zone_tonnes: Mapping[str, float], passes: Mapping[str, Sequence[Pass]]) -> list[Assignment]:
    """Um dia fixo (e um circuito) por freguesia, com a regra do módulo. Freguesias sem passagens ficam de fora."""
    load: dict[tuple[str, int], float] = defaultdict(float)
    out: list[Assignment] = []
    for zone in sorted(zone_tonnes, key=lambda z: (-zone_tonnes[z], z)):
        options = passes.get(zone, ())
        if not options:
            continue
        best = min(options, key=lambda p: (load[(p.circuit, p.weekday)], p.weekday, p.circuit))
        kg = kg_per_round(zone_tonnes[zone])
        load[(best.circuit, best.weekday)] += kg
        out.append(Assignment(zone, best.circuit, best.weekday, best.vehicle, best.crew, zone_tonnes[zone], kg))
    return out


def round_loads(assignments: Sequence[Assignment]) -> dict[tuple[str, int], float]:
    """kg de têxtil por ronda (circuito, dia), somando as freguesias que lá caem."""
    out: dict[tuple[str, int], float] = defaultdict(float)
    for a in assignments:
        out[(a.circuit, a.weekday)] += a.kg_per_round
    return dict(out)


def fits(load_kg: float, free_capacity_kg: float | None, vehicle_capacity_kg: float) -> bool | None:
    """Cabe na viatura? Com a capacidade livre por validar (None) só se sabe que NÃO cabe acima da capacidade total."""
    if free_capacity_kg is not None:
        return load_kg <= free_capacity_kg
    return False if load_kg > vehicle_capacity_kg else None
