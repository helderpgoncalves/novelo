"""Viatura dedicada ao têxtil, sem compactação: rondas, km, horas e frota. Funções puras, sem I/O.

A Vitrus confirmou a 22 out 2026 que o saco de têxtil não pode ir na viatura compactadora do porta a porta (vai para a
caixa de compactação e estraga-se; cabine, gancho ou caixa lateral também não) e que uma compactadora não pode fazer
uma volta só de têxtil. Toda a recolha de têxtil (paragens nos locais e saco fechado à porta) é feita por uma viatura
nova, de caixa fechada, a partir do estaleiro. Fórmulas (docs/engenharia/dados-e-modelo.md, secção 9):

  rondas por ano (porta a porta)   R = 52 / N              (uma ronda por freguesia a cada N semanas)
  sacos por ronda                  s = sacos/ano ÷ R
  viagens por ronda                v = ⌈kg por ronda ÷ capacidade⌉            (cada viagem extra volta ao estaleiro)
  volta dentro da freguesia        L = 0,7124 · √(s · A) · desvio            (Beardwood, Halton e Hammersley, 1959)
  km por ano                       R · (v · ida e volta ao estaleiro + L)
  horas                            km ÷ velocidade + paragens · minutos por paragem ÷ 60
  viaturas                         ⌈horas por ano ÷ (horas por turno · 5 · 52)⌉
  dias de viatura por semana       horas por ano ÷ 52 ÷ horas por turno
"""

from __future__ import annotations

import math
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass

WEEKS_PER_YEAR = 52
WORKDAYS_PER_WEEK = 5
# Constante de Beardwood, Halton e Hammersley (1959) para a volta mais curta por n pontos uniformes numa área A:
# L ≈ 0,7124 · √(n · A) (em linha reta; o desvio da estrada multiplica depois).
BHH_CONSTANT = 0.7124
_EPS = 1e-9


def rounds_per_year(every_weeks: float) -> float:
    """Rondas por ano de uma freguesia com uma ronda a cada `every_weeks` semanas: 52 ÷ N."""
    if every_weeks <= 0:
        raise ValueError("o intervalo entre rondas tem de ser positivo")
    return WEEKS_PER_YEAR / every_weeks


def trips_per_round(kg_per_round: float, capacity_kg: float) -> int:
    """Viagens ao estaleiro numa ronda: ⌈kg ÷ capacidade⌉, pelo menos 1."""
    if capacity_kg <= 0 or kg_per_round < 0:
        raise ValueError("a capacidade tem de ser positiva e os kg não podem ser negativos")
    return max(1, math.ceil(kg_per_round / capacity_kg - _EPS))


def tour_km(stops: float, area_km2: float | None, detour_factor: float) -> float:
    """Volta dentro da freguesia por `stops` portas espalhadas na área: 0,7124 · √(n · A) · desvio.

    Sem área (None ou 0) ou sem paragens a volta é 0: só conta a ida e volta ao estaleiro.
    """
    if stops < 0 or detour_factor < 1:
        raise ValueError("as paragens não podem ser negativas e o desvio é pelo menos 1")
    if stops == 0 or not area_km2 or area_km2 <= 0:
        return 0.0
    return BHH_CONSTANT * math.sqrt(stops * area_km2) * detour_factor


def hours(km: float, stops: float, speed_kmh: float, stop_minutes: float) -> float:
    """Horas de viatura: km ÷ velocidade + paragens · minutos por paragem ÷ 60."""
    if speed_kmh <= 0 or km < 0 or stops < 0 or stop_minutes < 0:
        raise ValueError("velocidade positiva; km, paragens e minutos não negativos")
    return km / speed_kmh + stops * stop_minutes / 60


def hours_per_vehicle_year(shift_hours: float) -> float:
    """Horas úteis de UMA viatura por ano: horas por turno · 5 dias · 52 semanas."""
    if shift_hours <= 0:
        raise ValueError("as horas por turno têm de ser positivas")
    return shift_hours * WORKDAYS_PER_WEEK * WEEKS_PER_YEAR


def vehicles_needed(hours_year: float, shift_hours: float) -> int:
    """Viaturas dedicadas: ⌈horas por ano ÷ horas de uma viatura⌉; 0 sem recolha, 1 logo que haja alguma."""
    if hours_year < 0:
        raise ValueError("as horas não podem ser negativas")
    if hours_year <= _EPS:
        return 0
    return max(1, math.ceil(hours_year / hours_per_vehicle_year(shift_hours) - _EPS))


def vehicle_days_per_week(hours_year: float, shift_hours: float) -> float:
    """Dias de viatura por semana: horas por ano ÷ 52 ÷ horas por turno (5 = uma viatura cheia)."""
    if shift_hours <= 0 or hours_year < 0:
        raise ValueError("horas por turno positivas e horas por ano não negativas")
    return hours_year / WEEKS_PER_YEAR / shift_hours


def annuity_eur(capex_eur: float, lifetime_years: float) -> float:
    """Investimento anualizado (linear, sem juros): capex ÷ vida útil."""
    if lifetime_years <= 0 or capex_eur < 0:
        raise ValueError("vida útil positiva e investimento não negativo")
    return capex_eur / lifetime_years


@dataclass(frozen=True)
class Job:
    """Uma ronda que se repete: a de uma freguesia (porta a porta) ou a de uma rota pelos locais."""

    id: str
    weekly_hours: float  # horas por ronda × rondas por ano ÷ 52


@dataclass(frozen=True)
class Slot:
    vehicle: int  # 1, 2, ...
    weekday: int  # 1 = segunda ... 5 = sexta


def assign_weekdays(jobs: Sequence[Job], vehicles: int) -> dict[str, Slot]:
    """Um dia fixo (e uma viatura) por ronda, a equilibrar as horas médias por semana de cada dia útil.

    Regra explícita e determinista: as rondas entram por ordem decrescente de horas (empate: o id) e cada uma fica no
    par (viatura, dia) com menos horas já atribuídas; empate: a viatura mais baixa, depois o dia mais cedo.
    """
    if vehicles < 1:
        return {}
    load: dict[tuple[int, int], float] = defaultdict(float)
    slots = [(v, d) for v in range(1, vehicles + 1) for d in range(1, WORKDAYS_PER_WEEK + 1)]
    out: dict[str, Slot] = {}
    for job in sorted(jobs, key=lambda j: (-j.weekly_hours, j.id)):
        v, d = min(slots, key=lambda s: (load[s], s[0], s[1]))
        load[(v, d)] += job.weekly_hours
        out[job.id] = Slot(v, d)
    return out
