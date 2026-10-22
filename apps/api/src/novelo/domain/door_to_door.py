"""Passagens dos circuitos de indiferenciado que já existem (porta a porta e moloks). Funções puras, sem I/O.

Já NÃO são um canal de recolha de têxtil: a Vitrus confirmou a 22 out 2026 que o saco de têxtil não pode ir na
compactadora (estraga-se) e que uma compactadora não pode fazer uma volta só de têxtil. O têxtil vai numa viatura
dedicada (`domain/fleet.py`). As passagens ficam como dado da rede atual: acessibilidade na matriz de cobertura
(dias por semana com recolha porta a porta) e hábito de recolha em dias fixos no recomendador de piloto.

A Vitrus disse também que o planeamento de turnos tem um erro: os circuitos porta a porta sem viatura na folha (C8,
C12, C15, C20 a C24) circulam. Por isso uma passagem conta em todos os dias do circuito; a viatura do planeamento,
quando existe, fica só como informação.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Literal

DayGroup = Literal["weekday", "saturday", "sunday"]


@dataclass(frozen=True)
class Pass:
    """Uma passagem semanal de um circuito numa freguesia: dia da semana (1 = segunda) e viatura do planeamento."""

    circuit: str
    weekday: int
    vehicle: str | None = None
    crew: int | None = None


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
    """Passagens semanais de um circuito: todos os dias do circuito (a folha de turnos tem erros, Vitrus 22 out 2026).

    A viatura e a tripulação são as do planeamento nesse grupo de dias, quando lá estão (várias: a do primeiro turno;
    empate: a matrícula); sem linha no planeamento ficam nulas.
    """
    out: list[Pass] = []
    for d in sorted(set(weekdays)):
        options = [c for c in crewing if c.day_group == day_group(d)]
        first = min(options, key=lambda c: (c.shift, c.vehicle)) if options else None
        out.append(Pass(circuit, d, first.vehicle if first else None, first.crew if first else None))
    return out


def weekdays_served(passes: Iterable[Pass]) -> int:
    """Dias da semana (0 a 7) com pelo menos uma passagem: os dias distintos, não a soma das passagens."""
    return len({p.weekday for p in passes})
