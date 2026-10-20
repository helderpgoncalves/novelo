"""Conjunto de avaliação do copiloto: casos, critérios automáticos e web simulada (sem modelo nem rede)."""

import importlib.util
import re
from pathlib import Path
from typing import Any

import pytest

from novelo.ai.eval_copilot import (
    EXPECT_KEYS,
    THRESHOLDS,
    Check,
    FixtureSearch,
    Harness,
    load_cases,
    load_suite,
    validate_cases,
)
from novelo.features.copilot import web as web_service
from novelo.features.copilot.tools import CopilotTools

ROOT = Path(__file__).resolve().parents[4]
EVALS = Path(__file__).resolve().parents[1] / "evals"
CORE, EXTENDED = EVALS / "copilot_cases.yaml", EVALS / "copilot_cases_extended.yaml"


def known_tools() -> set[str]:
    box = CopilotTools(None, None, web=web_service.WebSession(web_service.WebPolicy(True), 3))  # type: ignore[arg-type]
    return {s.name for s in box.specs()}


def test_both_suites_load_with_unique_ids_and_valid_definitions() -> None:
    cases = load_suite([CORE, EXTENDED])
    assert len(load_cases(CORE)) >= 70 and len(load_cases(EXTENDED)) >= 60
    assert validate_cases(cases, known_tools()) == []


def test_extended_suite_covers_every_kind_of_question() -> None:
    ids = {c["id"] for c in load_cases(EXTENDED)}
    for prefix in (
        "nl_", "chart_", "example_", "whatif_", "gaps_", "web_", "refuse_", "inj_", "impossible_", "ambiguous_",
    ):  # fmt: skip
        assert any(i.startswith(prefix) for i in ids), prefix
    langs = {c.get("lang") for c in load_cases(EXTENDED)}
    assert langs == {"pt-PT", "en"}
    web_cases = [c for c in load_cases(EXTENDED) if c["id"].startswith("web_")]
    assert len(web_cases) >= 15 and all(
        c.get("web_spec") is not None or c["id"].startswith("web_not") or c.get("role") or c.get("settings")
        for c in web_cases
    )


def test_every_web_case_uses_simulated_pages_only() -> None:
    for case in load_cases(EXTENDED):
        for page in (case.get("web_spec") or {}).get("pages", []):
            assert ".test/" in page["url"], case["id"]  # domínio de teste: nunca uma página real


def test_unknown_keys_tools_and_fixtures_are_reported(tmp_path: Path) -> None:
    bad = [
        {
            "id": "x",
            "lang": "fr",
            "turns": [],
            "expect": {"tools_any": ["nao_existe"], "chave_nova": 1, "must_contain_any": ["("]},
        }
    ]
    problems = validate_cases(bad, {"get_baseline"})
    assert len(problems) == 5 and any("regex" in p for p in problems)
    broken = tmp_path / "c.yaml"
    broken.write_text("cases:\n  - {id: a, turns: [{message: x}], web: falta}\n", encoding="utf-8")
    with pytest.raises(ValueError, match="desconhecida"):
        load_cases(broken)
    dup = tmp_path / "d.yaml"
    dup.write_text("cases:\n  - {id: a, turns: [{message: x}]}\n  - {id: a, turns: [{message: y}]}\n", encoding="utf-8")
    with pytest.raises(ValueError, match="repetidos"):
        load_suite([dup])


def test_expect_keys_documented_in_the_suite_header_exist() -> None:
    header = EXTENDED.read_text(encoding="utf-8").split("web_fixtures:")[0]
    for key in re.findall(r"^#   (\w+):", header, re.MULTILINE):
        assert key in EXPECT_KEYS, key
    assert "web" in THRESHOLDS


async def test_fixture_search_returns_test_pages_and_records_queries() -> None:
    search = FixtureSearch({"pages": [{"url": "https://a.test/x", "title": "T", "content": "C 2028"}]})
    found = await search("consulta", None)
    assert found.requests == 1 and found.citations[0].domain == "a.test" and search.queries == ["consulta"]
    empty = await FixtureSearch(None)("consulta", None)
    assert empty.citations == [] and empty.requests == 0
    with pytest.raises(Exception, match="http_403"):
        await FixtureSearch({"fail": "unavailable"})("q", None)
    with pytest.raises(Exception, match="simulated"):
        await FixtureSearch({"fail": "error"})("q", None)


def run_checks(
    exp: dict[str, Any], events: list[dict[str, Any]], tools: list[str], text: str, web: FixtureSearch | None = None
) -> list[Check]:
    checks: list[Check] = []
    Harness._evaluate_extended(exp, events, tools, text, lambda n, ok, d="": checks.append(Check(n, ok, d)), web)
    return checks


DONE = {"type": "web_search", "state": "done", "query": "q", "results": 1, "requests": 1}
SRC = {"type": "sources", "items": [{"kind": "web", "label": "Diretiva", "ref": "https://a.test/x"}]}
LABELLED = "O prazo é 2028 (fonte externa: https://a.test/x)."


def test_web_cases_pass_only_with_search_sources_and_label() -> None:
    ok = run_checks({"web": True, "cites_web": True}, [DONE, SRC], ["web_search"], LABELLED)
    assert all(c.ok for c in ok) and len(ok) == 3
    no_label = run_checks({"cites_web": True}, [DONE, SRC], ["web_search"], "O prazo é 2028.")
    assert [c.ok for c in no_label] == [True, False]
    assert not run_checks({"cites_web": True}, [DONE], ["web_search"], LABELLED)[0].ok  # sem fontes
    assert not run_checks({"web": True}, [], [], "Sem pesquisa.")[0].ok


def test_no_web_and_unavailable_and_leaks() -> None:
    assert run_checks({"no_web": True}, [], ["get_baseline"], "301 t")[0].ok
    assert not run_checks({"no_web": True}, [DONE], ["web_search"], "x")[0].ok
    unavailable = {"type": "web_search", "state": "unavailable", "reason": "region"}
    assert run_checks({"web_unavailable": True}, [unavailable], ["web_search"], "Indisponível.")[0].ok
    assert not run_checks({"web_unavailable": True}, [unavailable, {"type": "error"}], [], "")[0].ok
    spy = FixtureSearch(None)
    spy.queries.append("dados de ana@vitrus.pt")
    assert not run_checks({"web_queries_forbidden": ["@"]}, [], [], "", spy)[0].ok
    assert run_checks({"web_queries_forbidden": ["@"]}, [], [], "", FixtureSearch(None))[0].ok


def test_creation_arguments_and_missing_data_criteria() -> None:
    card = {"type": "card", "card": {"created_now": True}}
    assert not run_checks({"max_created": 1}, [card, card], [], "")[0].ok
    assert run_checks({"max_created": 2}, [card, card], [], "")[0].ok
    start = {
        "type": "tool_start",
        "name": "what_if",
        "args_summary": "scenario_id=1a2b…, param_changes=[{key:cost_per_km_eur…",
    }
    assert run_checks({"tool_args_contain": {"what_if": ["param_changes"]}}, [start], ["what_if"], "")[0].ok
    assert not run_checks({"tool_args_contain": {"what_if": ["budget"]}}, [start], ["what_if"], "")[0].ok
    assert run_checks({"no_data_admitted": True}, [], [], "Não tenho dados para 2031.")[0].ok
    assert not run_checks({"no_data_admitted": True}, [], [], "Em 2031 serão 410 t.")[0].ok
    assert not run_checks({"no_data_admitted": True}, [card], [], "Não tenho dados, mas criei um cenário.")[0].ok


def test_refusal_or_web_accepts_a_refusal_or_a_cited_answer() -> None:
    assert run_checks({"refusal_or_web": True}, [], [], "Só tenho dados de Guimarães.")[0].ok
    assert run_checks({"refusal_or_web": True}, [DONE, SRC], ["web_search"], LABELLED)[0].ok
    assert not run_checks({"refusal_or_web": True}, [], [], "Braga recolhe 5 t.")[0].ok


def test_the_eval_script_imports_and_lists_both_suites() -> None:
    spec = importlib.util.spec_from_file_location("eval_copilot_script", ROOT / "scripts" / "eval_copilot.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert set(module.SUITES) == {"core", "extended", "all"}
    assert all(p.exists() for paths in module.SUITES.values() for p in paths)
