"""Cálculos puros da página inicial: fronteira de Pareto, prazos e quotas. Sem I/O, sem FastAPI."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date

from novelo.domain.demand import yearly_demand_t


def pareto_ids[K](points: Sequence[tuple[K, float, float]]) -> list[K]:
    """Identificadores não dominados em (menos €/t, mais toneladas).

    Cada ponto é `(id, eur_per_tonne, tonnes)`. Um ponto é dominado se outro tem €/t menor ou igual e toneladas
    maiores ou iguais, com pelo menos uma desigualdade estrita. Pontos idênticos não se dominam entre si.
    Mantém a ordem de entrada.
    """
    front: list[K] = []
    for key, cost, tonnes in points:
        dominated = any(
            other_cost <= cost and other_t >= tonnes and (other_cost < cost or other_t > tonnes)
            for other_key, other_cost, other_t in points
            if other_key != key
        )
        if not dominated:
            front.append(key)
    return front


def days_until(target: date, today: date) -> int | None:
    """Dias que faltam até `target`; None se a data é hoje ou já passou (marco cumprido)."""
    delta = (target - today).days
    return delta if delta > 0 else None


def parish_potential_t(population: int, kg_per_inhab_month: float) -> float:
    """Potencial de uma freguesia em t/ano: população × kg/hab/mês × 12 / 1000 (estimativa do plano municipal)."""
    return yearly_demand_t(population, kg_per_inhab_month)


def share_pct(part: float, total: float) -> float:
    """Quota em percentagem (0 a 100); 0 quando o total é zero."""
    return part / total * 100 if total else 0.0
