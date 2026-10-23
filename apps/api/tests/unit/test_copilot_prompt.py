"""O prompt do copiloto em vigor está alinhado com o projeto de hoje (sem rede nem modelo).

Cada regra nasceu de um facto que mudou (contentores, viatura sem compactação, procura de 22 out, rotas por estrada):
se o prompt voltar a dizer o contrário, estes testes falham.
"""

import re

from novelo.ai.prompts import _DIR, load
from novelo.features.copilot import web as web_service
from novelo.features.copilot.tools import CopilotTools


def prompt() -> str:
    return load("copilot")[0]


def test_current_version_is_v5_and_older_ones_stay_for_audit() -> None:
    assert load("copilot")[1] == "v5" and load("copilot_title")[1] == "v3"
    assert (_DIR / "copilot_v4.md").exists() and (_DIR / "copilot_v3.md").exists()  # mensagens antigas referem-nas


def test_prompt_states_the_current_network() -> None:
    text = prompt()
    for needle in (
        "NO textile containers",
        "NO compaction",
        "Rua das Lameiras, Polvoreira",
        "door-to-door compactor",
        "No existing vehicle is free in the afternoon",
        "WHOLE municipality",
        "avoided_treatment_eur",
        "OSRM",
        "`routing`",
        "ALWAYS an area-formula estimate",
        "not a road measurement",
    ):
        assert needle in text, needle


def test_prompt_does_not_present_superseded_facts_as_current() -> None:
    text = prompt()
    for stale in ("2 324,8", "1 317 t", "1,235", "11,5%", "plano B", "plan B", "free vehicles in the afternoon"):
        assert stale not in text, stale
    # as bases antigas só aparecem numa frase que manda recusá-las
    assert re.search(r"Superseded bases are no longer valid and must never be quoted as current", text)
    assert "network is built on what exists" not in text and "container textile is contaminated" not in text


def test_every_tool_named_in_the_prompt_exists() -> None:
    box = CopilotTools(None, None, web=web_service.WebSession(web_service.WebPolicy(True), 3))  # type: ignore[arg-type]
    names = {s.name for s in box.specs()}
    mentioned = set(
        re.findall(
            r"\b(?:get|list|find|show|run|explain|analyze|generate|compare|search|propose|open|ask|make)_[a-z_]+\b",
            prompt(),
        )
    )
    assert not (mentioned - names), sorted(mentioned - names)
    assert {"get_scenario_detail", "get_data_gaps", "explain_assumption"} <= mentioned
