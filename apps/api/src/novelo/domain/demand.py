"""Procura de têxtil por zona. Funções puras: sem I/O, sem FastAPI.

Fórmulas em docs/engenharia/dados-e-modelo.md (D_z = P_z · q · 12; C_z = D_z · c_m).
"""

from dataclasses import dataclass

MONTHS_PER_YEAR = 12


def yearly_demand_t(population: int, kg_per_inhab_month: float) -> float:
    """Têxtil gerado por ano numa zona, em toneladas."""
    if population < 0 or kg_per_inhab_month < 0:
        raise ValueError("população e kg/hab/mês não podem ser negativos")
    return population * kg_per_inhab_month * MONTHS_PER_YEAR / 1000


@dataclass(frozen=True)
class Baseline:
    """Ponto de partida observado: o que o sistema atual já recolhe."""

    collected_t: float
    population: int
    kg_per_inhab_month: float

    @property
    def demand_t(self) -> float:
        return yearly_demand_t(self.population, self.kg_per_inhab_month)

    @property
    def observed_capture_rate(self) -> float:
        return self.collected_t / self.demand_t if self.demand_t else 0.0

    @property
    def observed_kg_per_inhab_month(self) -> float:
        return self.collected_t * 1000 / self.population / MONTHS_PER_YEAR
