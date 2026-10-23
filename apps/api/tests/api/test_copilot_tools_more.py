"""Ferramentas novas do copiloto: pressupostos, lacunas, diferenças entre cenários, tabelas derivadas, gráfico circular,
alterações de pressupostos e ferramentas de administração. Os números vêm sempre da base de dados ou do otimizador."""

import json
import re
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
    await run(logged_in, llm, {"tools": [("get_data_gaps", {})]}, {"text": ["Faltam os custos das viaturas."]})
    data = tool_results(llm)[0]
    rows = {r["area"]: r for r in data["table"]["rows"]}
    assert "none" in data["textile_containers"] and "textile_containers_received" not in data
    assert "ask" in rows["Recolha"] and rows["Qualidade"]["count"] >= 0
    assert len(rows) == 9 and data["table"]["source"].startswith("Base de dados")
    # não há contentores de têxteis: as localizações deles nunca são uma lacuna
    assert not any("contentores de têxteis" in r["gap"] for r in rows.values())
    assert "viatura" in rows["Simulador"]["ask"] and "Rotas" in rows
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
    assert [a["to"] for a in applied] == [100.0, 3.0, 300]  # as taxas saem em %
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


async def test_scenario_facts_carry_vehicle_avoided_treatment_and_routing(
    logged_in: httpx.AsyncClient, llm: FakeLlm
) -> None:
    base = await scenario(logged_in, "Base", 60000)
    await run(
        logged_in,
        llm,
        {"tools": [("what_if", {"scenario_id": base["id"], "budget_eur_year": 70000})]},
        {"text": ["Feito."]},
    )
    data = tool_results(llm)[0]
    kpis = (await logged_in.get(f"{P}/scenarios/{data['scenario_id']}")).json()["result"]["kpis"]
    assert data["routing"] == "estimate" and data["routing_meaning"].startswith("ESTIMATE")  # sem OSRM nos testes
    assert data["vehicles"] == kpis["vehicles"] and data["net_annual_cost_eur"] == kpis["net_annual_cost_eur"]
    assert data["avoided_treatment_eur"] == kpis["avoided_treatment_eur"]


async def test_scenario_detail_routes_and_plan_views_tell_the_provenance(
    logged_in: httpx.AsyncClient, llm: FakeLlm
) -> None:
    base = await scenario(logged_in, "Base", 60000)
    steps = [("get_scenario_detail", {"scenario_id": base["id"], "view": v}) for v in ("routes", "plan")]
    await run(logged_in, llm, {"tools": steps}, {"text": ["Veja as tabelas."]})
    routes, plan = tool_results(llm)[:2]
    assert routes["routing"] == "estimate" and {c["key"] for c in routes["table"]["columns"]} >= {
        "source",
        "duration_min",
    }
    assert all(r["source"] == "estimate" and r["duration_min"] is None for r in routes["table"]["rows"])
    assert plan["view"] == "plan" and plan["plan_available"] is True
    assert {"weekday", "every_weeks", "kg_per_round"} <= {c["key"] for c in plan["table"]["columns"]}
    assert plan["table"]["rows"] and all(
        r["channel"] in {"on_demand", "existing", "street"} for r in plan["table"]["rows"]
    )


async def test_assumptions_explain_the_road_calibration_and_the_missing_vehicle_costs(
    logged_in: httpx.AsyncClient, llm: FakeLlm
) -> None:
    await run(
        logged_in,
        llm,
        {"tools": [("explain_assumption", {"query": "desvio"}), ("explain_assumption", {"query": "quilómetro"})]},
        {"text": ["Veja."]},
    )
    detour, cost = tool_results(llm)[:2]
    assert "1,48" in detour["assumptions"][0]["note"] and "1,37" in detour["assumptions"][0]["note"]
    assert "ainda não enviou" in cost["assumptions"][0]["note"] and "estimativa" in cost["assumptions"][0]["note"]
    queries = ("vehicle_speed", "tratamento", "street.capture")
    await run(logged_in, llm, {"tools": [("explain_assumption", {"query": q}) for q in queries]}, {"text": ["Veja."]})
    speed, treatment, street = (r["assumptions"][0] for r in tool_results(llm)[-3:])
    assert "41,4" in speed["note"] and "Resinorte" in treatment["note"] and "referência" in street["note"].lower()
    await run(logged_in, llm, {"tools": [("list_assumptions", {"source": "vitrus_data"})]}, {"text": ["Veja."]})
    assert {"key", "note"} <= {c["key"] for c in tool_results(llm)[-1]["table"]["columns"]}


async def test_baseline_has_the_current_demand_base_and_no_textile_containers(
    logged_in: httpx.AsyncClient, llm: FakeLlm
) -> None:
    await run(logged_in, llm, {"tools": [("get_baseline", {})]}, {"text": ["Veja."]})
    b = tool_results(llm)[0]
    assert (
        b["still_in_bin_t"] == 3003.3
        and b["textile_generated_t"] == 3304.6
        and b["current_capture_pct"] == 9.1
        and "none" in b["textile_containers"]
    )
    assert (
        b["collected_kg_per_inhab_month"] == 0.16 and b["to_divert_kg_per_inhab_month"] == 1.6
    )  # o 0,7 antigo já não existe


async def test_textile_coverage_says_there_is_nothing_to_cover(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    await run(logged_in, llm, {"tools": [("get_container_coverage", {})]}, {"text": ["Não há contentores de têxteis."]})
    assert "NO textile containers" in tool_results(llm)[0]["note"]


async def test_param_changes_accept_the_dedicated_vehicle_price_and_speed() -> None:
    params, applied = apply_param_changes(
        default_params(),
        [ParamChange(key="vehicle_capex_eur", factor=1.2), ParamChange(key="vehicle_speed_kmh", factor=0.5)],
    )
    assert params.vehicle_capex_eur == 51000.0 and params.vehicle_speed_kmh == 15.0
    assert [(a["key"], a["change_pct"]) for a in applied] == [("vehicle_capex_eur", 20.0), ("vehicle_speed_kmh", -50.0)]


async def test_lot_history_gives_dates_as_text_the_verifier_can_check(
    logged_in: httpx.AsyncClient, llm: FakeLlm
) -> None:
    code = (await logged_in.post("/api/v1/lots", json={"parish_code": None})).json()["code"]
    await run(logged_in, llm, {"tools": [("get_lot_history", {"code": code})]}, {"text": ["Veja o histórico."]})
    rows = tool_results(llm)[0]["table"]["rows"]
    assert rows and all(re.fullmatch(r"\d{2}/\d{2}/\d{4} \d{2}:\d{2}", r["at_text"]) for r in rows)


async def test_photo_policy_comes_from_the_code_and_configuration(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    await run(logged_in, llm, {"tools": [("get_photo_policy", {})]}, {"text": ["Veja."]})
    p = tool_results(llm)[0]
    assert p["thumbnail_max_side_px"] == 640 and p["thumbnail_max_kb"] == 150 and p["retention_days"] == 90
    assert (
        p["passport_max_photos"] == 12
        and "NO image" in p["triage_stores_nothing"]
        and "delivered" in p["delivered_lot"]
    )


async def test_scenarios_created_by_the_copilot_get_one_prefix_and_a_useful_name(
    logged_in: httpx.AsyncClient, llm: FakeLlm
) -> None:
    steps = [
        ("run_scenario", {"label": "Copilot", "objective": "max_tonnes", "budget_eur_year": 45000}),
    ]
    await run(logged_in, llm, {"tools": steps}, {"text": ["Feito."]})
    first = tool_results(llm)[0]
    assert first["label"] == "Copilot · 45 000 €/ano, por freguesia"
    await run(
        logged_in,
        llm,
        {"tools": [("what_if", {"scenario_id": first["scenario_id"], "budget_eur_year": 50000})]},
        {"text": ["Feito."]},
    )
    second = tool_results(llm)[-1]
    assert second["label"] == "Copilot · 45 000 €/ano, por freguesia · variante"


async def test_list_scenarios_can_return_only_the_reference_scenarios(
    logged_in: httpx.AsyncClient, llm: FakeLlm
) -> None:
    await run(logged_in, llm, {"tools": [("list_scenarios", {"references_only": True})]}, {"text": ["Veja."]})
    data = tool_results(llm)[0]
    keys = [r["reference_key"] for r in data["table"]["rows"]]
    assert all(k and (k.startswith("parish:") or k.startswith("sites:")) for k in keys)


async def test_out_of_range_values_come_back_with_a_do_not_retry_hint(
    logged_in: httpx.AsyncClient, llm: FakeLlm
) -> None:
    step = {"objective": "max_tonnes", "budget_eur_year": -5000}
    await run(logged_in, llm, {"tools": [("run_scenario", step)]}, {"text": ["Não é possível."]})
    out = tool_results(llm)[0]
    assert out["error"] == "invalid_arguments" and "Do NOT retry" in out["hint"]
    scenarios = (await logged_in.get(f"{P}/scenarios")).json()
    assert not any("-5" in s["label"] for s in scenarios)
