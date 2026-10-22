"""Matriz de cobertura de um cenário por tipologia de área urbana (TIPAU, INE). Funções puras, sem I/O.

Responde ao art. 22.º-C, n.º 9, alínea b) da Diretiva (UE) 2025/1892: a rede de recolha tem em conta a dimensão e a
densidade da população, o volume previsto, a acessibilidade e a proximidade, e não se limita às zonas onde a recolha
é mais rendível. Tudo se calcula de valores do cenário e da base de dados:

  densidade            população ÷ área (hab/km²)
  população coberta %  Σ população coberta ÷ Σ população × 100
  €/t                  Σ custo anual ÷ Σ toneladas
  não só rendível      % coberta nas freguesias não predominantemente urbanas (AMU + APR) vs nas urbanas (APU);
                       razão = % não urbana ÷ % urbana (1 = a mesma cobertura; abaixo de 1, a rede fica nas cidades)
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

TIPAU_ORDER = ("apu", "amu", "apr")
URBAN = frozenset({"apu"})
NON_URBAN = frozenset({"amu", "apr"})


@dataclass(frozen=True)
class ParishFigures:
    tipau: str | None
    population: int
    covered_population: float
    tonnes: float
    annual_cost_eur: float


@dataclass(frozen=True)
class GroupFigures:
    tipau: str | None  # None no total ou nas freguesias sem TIPAU
    parishes: int
    population: int
    covered_population: float
    covered_pct: float | None  # None sem população
    tonnes: float
    annual_cost_eur: float
    eur_per_tonne: float | None  # None com 0 t


@dataclass(frozen=True)
class Equity:
    urban_population: int
    urban_covered_pct: float | None
    non_urban_population: int
    non_urban_covered_pct: float | None
    non_urban_vs_urban: float | None  # None se uma das % faltar ou a urbana for 0


def density(population: int, area_km2: float | None) -> float | None:
    """Habitantes por km²; None sem área (ou área não positiva)."""
    return population / area_km2 if area_km2 is not None and area_km2 > 0 else None


def _pct(part: float, whole: float) -> float | None:
    return part / whole * 100 if whole > 0 else None


def group(rows: Sequence[ParishFigures], tipau: str | None) -> GroupFigures:
    """Soma de um conjunto de freguesias (o `tipau` só etiqueta o grupo)."""
    population = sum(r.population for r in rows)
    covered = sum(r.covered_population for r in rows)
    tonnes = sum(r.tonnes for r in rows)
    cost = sum(r.annual_cost_eur for r in rows)
    return GroupFigures(
        tipau=tipau,
        parishes=len(rows),
        population=population,
        covered_population=covered,
        covered_pct=_pct(covered, population),
        tonnes=tonnes,
        annual_cost_eur=cost,
        eur_per_tonne=cost / tonnes if tonnes > 0 else None,
    )


def by_tipau(rows: Sequence[ParishFigures]) -> list[GroupFigures]:
    """Um grupo por TIPAU presente (APU, AMU, APR) e, no fim, as freguesias sem TIPAU, se houver."""
    out = [group([r for r in rows if r.tipau == t], t) for t in TIPAU_ORDER if any(r.tipau == t for r in rows)]
    unknown = [r for r in rows if r.tipau not in TIPAU_ORDER]
    if unknown:
        out.append(group(unknown, None))
    return out


def equity(rows: Sequence[ParishFigures]) -> Equity:
    urban = group([r for r in rows if r.tipau in URBAN], "apu")
    rural = group([r for r in rows if r.tipau in NON_URBAN], None)
    ratio = (
        rural.covered_pct / urban.covered_pct
        if urban.covered_pct is not None and rural.covered_pct is not None and urban.covered_pct > 0
        else None
    )
    return Equity(
        urban_population=urban.population,
        urban_covered_pct=urban.covered_pct,
        non_urban_population=rural.population,
        non_urban_covered_pct=rural.covered_pct,
        non_urban_vs_urban=ratio,
    )
