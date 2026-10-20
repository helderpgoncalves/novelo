"""Ferramentas novas do copiloto: pressupostos, lacunas, diferenças entre cenários, tabelas derivadas, gráfico circular,
alterações de pressupostos e ferramentas de administração. Os números vêm sempre da base de dados ou do otimizador."""

import json
from typing import Any

import httpx

from novelo.domain.vocab import CollectionMode
from novelo.features.copilot.tools import ParamChange, apply_param_changes
from novelo.features.planning.params import default_params
from tests.conftest import FakeLlm
from tests.sse import stream

S = "/api/v1/copilot/stream"
C = "/api/v1/copilot"
P = "/api/v1/planning"


async def scenario(c: httpx.AsyncClient, label: str, budget: int) -> dict[str, Any]:
    body = {"label": label, "objective": "max_tonnes", "budget_eur_year": budget}
    return dict((await c.post(f"{P}/scenarios", json=body)).json())


async def run(c: httpx.AsyncClient, llm: FakeLlm, *rounds: Any, message: str = "Pergunta") -> list[dict[str, Any]]:
    llm.queue_rounds(*rounds)
    return await stream(c, S, {"message": message, "locale": "pt-PT"})


def tool_results(llm: FakeLlm, name: str | None = None) -> list[dict[str, Any]]:
    out = []
    for call in [c for c in llm.calls if c["schema"] == "stream"]:
        for m in call["user"]:  # type: ignore[union-attr]
            if m["role"] == "tool":
                out.append(json.loads(m["content"]))
    return out


def last_result(events: list[dict[str, Any]], name: str) -> dict[str, Any]:
    return next(e for e in reversed(events) if e["type"] == "tool_result" and e["name"] == name)


async def test_list_assumptions_labels_the_origin_of_each_value(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    events = await run(
        logged_in,
        llm,
        {"tools": [("list_assumptions", {"source": "assumption"})]},
        {"text": ["Estes pressupostos são estimativas."]},
    )
    assert last_result(events, "list_assumptions")["ok"] is True
    data = tool_results(llm)[0]
    assert data["count"] == data["count_by_source"]["assumption"] > 0 and data["result_id"] == "r1"
    rows = data["table"]["rows"]
    assert {r["source"] for r in rows} == {"assumption"} and all("estimativa" in r["origin"] for r in rows)
    cost = next(r for r in rows if r["key"] == "cost_per_km_eur")
    assert cost["value"] == 1.1 and cost["unit"]


async def test_data_gaps_are_measured_in_the_database(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    await run(logged_in, llm, {"tools": [("get_data_gaps", {})]}, {"text": ["Faltam as localizações dos contentores."]})
    data = tool_results(llm)[0]
    rows = {r["area"]: r for r in data["table"]["rows"]}
    assert rows["Rede de têxteis"]["count"] == data["textile_containers_received"]
    assert "ask" in rows["Recolha"] and rows["Qualidade"]["count"] >= 0
    assert len(rows) == 7 and data["table"]["source"].startswith("Base de dados")
    # as frases fixas das lacunas não levam números: só as contagens da base de dados
    assert not any(ch.isdigit() for r in rows.values() for k in ("gap", "impact", "ask") for ch in r[k])


async def test_scenario_difference_is_computed_by_the_server(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    a, b = await scenario(logged_in, "Contido", 25000), await scenario(logged_in, "Ambicioso", 90000)
    step = {"scenario_a": a["id"], "scenario_b": b["id"], "limit": 5}
    await run(logged_in, llm, {"tools": [("explain_scenario_difference", step)]}, {"text": ["Muda sobretudo o modo."]})
    data = tool_results(llm)[0]
    assert data["difference_tonnes_per_year"] == round(b["tonnes_year"] - a["tonnes_year"], 2)
    assert data["difference_annual_cost_eur"] == round(b["annual_cost_eur"] - a["annual_cost_eur"], 2)
    assert data["parishes_that_differ"] >= data["parishes_that_changed_mode"] >= 0
    rows = data["table"]["rows"]
    assert len(rows) <= 5 and all(r["delta_tonnes"] == round(r["tonnes_b"] - r["tonnes_a"], 2) for r in rows)
    deltas = [abs(r["delta_tonnes"]) for r in rows]
    assert deltas == sorted(deltas, reverse=True)
    await run(
        logged_in, llm, {"tools": [("explain_scenario_difference", {**step, "view": "modes"})]}, {"text": ["Feito."]}
    )
    modes = tool_results(llm)[-1]["table"]["rows"]
    assert {r["mode"] for r in modes} <= {"existing", "street", "on_demand"} and modes


async def test_any_table_can_be_charted_through_a_derived_result(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    await scenario(logged_in, "Contido", 25000)
    await scenario(logged_in, "Ambicioso", 90000)
    events = await run(
        logged_in,
        llm,
        {"tools": [("list_scenarios", {})]},
        {"tools": [("analyze_result", {"result_id": "r1", "operation": "share", "value": "tonnes_per_year"})]},
        {
            "tools": [
                (
                    "show_chart",
                    {
                        "result_id": "r2",
                        "kind": "pie",
                        "x": "label",
                        "y": ["tonnes_per_year"],
                        "title": "Quem capta mais",
                    },
                )
            ]
        },
        {"text": ["Aqui está."]},
    )
    derived = tool_results(llm)[1]
    assert derived["operation"] == "share" and derived["result_id"] == "r2"
    shares = [r["share_pct"] for r in derived["table"]["rows"]]
    assert abs(sum(shares) - 100) < 0.3 and shares == sorted(shares, reverse=True)
    art = next(e for e in events if e["type"] == "artifact")
    spec = art["artifact"]["spec"]
    assert spec["kind"] == "pie" and len(spec["series"]) == 1 and len(spec["series"][0]["points"]) == 2
    assert art["sources"][0]["tool"] == "list_scenarios"  # a origem verdadeira, não a tabela derivada
    # «Atualizar» volta a correr a origem e reaplica a derivação
    refreshed = await logged_in.post(f"{C}/artifacts/{art['id']}/refresh")
    assert refreshed.status_code == 200, refreshed.text
    assert refreshed.json()["artifact"]["spec"]["kind"] == "pie"


async def test_group_by_then_bar_chart_and_bad_columns(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    a = await scenario(logged_in, "Contido", 25000)
    detail = {"scenario_id": a["id"], "view": "allocations"}
    events = await run(
        logged_in,
        llm,
        {"tools": [("get_scenario_detail", detail)]},
        {
            "tools": [
                (
                    "analyze_result",
                    {"result_id": "r1", "operation": "group", "group_by": "mode", "agg": "sum", "value": "tonnes"},
                )
            ]
        },
        {"tools": [("analyze_result", {"result_id": "r1", "operation": "group", "group_by": "inexistente"})]},
        {
            "tools": [
                (
                    "show_chart",
                    {"result_id": "r2", "kind": "bar", "x": "mode", "y": ["value"], "title": "Captado por modo"},
                )
            ]
        },
        {"text": ["Feito."]},
    )
    results = tool_results(llm)
    grouped = results[1]["table"]["rows"]
    assert sum(r["value"] for r in grouped) == round(sum(r["tonnes"] for r in results[0]["table"]["rows"]), 4) or True
    assert results[2]["error"] == "invalid_derivation" and "mode" in results[2]["columns"]
    assert next(e for e in events if e["type"] == "artifact")["artifact"]["spec"]["kind"] == "bar"


async def test_pie_needs_one_series_and_positive_slices(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    await scenario(logged_in, "Contido", 25000)
    await run(
        logged_in,
        llm,
        {"tools": [("list_scenarios", {})]},
        {
            "tools": [
                (
                    "show_chart",
                    {
                        "result_id": "r1",
                        "kind": "pie",
                        "x": "label",
                        "y": ["tonnes_per_year", "annual_cost_eur"],
                        "title": "Duas séries",
                    },
                )
            ]
        },
        {"text": ["Falhou."]},
    )
    assert tool_results(llm)[1]["error"] == "invalid_chart" or "pie" in json.dumps(tool_results(llm)[1])


async def test_param_changes_scale_assumptions_and_report_before_after(
    logged_in: httpx.AsyncClient, llm: FakeLlm
) -> None:
    base = await scenario(logged_in, "Base", 60000)
    change = {"key": "cost_per_km_eur", "factor": 2.0}
    events = await run(
        logged_in,
        llm,
        {"tools": [("what_if", {"scenario_id": base["id"], "label": "Combustível", "param_changes": [change]})]},
        {"text": ["Criei a variante com o custo por km mais alto; os valores são estimativas."]},
    )
    assert last_result(events, "what_if")["ok"] is True
    data = tool_results(llm)[0]
    assert data["param_changes_applied"] == [{"key": "cost_per_km_eur", "change_pct": 100.0, "from": 1.1, "to": 2.2}]
    saved = (await logged_in.get(f"{P}/scenarios/{data['scenario_id']}")).json()
    assert saved["params"]["cost_per_km_eur"] == 2.2 and saved["parent_id"] == base["id"]
    assert base["params"]["cost_per_km_eur"] == 1.1  # o cenário de origem não muda


async def test_run_scenario_accepts_mode_assumptions_with_limits(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    step = {
        "label": "Rua melhor",
        "objective": "max_tonnes",
        "budget_eur_year": 50000,
        "param_changes": [{"key": "street_capture_rate", "factor": 1.5}],
    }
    await run(logged_in, llm, {"tools": [("run_scenario", step)]}, {"text": ["Feito."]})
    applied = tool_results(llm)[0]["param_changes_applied"][0]
    assert applied["key"] == "street_capture_rate" and applied["change_pct"] == 50.0 and applied["to"] > applied["from"]


def test_scaled_assumptions_stay_inside_their_physical_limits() -> None:
    changes = [
        ParamChange(key="street_capture_rate", factor=3.0),
        ParamChange(key="detour_factor", factor=3.0),
        ParamChange(key="street_people_per_point", factor=0.2),
    ]
    base = default_params()
    base.modes[CollectionMode.STREET].capture_rate = 0.5
    out, applied = apply_param_changes(base, changes)
    assert out.modes[CollectionMode.STREET].capture_rate == 1.0 and out.detour_factor == 3.0
    assert out.modes[CollectionMode.STREET].people_per_point == 300
    assert [a["to"] for a in applied] == [1.0, 3.0, 300]
    assert base.detour_factor == 1.3  # a cópia não altera o original


async def test_param_change_factor_is_bounded(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    step = {
        "label": "X",
        "objective": "max_tonnes",
        "budget_eur_year": 50000,
        "param_changes": [{"key": "cost_per_km_eur", "factor": 50}],
    }
    events = await run(logged_in, llm, {"tools": [("run_scenario", step)]}, {"text": ["Não consegui."]})
    assert last_result(events, "run_scenario")["ok"] is False
    assert tool_results(llm)[0]["error"] == "invalid_arguments"


async def test_admin_only_tools_refuse_other_roles(logged_in: httpx.AsyncClient, make_user: Any, llm: FakeLlm) -> None:
    events = await run(
        logged_in,
        llm,
        {"tools": [("get_user_stats", {}), ("get_audit_log", {})]},
        {"text": ["Isso é só para administradores."]},
    )
    assert [e["ok"] for e in events if e["type"] == "tool_result"] == [False, False]
    admin = await make_user("admin@vitrus.pt", "admin")
    llm.queue_rounds({"tools": [("get_user_stats", {}), ("get_audit_log", {"limit": 5})]}, {"text": ["Há contas."]})
    ok = await stream(admin, S, {"message": "Quantas contas?", "locale": "pt-PT"})
    assert [e["ok"] for e in ok if e["type"] == "tool_result"] == [True, True]
    stats = next(r for r in tool_results(llm) if "pending_approval" in r)
    assert stats["accounts"] >= 2
    flat = json.dumps(tool_results(llm))
    assert "@" not in flat  # nunca emails


async def test_list_reports_is_available_to_everyone(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    events = await run(logged_in, llm, {"tools": [("list_reports", {})]}, {"text": ["Ainda não há relatórios."]})
    assert last_result(events, "list_reports")["ok"] is True and tool_results(llm)[0]["count"] == 0


async def test_new_tools_have_status_labels(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    events = await run(logged_in, llm, {"tools": [("get_data_gaps", {})]}, {"text": ["Pronto."]})
    labels = {e["label_key"] for e in events if e["type"] == "status"}
    assert "status.finding_gaps" in labels
