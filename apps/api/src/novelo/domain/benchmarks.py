"""Cenários de referência externos (ex.: desempenho francês). Funções puras.

Um benchmark fixa uma meta de recolha (kg/hab/ano) e uma densidade de pontos (1 por N habitantes). A pergunta
que o simulador responde é se a rede de Guimarães, com os pressupostos atuais, consegue lá chegar e a que custo.
"""

from __future__ import annotations

from collections.abc import Sequence

from novelo.domain.demand import MONTHS_PER_YEAR
from novelo.domain.network import Params, Zone, build_option
from novelo.domain.vocab import CollectionMode as Mode


def target_tonnes(kg_per_inhab_year: float, population: int) -> float:
    """Meta de recolha em t/ano: kg/hab/ano × habitantes / 1000."""
    if kg_per_inhab_year < 0 or population < 0:
        raise ValueError("a meta e a população não podem ser negativas")
    return kg_per_inhab_year * population / 1000


def implied_capture_of_demand(kg_per_inhab_year: float, kg_per_inhab_month: float) -> float:
    """Fração do têxtil gerado que a meta exige captar: meta anual / (q · 12). Pode exceder 1 (irrealizável)."""
    if kg_per_inhab_month <= 0:
        raise ValueError("kg/hab/mês tem de ser positivo")
    return kg_per_inhab_year / (kg_per_inhab_month * MONTHS_PER_YEAR)


def max_capturable_t(zones: Sequence[Zone], params: Params) -> float:
    """Teto de captura do modelo: todos os modos ligados em todas as freguesias (canais independentes)."""
    return sum(build_option(z, tuple(Mode), params).tonnes for z in zones)
