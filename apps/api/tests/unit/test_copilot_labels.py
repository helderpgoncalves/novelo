"""Nomes dos cenários do copiloto: um só prefixo e nome útil quando falta."""

from novelo.domain.vocab import ScenarioObjective
from novelo.features.copilot.labels import default_name, scenario_label, strip_prefix


def test_prefix_is_never_repeated() -> None:
    assert strip_prefix("Copilot · Copilot · Locais reais — 60 000 €/ano") == "Locais reais — 60 000 €/ano"
    assert strip_prefix("Copilot") == "" and strip_prefix("copilot - Copilot") == ""
    assert scenario_label("Copilot", "60 000 €/ano, por freguesia") == "Copilot · 60 000 €/ano, por freguesia"
    assert scenario_label("Copilot · Plano A", "x") == "Copilot · Plano A"
    assert scenario_label(None, "Copilot · Base · variante") == "Copilot · Base · variante"
    assert len(scenario_label("x" * 200, "y")) == 80


def test_default_names_use_only_the_users_numbers() -> None:
    assert default_name(ScenarioObjective.MAX_TONNES, 60000, None) == "60 000 €/ano, por freguesia"
    assert default_name(ScenarioObjective.MAX_TONNES, 45000, None, "sites") == "45 000 €/ano, locais reais"
    assert default_name(ScenarioObjective.MIN_COST, None, 40) == "Meta 40% do têxtil por desviar, por freguesia"
