"""Validação do modelo com os dados que existem. Funções puras: sem I/O, sem FastAPI.

Só há um ano de têxtil recolhido (2025, totais anuais por entidade), por isso um backtest temporal não é possível e
não se finge. O que se pode testar sem inventar nada:

1. **Triangulação do potencial.** O número mais incerto do modelo é o têxtil gerado por habitante. Confrontam-se as
   leituras publicadas (todas com fonte) e vê-se o que cada uma diz da captura de 2025.
2. **Validação cruzada espacial.** A procura reparte-se pelas freguesias por população. Testa-se essa regra contra
   onde o município pôs mesmo os contentores de outras frações: prevê-se cada freguesia só com as outras 47
   (deixar uma de fora) e mede-se o erro. Não prova a procura de têxtil; prova que a população é um bom proxy do
   lugar onde a recolha já existe.
"""

from __future__ import annotations

import math
import statistics
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

MONTHS_PER_YEAR = 12


Basis = Literal["generated", "residual"]


@dataclass(frozen=True)
class PotentialReading:
    """Uma leitura do têxtil por habitante, com a captura de 2025 que ela implica.

    `basis="generated"`: a leitura é o têxtil gerado no total. `basis="residual"`: é o têxtil que ainda vai para o lixo
    (uma parte do RSU/indiferenciado); o recolhido à parte está fora do lixo e soma-se para obter o gerado.
    """

    key: str
    kg_per_inhab_year: float
    implied_capture_pct: float
    basis: Basis = "generated"


def implied_capture_pct(collected_t: float, population: int, kg_per_inhab_year: float) -> float:
    """Captura (%) se o têxtil gerado fosse `kg_per_inhab_year` por habitante e por ano."""
    if population <= 0 or kg_per_inhab_year <= 0:
        raise ValueError("população e potencial têm de ser positivos")
    return collected_t * 1000 / (population * kg_per_inhab_year) * 100


def implied_generated_t(collected_t: float, population: int, kg_per_inhab_year: float, basis: Basis) -> float:
    """Têxtil gerado (t/ano) que a leitura implica: a própria leitura, ou o que vai para o lixo + o recolhido."""
    if population <= 0 or kg_per_inhab_year <= 0:
        raise ValueError("população e potencial têm de ser positivos")
    in_reading = population * kg_per_inhab_year / 1000
    return in_reading + collected_t if basis == "residual" else in_reading


def potential_reading(
    key: str, kg_per_inhab_year: float, collected_t: float, population: int, basis: Basis = "generated"
) -> PotentialReading:
    generated = implied_generated_t(collected_t, population, kg_per_inhab_year, basis)
    return PotentialReading(key, kg_per_inhab_year, collected_t / generated * 100, basis)


def share_reading(total_kg_per_inhab_year: float, share_pct: float) -> float:
    """Quilos por habitante e por ano de uma fração (%) de um total por habitante e por ano."""
    return total_kg_per_inhab_year * share_pct / 100


def pearson(x: Sequence[float], y: Sequence[float]) -> float:
    if len(x) != len(y) or len(x) < 3:
        raise ValueError("são precisos pelo menos 3 pares")
    mx, my = statistics.fmean(x), statistics.fmean(y)
    sxx = sum((a - mx) ** 2 for a in x)
    syy = sum((b - my) ** 2 for b in y)
    if sxx == 0 or syy == 0:
        raise ValueError("variância nula")
    return sum((a - mx) * (b - my) for a, b in zip(x, y, strict=True)) / math.sqrt(sxx * syy)


def _ranks(values: Sequence[float]) -> list[float]:
    """Postos com empates pela média (1 = o menor)."""
    order = sorted(range(len(values)), key=lambda i: values[i])
    ranks = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        for k in range(i, j + 1):
            ranks[order[k]] = (i + j) / 2 + 1
        i = j + 1
    return ranks


def spearman(x: Sequence[float], y: Sequence[float]) -> float:
    return pearson(_ranks(x), _ranks(y))


@dataclass(frozen=True)
class ZoneCheck:
    """Uma freguesia deixada de fora: o que se previu só com as outras e o que existe."""

    zone: str
    population: int
    observed: int
    predicted: float

    @property
    def abs_error(self) -> float:
        return abs(self.predicted - self.observed)

    @property
    def pct_error(self) -> float | None:
        return self.abs_error / self.observed * 100 if self.observed > 0 else None


@dataclass(frozen=True)
class SpatialCheck:
    n: int
    pearson_r: float
    spearman_rho: float
    r2: float
    median_abs_pct_error: float
    within_25_pct: int
    within_50_pct: int
    zones: tuple[ZoneCheck, ...]


def leave_one_out(names: Sequence[str], population: Sequence[int], counts: Sequence[int]) -> SpatialCheck:
    """Prevê os contentores de cada freguesia como população × (contentores / população) das OUTRAS.

    Proporcionalidade pura, sem parâmetros ajustados à própria freguesia: é a regra que o modelo de procura usa
    (a procura reparte-se por população). O erro de cada freguesia mede o que essa regra falha ao localizar recolha.
    """
    n = len(names)
    if not (n == len(population) == len(counts)) or n < 4:
        raise ValueError("são precisas pelo menos 4 freguesias com os três campos")
    if any(p <= 0 for p in population):
        raise ValueError("população tem de ser positiva")
    total_pop, total_count = sum(population), sum(counts)
    zones: list[ZoneCheck] = []
    for name, pop, count in zip(names, population, counts, strict=True):
        rate = (total_count - count) / (total_pop - pop)
        zones.append(ZoneCheck(name, pop, count, pop * rate))
    errors = [z.pct_error for z in zones if z.pct_error is not None]
    r = pearson([float(p) for p in population], [float(c) for c in counts])
    return SpatialCheck(
        n=n,
        pearson_r=r,
        spearman_rho=spearman([float(p) for p in population], [float(c) for c in counts]),
        r2=r * r,
        median_abs_pct_error=statistics.median(errors),
        within_25_pct=sum(1 for e in errors if e <= 25),
        within_50_pct=sum(1 for e in errors if e <= 50),
        zones=tuple(sorted(zones, key=lambda z: z.abs_error, reverse=True)),
    )
