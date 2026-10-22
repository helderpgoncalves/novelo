"""Têxtil reutilizável de um cenário. Funções puras, sem I/O.

O valor está na reutilização (Vitrus): a reciclagem custa mais do que a fibra virgem. Não há dado de qualidade por
canal de recolha, por isso a quota de reutilização observada em 2025 aplica-se igual a todos os modos (estimativa):

  quota central        Σ reutilização / Σ recolhido            (as 4 entidades, como o Sankey observado)
  quota baixa / alta   menor / maior reutilização ÷ recolhido   (só as entidades com kg exatos por destino, `weighed`)
  reutilizável         toneladas × quota
  €/t reutilizável     custo anual / reutilizável (central)

As entidades com percentagens de relatório (`percentage`, ex.: a amostra Vitrus de 5,6 t) entram na quota central
mas não no intervalo: o intervalo mostra só o que foi pesado.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class EntityReuse:
    entity: str
    reuse_t: float
    total_t: float
    weighed: bool  # kg exatos por destino (não percentagens de um relatório)


@dataclass(frozen=True)
class ReuseShares:
    central: float  # 0 a 1
    low: float | None  # None sem entidades pesadas
    high: float | None


@dataclass(frozen=True)
class Reusable:
    tonnes: float
    tonnes_low: float | None
    tonnes_high: float | None
    eur_per_tonne: float | None  # None com 0 t reutilizáveis


def reuse_shares(entities: Sequence[EntityReuse]) -> ReuseShares | None:
    """Quotas de reutilização observadas; None sem nada recolhido."""
    total = sum(e.total_t for e in entities)
    if total <= 0:
        return None
    if any(e.reuse_t < 0 or e.reuse_t > e.total_t for e in entities):
        raise ValueError("a reutilização tem de estar entre 0 e o total recolhido de cada entidade")
    weighed = [e.reuse_t / e.total_t for e in entities if e.weighed and e.total_t > 0]
    return ReuseShares(
        central=sum(e.reuse_t for e in entities) / total,
        low=min(weighed) if weighed else None,
        high=max(weighed) if weighed else None,
    )


def reusable(tonnes: float, annual_cost_eur: float, shares: ReuseShares) -> Reusable:
    """Toneladas reutilizáveis (central, baixa, alta) e o custo por tonelada reutilizável."""
    if tonnes < 0:
        raise ValueError("as toneladas não podem ser negativas")
    central = tonnes * shares.central
    return Reusable(
        tonnes=central,
        tonnes_low=tonnes * shares.low if shares.low is not None else None,
        tonnes_high=tonnes * shares.high if shares.high is not None else None,
        eur_per_tonne=annual_cost_eur / central if central > 0 else None,
    )
