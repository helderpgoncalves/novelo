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


def share_of_tonnes_t(total_t: float, share: float) -> float:
    """Parte (`share`, fração 0 a 1) de um total em toneladas: ex.: têxtil no RSU = 43 051 × 0,054 = 2 324,754 t."""
    if total_t < 0 or not 0 <= share <= 1:
        raise ValueError("o total não pode ser negativo e a parte é uma fração entre 0 e 1")
    return total_t * share


def kg_per_inhab_month(tonnes_year: float, population: int) -> float:
    """Toneladas por ano expressas por habitante e mês: t × 1000 / população / 12."""
    if population <= 0 or tonnes_year < 0:
        raise ValueError("a população tem de ser positiva e as toneladas não podem ser negativas")
    return tonnes_year * 1000 / population / MONTHS_PER_YEAR


@dataclass(frozen=True)
class Baseline:
    """Ponto de partida observado: o que o sistema atual já recolhe e o que ainda vai para o lixo.

    `kg_per_inhab_month` é o têxtil que ainda vai para o lixo (por desviar). O recolhido à parte (`collected_t`)
    está fora do lixo, por isso o têxtil gerado é a soma dos dois e a captura é recolhido ÷ gerado.
    """

    collected_t: float
    population: int
    kg_per_inhab_month: float

    @property
    def demand_t(self) -> float:
        """Têxtil por desviar do lixo (t/ano): população × kg/hab/mês × 12."""
        return yearly_demand_t(self.population, self.kg_per_inhab_month)

    @property
    def generated_t(self) -> float:
        """Têxtil gerado no total (t/ano): o que vai para o lixo mais o recolhido à parte."""
        return self.demand_t + self.collected_t

    @property
    def observed_capture_rate(self) -> float:
        return self.collected_t / self.generated_t if self.generated_t else 0.0

    @property
    def observed_kg_per_inhab_month(self) -> float:
        return self.collected_t * 1000 / self.population / MONTHS_PER_YEAR
