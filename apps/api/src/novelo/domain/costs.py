"""Modelo de custos. Funções puras.

custo anual = investimento / N + recolhas · c_recolha + km · c_km
€/t         = custo anual / toneladas captadas
"""


def annual_cost_eur(
    capex_eur: float,
    lifetime_years: float,
    collections_per_year: float,
    cost_per_collection_eur: float,
    km_per_year: float,
    cost_per_km_eur: float,
) -> float:
    if lifetime_years <= 0:
        raise ValueError("a vida útil tem de ser positiva")
    return capex_eur / lifetime_years + collections_per_year * cost_per_collection_eur + km_per_year * cost_per_km_eur


def eur_per_tonne(annual_cost: float, tonnes: float) -> float | None:
    """None quando não há toneladas: um €/t sem toneladas não faz sentido."""
    return annual_cost / tonnes if tonnes > 0 else None


def avoided_treatment_eur(tonnes: float, treatment_eur_per_t: float | None) -> float | None:
    """Poupança no tratamento de indiferenciado: cada tonelada desviada deixa de ser tratada como lixo.

    None enquanto o custo por tonelada não chegar da Vitrus: o KPI fica «por validar», nunca com um valor inventado.
    """
    if treatment_eur_per_t is None:
        return None
    if tonnes < 0 or treatment_eur_per_t < 0:
        raise ValueError("toneladas e custo por tonelada não podem ser negativos")
    return tonnes * treatment_eur_per_t
