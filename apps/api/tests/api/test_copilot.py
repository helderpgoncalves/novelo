from typing import Any

import httpx
import pytest

from novelo.core.errors import FeatureDisabledError
from novelo.features.copilot import tools as copilot_tools
from tests.conftest import FakeLlm

P = "/api/v1/planning"
C = "/api/v1/copilot/chat"


async def make(c: httpx.AsyncClient, label: str, budget: int) -> dict[str, Any]:
    body = {"label": label, "objective": "max_tonnes", "budget_eur_year": budget}
    return dict((await c.post(f"{P}/scenarios", json=body)).json())


RUN = ("run_scenario", {"label": "Teste", "objective": "max_tonnes", "budget_eur_year": 60000})


def ask(text: str, **extra: Any) -> dict[str, Any]:
    return {"messages": [{"role": "user", "content": text}], "locale": "pt-PT", **extra}


async def test_run_scenario_creates_a_copilot_scenario_and_a_card(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    llm.queue_chat([RUN], "Criei o cenário com um orçamento de 60 000 € por ano. Os valores são estimativas.")
    resp = await logged_in.post(C, json=ask("Simula um cenário com 60 mil euros por ano"))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["verified"] is True and body["warning"] is None and body["prompt_version"] == "v4"
    assert [t["name"] for t in body["tools_used"]] == ["run_scenario"] and body["tools_used"][0]["ok"] is True
    card = body["cards"][0]
    assert card["created_now"] is True and card["label"].startswith("Copilot · ")
    saved = (await logged_in.get(f"{P}/scenarios/{card['scenario_id']}")).json()
    assert (
        saved["label"] == card["label"] and saved["tonnes_year"] == card["kpis"]["tonnes_year"]
    )  # cartão = otimizador


async def test_numbers_not_in_tool_results_trigger_one_rewrite(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    llm.queue_chat(
        [RUN],
        "O cenário capta 99999 t por ano.",  # inventado
        "Criei o cenário com um orçamento de 60 000 € por ano.",  # reescrita válida
    )
    body = (await logged_in.post(C, json=ask("Simula 60 mil euros"))).json()
    assert body["verified"] is True and "99999" not in body["text"]
    correction = llm.calls[1]["user"][-1]["content"]  # type: ignore[index]
    assert "99999" in correction  # o modelo é informado de que números falharam


async def test_second_failure_returns_only_cards_with_a_warning(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    llm.queue_chat([RUN], "Capta 99999 t.", "Continua a captar 88888 t.")
    body = (await logged_in.post(C, json=ask("Simula 60 mil euros"))).json()
    assert body["verified"] is False and body["warning"] == "numbers_unverified"
    assert "88888" not in body["text"] and "99999" not in body["text"] and len(body["cards"]) == 1


async def test_user_numbers_and_rounding_are_accepted(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    llm.queue_chat([("get_baseline", {})], "Recolheram-se 301,3 t em 2025, cerca de 9% do têxtil gerado.")
    body = (await logged_in.post(C, json=ask("Quanto recolhemos?"))).json()
    assert body["verified"] is True and body["cards"] == []
    llm.queue_chat("Com os 20 000 € que indicou, ainda não corri nada.")
    assert (await logged_in.post(C, json=ask("E se eu tiver 20 000 € de orçamento?"))).json()["verified"] is True


async def test_what_if_derives_a_scenario_from_the_base(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    base = (
        await logged_in.post(
            f"{P}/scenarios", json={"label": "Base", "objective": "max_tonnes", "budget_eur_year": 60000}
        )
    ).json()
    step = (
        "what_if",
        {"scenario_id": base["id"], "set_modes": [{"parish": "serzedelo", "allowed_modes": ["on_demand"]}]},
    )
    llm.queue_chat([step], "Criei a variante com Serzedelo só a pedido; os valores são estimativas.")
    body = (await logged_in.post(C, json=ask("E se Serzedelo for só a pedido?", scenario_id=base["id"]))).json()
    created = next(c for c in body["cards"] if c["created_now"])
    assert created["parent_id"] == base["id"] and created["label"].startswith("Copilot · ")
    assert any(c["scenario_id"] == base["id"] and not c["created_now"] for c in body["cards"])


async def test_what_if_with_the_modes_the_parish_already_has_creates_nothing(
    logged_in: httpx.AsyncClient, llm: FakeLlm
) -> None:
    base = await make(logged_in, "Base", 60000)
    same = [{"parish": "Serzedelo", "allowed_modes": ["on_demand", "existing"]}]  # = os modos por omissão
    llm.queue_chat([("what_if", {"scenario_id": base["id"], "set_modes": same})], "Isso já é o que o cenário permite.")
    body = (await logged_in.post(C, json=ask("E se Serzedelo for a pedido?", scenario_id=base["id"]))).json()
    assert body["tools_used"] == [{"name": "what_if", "ok": False}]
    assert not any(c["created_now"] for c in body["cards"])
    assert len((await logged_in.get(f"{P}/scenarios")).json()) == 1


async def test_unknown_parish_creates_nothing(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    step = ("run_scenario", {**RUN[1], "restrictions": [{"parish": "Serzedelu", "allowed_modes": ["on_demand"]}]})
    llm.queue_chat([step], "Não encontrei essa freguesia; quis dizer Serzedelo?")
    body = (await logged_in.post(C, json=ask("Simula Serzedelu a pedido"))).json()
    assert body["tools_used"] == [{"name": "run_scenario", "ok": False}] and body["cards"] == []
    assert (await logged_in.get(f"{P}/scenarios")).json() == []


async def test_at_most_two_scenarios_per_turn_and_repeats_do_not_duplicate(
    logged_in: httpx.AsyncClient, llm: FakeLlm
) -> None:
    def run(label: str, budget: int) -> tuple[str, dict[str, Any]]:
        return ("run_scenario", {"label": label, "objective": "max_tonnes", "budget_eur_year": budget})

    llm.queue_chat([run("A", 20000), run("A", 20000), run("B", 30000), run("C", 40000)], "Criei dois cenários.")
    body = (await logged_in.post(C, json=ask("Cria vários"))).json()
    assert len(body["cards"]) == 2
    assert len((await logged_in.get(f"{P}/scenarios")).json()) == 2
    assert [t["ok"] for t in body["tools_used"]] == [True, True, False]  # o 3.º pedido ultrapassou o limite


async def test_unconnected_analyses_fail_gracefully_and_providers_can_be_registered(
    logged_in: httpx.AsyncClient, llm: FakeLlm, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def missing(*_: Any) -> Any:
        raise ImportError("not there yet")

    monkeypatch.setitem(copilot_tools.PROVIDERS, "get_container_coverage", missing)
    llm.queue_chat([("get_container_coverage", {})], "Essa análise ainda está indisponível.")
    body = (await logged_in.post(C, json=ask("Qual é a cobertura?"))).json()
    assert body["verified"] is True and body["tools_used"] == [{"name": "get_container_coverage", "ok": True}]

    async def fake_sensitivity(_: Any, args: dict[str, Any]) -> dict[str, Any]:
        return {"p50_eur_per_tonne": 410.5, "scenario": str(args["scenario_id"])}

    copilot_tools.register_provider("get_sensitivity", fake_sensitivity)
    monkeypatch.setitem(copilot_tools.PROVIDERS, "get_sensitivity", fake_sensitivity)
    base = await make(logged_in, "B", 30000)
    llm.queue_chat([("get_sensitivity", {"scenario_id": base["id"]})], "A mediana é 410,5 €/t (estimativa).")
    assert (await logged_in.post(C, json=ask("Robustez?"))).json()["verified"] is True


async def test_tool_arguments_are_validated_and_no_destructive_tools_exist(
    logged_in: httpx.AsyncClient, llm: FakeLlm
) -> None:
    llm.queue_chat([("run_scenario", {"label": "x", "objective": "max_tonnes"})], "Preciso do orçamento anual.")
    body = (await logged_in.post(C, json=ask("Simula"))).json()
    assert body["tools_used"] == [{"name": "run_scenario", "ok": False}] and body["cards"] == []
    from novelo.features.copilot.tools import CopilotTools  # noqa: PLC0415

    names = {s.name for s in CopilotTools(None, None).specs()}  # type: ignore[arg-type]
    assert {"get_baseline", "list_scenarios", "run_scenario", "compare_scenarios", "what_if"} <= names
    assert {"get_container_coverage", "get_sensitivity", "get_pilot_recommendation", "list_benchmarks"} <= names
    assert {"run_benchmark_scenario", "search_data", "explain_assumption", "generate_rap_report"} <= names
    assert {"analyze_attachment", "propose_action", "memory", "session_search", "show_chart"} <= names
    assert not any(w in n for n in names for w in ("delete", "remove", "rename", "update"))  # nada destrutivo


async def test_compare_scenarios_precomputes_differences(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    ids = [(await make(logged_in, label, budget))["id"] for label, budget in (("A", 20000), ("B", 60000))]
    llm.queue_chat([("compare_scenarios", {"scenario_ids": ids})], "Comparei os dois cenários; veja os cartões.")
    body = (await logged_in.post(C, json=ask("Compara A e B"))).json()
    assert len(body["cards"]) == 2 and all(not c["created_now"] for c in body["cards"]) and body["verified"] is True


async def test_validation_rate_limit_and_disabled(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    last_assistant = {"messages": [{"role": "assistant", "content": "olá"}]}
    assert (await logged_in.post(C, json=last_assistant)).status_code == 422
    llm.queue_chat(FeatureDisabledError("AI is disabled"))
    off = await logged_in.post(C, json=ask("olá"))
    assert off.status_code == 503 and off.json()["code"] == "feature_disabled"
    llm.queue_chat(*(["Posso ajudar com o planeamento da recolha de têxteis."] * 20))
    codes = [(await logged_in.post(C, json=ask("olá"))).status_code for _ in range(13)]
    assert codes.count(429) >= 1 and codes[0] == 200


async def test_unconnected_provider_says_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    async def missing(*_: Any) -> Any:
        raise ImportError("not there yet")

    monkeypatch.setitem(copilot_tools.PROVIDERS, "get_container_coverage", missing)
    out = await copilot_tools.CopilotTools(None, None).execute("get_container_coverage", "{}")  # type: ignore[arg-type]
    assert out["available"] is False and "indisponível" in out["message"]
    monkeypatch.delitem(copilot_tools.PROVIDERS, "get_sensitivity")
    gone = await copilot_tools.CopilotTools(None, None).execute(  # type: ignore[arg-type]
        "get_sensitivity", '{"scenario_id": "3f2a9c1e-0000-4000-8000-000000000123"}'
    )
    assert gone["available"] is False
