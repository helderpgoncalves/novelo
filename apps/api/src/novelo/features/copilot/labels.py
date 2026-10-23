"""Nomes dos cenários criados pelo copiloto: um só prefixo «Copilot · » e um nome útil quando o modelo não dá nenhum."""

import re

from novelo.domain.vocab import ScenarioObjective

COPILOT_PREFIX = "Copilot · "
_PREFIX = re.compile(r"^\s*copilot\s*[·\-–—:]*\s*", re.IGNORECASE)
MAX_LABEL = 80


def strip_prefix(label: str | None) -> str:
    """Tira todos os «Copilot · » do início («Copilot · Copilot · X» → «X»; «Copilot» sozinho → vazio)."""
    text = (label or "").strip()
    while True:
        cut = _PREFIX.sub("", text, count=1)
        if cut == text:
            return text
        text = cut


def _eur(value: float) -> str:
    return f"{value:,.0f}".replace(",", " ")


def default_name(
    objective: ScenarioObjective, budget_eur_year: float | None, target_pct: float | None, siting: str = "parish"
) -> str:
    """Nome descritivo a partir do pedido (só números que o utilizador deu)."""
    where = "locais reais" if siting == "sites" else "por freguesia"
    if objective == ScenarioObjective.MAX_TONNES and budget_eur_year is not None:
        return f"{_eur(budget_eur_year)} €/ano, {where}"
    if target_pct is not None:
        return f"Meta {target_pct:g}% do têxtil por desviar, {where}"
    return f"Cenário {where}"


def scenario_label(raw: str | None, fallback: str) -> str:
    """«Copilot · » + o nome pedido (sem prefixos repetidos); se vier vazio ou «Copilot», o `fallback`."""
    name = strip_prefix(raw) or strip_prefix(fallback) or "Cenário"
    return f"{COPILOT_PREFIX}{name}"[:MAX_LABEL]
