"""Artefactos no stream e na galeria; histórico unificado com cursor estável, filtros, isolamento e retenção."""

from typing import Any

import httpx

from tests.conftest import FakeLlm
from tests.sse import stream

S = "/api/v1/copilot/stream"
C = "/api/v1/copilot"
P = "/api/v1/planning"


async def scenario(c: httpx.AsyncClient, label: str, budget: int) -> dict[str, Any]:
    return dict(
        (
            await c.post(f"{P}/scenarios", json={"label": label, "objective": "max_tonnes", "budget_eur_year": budget})
        ).json()
    )


def chart_args(**kw: Any) -> dict[str, Any]:
    return {
        "result_id": "r1",
        "kind": "bar",
        "x": "label",
        "y": ["eur_per_tonne"],
        "title": "Custo por tonelada por cenário",
        **kw,
    }


async def chat(c: httpx.AsyncClient, llm: FakeLlm, message: str, *rounds: Any, **extra: Any) -> list[dict[str, Any]]:
    llm.queue_rounds(*rounds)
    return await stream(c, S, {"message": message, "locale": "pt-PT", **extra})


async def test_chart_is_built_by_the_server_from_real_data(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    a = await scenario(logged_in, "Contido", 25000)
    ev = await chat(
        logged_in,
        llm,
        "Gráfico do custo por tonelada",
        {"tools": [("list_scenarios", {})]},
        {"tools": [("show_chart", chart_args())]},
        {"text": ["O gráfico mostra o custo por cenário."]},
    )
    art = next(e for e in ev if e["type"] == "artifact")
    assert art["artifact"]["artifact_type"] == "chart" and art["sources"][0]["tool"] == "list_scenarios"
    spec = art["artifact"]["spec"]
    assert spec["kind"] == "bar" and spec["estimate"] is True and spec["y_label"] == "Custo por tonelada"
    point = spec["series"][0]["points"][0]
    assert point["x"] == "Contido" and point["y"] == a["eur_per_tonne"]  # o valor vem do otimizador, não do modelo


async def test_numbers_in_the_title_must_exist_in_the_data(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    await scenario(logged_in, "Contido", 25000)
    ev = await chat(
        logged_in,
        llm,
        "Gráfico",
        {"tools": [("list_scenarios", {})]},
        {"tools": [("show_chart", chart_args(title="Custo desce 99999 % no Contido"))]},
        {"text": ["Feito."]},
    )
    assert "99999" not in next(e for e in ev if e["type"] == "artifact")["title"]


async def test_bad_references_and_columns_come_back_to_the_model(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    await scenario(logged_in, "Contido", 25000)
    ev = await chat(
        logged_in, llm, "x",
        {"tools": [("list_scenarios", {})]},
        {"tools": [("show_chart", chart_args(result_id="r99")), ("show_chart", chart_args(y=["nao_existe"])), ("show_chart", chart_args(kind="gauge", y=["label"]))]},
        {"text": ["Não consegui desenhar o gráfico."]},
    )  # fmt: skip
    results = [e for e in ev if e["type"] == "tool_result" and e["name"] == "show_chart"]
    assert [r["ok"] for r in results] == [False, False, False] and "artifact" not in [e["type"] for e in ev]


async def test_every_artifact_tool_end_to_end(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    a, b = await scenario(logged_in, "A", 20000), await scenario(logged_in, "B", 60000)
    ev = await chat(
        logged_in, llm, "Mostra tudo",
        {"tools": [("compare_scenarios", {"scenario_ids": [a["id"], b["id"]]}), ("list_parishes", {"limit": 5}), ("get_baseline", {}), ("get_flows", {})]},
        {"tools": [
            ("show_comparison", {"result_id": "r1", "title": "A contra B"}),
            ("show_table", {"result_id": "r2", "columns": ["name", "population"], "sort_by": "population", "title": "Freguesias"}),
            ("show_map", {"layers": [{"kind": "parishes", "result_id": "r2", "label_col": "name", "value_col": "population"}], "title": "Mapa"}),
            ("show_kpis", {"result_id": "r3", "keys": ["collected_t"], "title": "Recolhido"}),
            ("show_chart", {"result_id": "r4", "kind": "sankey", "x": "source", "series": "target", "y": ["tonnes"], "title": "Fluxo"}),
            ("show_scenario_card", {"scenario_id": a["id"]}),
        ]},
        {"text": ["Aqui estão."]},
    )  # fmt: skip
    kinds = [e["artifact"]["artifact_type"] for e in ev if e["type"] == "artifact"]
    assert kinds == ["comparison", "table", "map", "kpis", "chart", "scenario_card"], [
        e for e in ev if e["type"] == "tool_result"
    ]
    cmp_spec = next(e for e in ev if e["type"] == "artifact" and e["artifact"]["artifact_type"] == "comparison")[
        "artifact"
    ]["spec"]
    assert {c["label"] for c in cmp_spec["columns"]} == {"A", "B"}


async def test_artifacts_persist_in_the_thread_and_the_gallery_can_refresh_and_pin(
    logged_in: httpx.AsyncClient, llm: FakeLlm
) -> None:
    await scenario(logged_in, "Contido", 25000)
    ev = await chat(
        logged_in,
        llm,
        "Gráfico",
        {"tools": [("list_scenarios", {})]},
        {"tools": [("show_chart", chart_args())]},
        {"text": ["Feito."]},
    )
    tid, art = ev[0]["thread_id"], next(e for e in ev if e["type"] == "artifact")
    thread = (await logged_in.get(f"{C}/threads/{tid}")).json()
    assert thread["messages"][1]["artifacts"][0]["id"] == art["id"]  # volta a aparecer ao reabrir a conversa
    gallery = (await logged_in.get(f"{C}/artifacts")).json()["items"]
    assert (
        [g["id"] for g in gallery] == [art["id"]]
        and gallery[0]["thread_id"] == tid
        and gallery[0]["refreshable"] is True
    )
    await scenario(logged_in, "Novo", 90000)  # os dados mudam
    refreshed = (await logged_in.post(f"{C}/artifacts/{art['id']}/refresh")).json()
    assert len(refreshed["artifact"]["spec"]["series"][0]["points"]) == 2 and refreshed["refreshed_at"]
    assert (await logged_in.put(f"{C}/artifacts/{art['id']}/pin", params={"pinned": True})).json()["pinned"] is True
    assert (await logged_in.get(f"{C}/artifacts", params={"pinned": True})).json()["items"][0]["id"] == art["id"]
    assert (await logged_in.get(f"{C}/artifacts", params={"artifact_type": "table"})).json()["items"] == []
    assert (await logged_in.get(f"{C}/artifacts", params={"q": "tonelada"})).json()["items"]
    assert (await logged_in.delete(f"{C}/artifacts/{art['id']}")).status_code == 204 and (
        await logged_in.get(f"{C}/artifacts")
    ).json()["items"] == []


async def test_gallery_is_private(logged_in: httpx.AsyncClient, llm: FakeLlm, make_user: Any) -> None:
    await scenario(logged_in, "Contido", 25000)
    ev = await chat(
        logged_in,
        llm,
        "Gráfico",
        {"tools": [("list_scenarios", {})]},
        {"tools": [("show_chart", chart_args())]},
        {"text": ["Feito."]},
    )
    art = next(e for e in ev if e["type"] == "artifact")
    other = await make_user("rui@x.pt")
    assert (await other.get(f"{C}/artifacts")).json()["items"] == []
    assert (await other.post(f"{C}/artifacts/{art['id']}/refresh")).status_code == 404
    assert (await other.put(f"{C}/artifacts/{art['id']}/pin")).status_code == 404
    assert (await other.delete(f"{C}/artifacts/{art['id']}")).status_code == 404


async def test_open_page_ask_user_and_plan_events(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    ev = await chat(
        logged_in,
        llm,
        "Abre o mapa",
        {
            "tools": [
                ("make_plan", {"steps": ["Abrir o mapa", "Explicar a legenda"]}),
                ("open_page", {"route": "/map", "label": "Mapa"}),
            ]
        },
        {"text": ["Aqui tens o botão."]},
    )
    assert next(e for e in ev if e["type"] == "plan")["steps"] == ["Abrir o mapa", "Explicar a legenda"]
    assert next(e for e in ev if e["type"] == "navigate")["route"] == "/map"
    bad = await chat(
        logged_in,
        llm,
        "Abre",
        {"tools": [("open_page", {"route": "/etc/passwd"}), ("open_page", {"route": "/admin/ai"})]},
        {"text": ["Não consigo."]},
    )
    assert [e["ok"] for e in bad if e["type"] == "tool_result"] == [False, False] and "navigate" not in [
        e["type"] for e in bad
    ]  # rota desconhecida / só admin
    asked = await chat(
        logged_in,
        llm,
        "Compara",
        {"tools": [("ask_user", {"question": "Que cenário?", "options": ["Base", "Ambicioso"]})]},
    )
    clarify = next(e for e in asked if e["type"] == "clarify")
    assert (
        clarify["options"] == ["Base", "Ambicioso"]
        and asked[-1]["type"] == "done"
        and "Que cenário?" in "".join(e.get("delta", "") for e in asked)
    )
    assert next(e for e in asked if e["type"] == "verification")["verified"] is True and "suggestions" not in [
        e["type"] for e in asked
    ]


async def test_sources_event_lists_what_was_used(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    ev = await chat(logged_in, llm, "Quanto?", {"tools": [("get_baseline", {})]}, {"text": ["Recolheram-se 301,3 t."]})
    sources = next(e for e in ev if e["type"] == "sources")["items"]
    assert next(s for s in sources if s["label"] == "get_baseline") == {
        "kind": "tool",
        "label": "get_baseline",
        "ref": None,
        "domain": None,
        "excerpt": None,
        "external": False,
    }


async def test_settings_hide_tool_steps_and_suggestions(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    from novelo.features.copilot.schemas_memory import CopilotSettings  # noqa: PLC0415

    await logged_in.put(
        f"{C}/settings",
        json={**CopilotSettings().model_dump(), "show_tool_steps": False, "follow_up_suggestions": False},
    )
    ev = await chat(logged_in, llm, "Quanto?", {"tools": [("get_baseline", {})]}, {"text": ["Recolheram-se 301,3 t."]})
    kinds = [e["type"] for e in ev]
    assert "tool_start" not in kinds and "tool_result" not in kinds and "suggestions" not in kinds
    assert any(e["type"] == "status" and e["label_key"] == "status.reading_baseline" for e in ev)  # a animação continua


# --- histórico unificado -------------------------------------------------------------------------------


async def seed_history(c: httpx.AsyncClient, llm: FakeLlm) -> None:
    base = await scenario(c, "Base", 30000)
    for i in range(4):
        await chat(c, llm, f"Pergunta número {i} sobre Serzedelo", {"text": ["Resposta."]})
    for i in range(4):
        await c.post(
            f"{C}/actions",
            json={"type": "duplicate_scenario", "params": {"scenario_id": base["id"], "label": f"copia{i}"}},
        )
    await c.post(f"{C}/memory/entries", json={"target": "user", "content": "Prefere tabelas."})
    await c.post(f"{C}/attachments", files={"files": ("t.csv", b"a;b\n1;2\n", "text/csv")})
    await chat(
        c,
        llm,
        "Gráfico",
        {"tools": [("list_scenarios", {})]},
        {"tools": [("show_chart", chart_args())]},
        {"text": ["Feito."]},
    )


async def test_history_cursor_pagination_is_stable_even_with_identical_timestamps(
    logged_in: httpx.AsyncClient, llm: FakeLlm
) -> None:
    await seed_history(logged_in, llm)
    full = (await logged_in.get(f"{C}/history", params={"limit": 100})).json()
    assert full["next_cursor"] is None and len(full["items"]) >= 12
    seen: list[str] = []
    cursor: str | None = None
    for _ in range(20):
        page = (
            await logged_in.get(f"{C}/history", params={"limit": 3, **({"cursor": cursor} if cursor else {})})
        ).json()
        seen += [i["id"] for i in page["items"]]
        cursor = page["next_cursor"]
        if not cursor:
            break
    assert seen == [i["id"] for i in full["items"]] and len(seen) == len(
        set(seen)
    )  # sem repetidos nem saltos, mesma ordem
    assert {i["kind"] for i in full["items"]} == {"conversation", "action", "artifact", "memory", "attachment"}
    times = [i["occurred_at"] for i in full["items"]]
    assert times == sorted(times, reverse=True)
    assert (await logged_in.get(f"{C}/history", params={"cursor": "lixo"})).status_code == 400


async def test_history_filters_search_and_date_range(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    await seed_history(logged_in, llm)
    only = (
        await logged_in.get(f"{C}/history", params=[("kinds", "action"), ("kinds", "memory"), ("limit", 100)])
    ).json()["items"]
    assert {i["kind"] for i in only} == {"action", "memory"} and len(only) == 5
    pending = (
        await logged_in.get(f"{C}/history", params={"kinds": "action", "status": "proposed", "limit": 100})
    ).json()["items"]
    assert len(pending) == 4 and all(i["status"] == "proposed" for i in pending)
    found = (await logged_in.get(f"{C}/history", params={"q": "serzedêlo", "limit": 100})).json()["items"]
    assert len(found) == 4 and {i["kind"] for i in found} == {"conversation"}  # pesquisa sem acentos nas mensagens
    dup = (await logged_in.get(f"{C}/history", params={"q": "duplicar base", "kinds": "action", "limit": 50})).json()[
        "items"
    ]
    assert len(dup) == 4
    assert (await logged_in.get(f"{C}/history", params={"q": "tabelas", "kinds": "memory"})).json()["items"][0][
        "title"
    ] == "Prefere tabelas."
    assert (await logged_in.get(f"{C}/history", params={"kinds": "attachment"})).json()["items"][0]["title"] == "t.csv"
    future = (await logged_in.get(f"{C}/history", params={"since": "2999-01-01T00:00:00Z"})).json()
    assert future["items"] == []
    past = (await logged_in.get(f"{C}/history", params={"until": "2000-01-01T00:00:00Z"})).json()
    assert past["items"] == []
    combined = (
        await logged_in.get(
            f"{C}/history", params={"kinds": "conversation", "q": "pergunta", "status": "active", "limit": 2}
        )
    ).json()
    assert len(combined["items"]) == 2 and combined["next_cursor"]


async def test_history_is_isolated_and_deleting_data_clears_it(
    logged_in: httpx.AsyncClient, llm: FakeLlm, make_user: Any
) -> None:
    await seed_history(logged_in, llm)
    other = await make_user("rui@x.pt")
    assert (await other.get(f"{C}/history")).json()["items"] == []
    assert (await logged_in.delete(f"{C}/data", params={"confirmation": "DELETE"})).status_code == 200
    left = (await logged_in.get(f"{C}/history", params={"limit": 100})).json()["items"]
    assert [(i["kind"], i["snippet"]) for i in left] == [
        ("action", "delete_my_copilot_data")
    ]  # só fica o registo da eliminação
