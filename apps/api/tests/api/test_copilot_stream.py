"""Streaming do copiloto: eventos tipados, ferramentas, verificação com retract, cancelamento, compactação, orçamento."""

import asyncio
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.ai.catalog import ModelCatalog
from novelo.core.config import get_settings
from novelo.core.errors import AiBudgetExceededError
from novelo.features.copilot import router as copilot_router
from novelo.features.copilot.agent import PreparedTurn, stream_turn
from novelo.features.copilot.models import CopilotMessage, CopilotThread
from novelo.features.users.models import User
from tests.conftest import FakeLlm, stream_deps_for
from tests.sse import parse_sse, stream, text_of, types

S = "/api/v1/copilot/stream"
T = "/api/v1/copilot/threads"


def stream_calls(llm: FakeLlm) -> list[dict[str, Any]]:
    return [c for c in llm.calls if c["schema"] == "stream"]


def body(message: str = "Quanto recolhemos?", **extra: Any) -> dict[str, Any]:
    return {"message": message, "locale": "pt-PT", **extra}


async def test_full_turn_emits_typed_events_and_persists_the_thread(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    llm.queue_rounds(
        {"tools": [("get_baseline", {})]},
        {"text": ["Recolheram-se ", "301,3 t em 2025, ", "cerca de 23% do potencial."]},
    )
    resp = await logged_in.post(S, json=body())
    assert resp.headers["x-accel-buffering"] == "no" and "no-cache" in resp.headers["cache-control"]
    events = parse_sse(resp.text)
    kinds = types(events)
    assert kinds[0] == "start" and kinds[-1] == "done"
    for needed in (
        "status",
        "tool_start",
        "tool_result",
        "text_delta",
        "verification",
        "suggestions",
        "usage",
        "context",
        "title",
    ):
        assert needed in kinds, needed
    assert (
        kinds.index("tool_start") < kinds.index("tool_result") < kinds.index("text_delta") < kinds.index("verification")
    )
    start = events[0]
    assert start["model"] == "fake/model" and start["prompt_version"] == "v3"
    status = [e for e in events if e["type"] == "status"]
    assert {"thinking", "tool", "writing", "verifying"} <= {e["phase"] for e in status}
    assert any(e["label_key"] == "status.reading_baseline" for e in status)
    result = next(e for e in events if e["type"] == "tool_result")
    assert result["ok"] is True and result["name"] == "get_baseline" and "301" in result["summary"]
    assert next(e for e in events if e["type"] == "verification") == {
        "type": "verification",
        "verified": True,
        "warning": None,
        "external_numbers": [],
    }
    assert text_of(events) == "Recolheram-se 301,3 t em 2025, cerca de 23% do potencial."
    usage = next(e for e in events if e["type"] == "usage")
    assert usage["tokens"] == 2 * 1050 and usage["cost_usd"] == pytest.approx(0.0008)
    assert (
        next(e for e in events if e["type"] == "title")["title"] == "Quanto recolhemos?"
    )  # título = primeira mensagem

    thread = (await logged_in.get(f"{T}/{start['thread_id']}")).json()
    assert [m["role"] for m in thread["messages"]] == ["user", "assistant"] and thread["title"] == "Quanto recolhemos?"
    assert thread["messages"][1]["verified"] is True and thread["messages"][1]["tools"][0]["name"] == "get_baseline"
    assert thread["messages"][1]["id"] == start["message_id"] and thread["used_tokens"] > 0


async def test_parallel_tool_calls_run_and_stream_each_result(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    llm.queue_rounds(
        {"tools": [("get_baseline", {}), ("list_scenarios", {"limit": 3})]},
        {"text": ["Tenho a recolha de 2025: 301,3 t."]},
    )
    events = await stream(logged_in, S, body())
    starts = [e for e in events if e["type"] == "tool_start"]
    results = [e for e in events if e["type"] == "tool_result"]
    assert [e["name"] for e in starts] == ["get_baseline", "list_scenarios"] == [e["name"] for e in results]
    assert len({e["id"] for e in starts}) == 2 and all(e["ok"] for e in results)


async def test_numbers_that_fail_verification_after_streaming_are_retracted_and_rewritten(
    logged_in: httpx.AsyncClient, llm: FakeLlm
) -> None:
    llm.queue_rounds(
        {"tools": [("get_baseline", {})]},
        {"text": ["Recolheram-se 999 t."]},  # já foi transmitido ao ecrã...
        {"text": ["Recolheram-se 301,3 t."]},  # ...e é reescrito depois do retract
    )
    events = await stream(logged_in, S, body())
    kinds = types(events)
    assert kinds.count("retract") == 1
    assert kinds.index("retract") > kinds.index("text_delta")
    assert text_of(events) == "Recolheram-se 301,3 t."
    assert [e for e in events if e["type"] == "verification"][-1]["verified"] is True
    sent = stream_calls(llm)[-1]["user"]
    assert any(m["role"] == "user" and "999" in str(m["content"]) for m in sent)  # o modelo sabe que números falharam


async def test_second_failure_ends_with_a_warning_and_no_unverified_numbers(
    logged_in: httpx.AsyncClient, llm: FakeLlm
) -> None:
    llm.queue_rounds(
        {"tools": [("get_baseline", {})]},
        {"text": ["Recolheram-se 999 t."]},
        {"text": ["Foram 888 t."]},
    )
    events = await stream(logged_in, S, body())
    assert types(events).count("retract") == 2
    verification = [e for e in events if e["type"] == "verification"][-1]
    assert verification["verified"] is False and verification["warning"] == "numbers_unverified"
    final = text_of(events)
    assert "999" not in final and "888" not in final and "números" in final
    assert "suggestions" not in types(events)  # sem sugestões sobre uma resposta não verificada
    thread = (await logged_in.get(f"{T}/{events[0]['thread_id']}")).json()
    assert thread["messages"][-1]["verified"] is False


async def test_tool_errors_do_not_break_the_stream(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    llm.queue_rounds(
        {"tools": [("run_scenario", {"label": "x", "objective": "max_tonnes"}), ("no_such_tool", {})]},
        {"text": ["Preciso do orçamento anual para simular."]},
    )
    events = await stream(logged_in, S, body("Simula"))
    results = [e for e in events if e["type"] == "tool_result"]
    assert [r["ok"] for r in results] == [False, False] and "card" not in types(events)
    assert text_of(events).startswith("Preciso do orçamento")


async def test_scenario_creation_streams_a_card(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    args = {"label": "Teste", "objective": "max_tonnes", "budget_eur_year": 60000}
    llm.queue_rounds(
        {"tools": [("run_scenario", args)]}, {"text": ["Criei o cenário com 60 000 € por ano (estimativa)."]}
    )
    events = await stream(logged_in, S, body("Simula 60 mil euros"))
    card = next(e for e in events if e["type"] == "card")["card"]
    assert card["created_now"] is True and card["label"].startswith("Copilot · ")
    assert any(e["label_key"] == "status.running_optimizer" for e in events if e["type"] == "status")
    assert types(events).index("tool_result") < types(events).index("card")


async def test_client_disconnect_cancels_the_model_and_keeps_the_partial_answer(
    logged_in: httpx.AsyncClient, llm: FakeLlm, session: AsyncSession, catalog: ModelCatalog
) -> None:
    llm.queue_rounds({"text": ["Primeiro ", "pedaço ", "segundo ", "terceiro"], "delay": 0.05})
    user = (await session.execute(select(User))).scalars().one()
    gen = stream_turn(
        stream_deps_for(session, llm, catalog), user.id, PreparedTurn(user_text="Olá", locale="pt-PT", thread_id=None)
    )
    seen = []
    async for ev in gen:
        seen.append(ev.type)
        if ev.type == "text_delta":
            break
    await gen.aclose()  # o cliente desligou
    messages = list((await session.execute(select(CopilotMessage).order_by(CopilotMessage.created_at))).scalars())
    assert [m.role for m in messages] == ["user", "assistant"]
    assistant = messages[1]
    assert assistant.status == "cancelled" and assistant.parts[0]["text"].startswith("Primeiro")
    assert "terceiro" not in assistant.parts[0]["text"] and "done" not in seen


async def test_budget_exhausted_before_streaming_is_a_normal_503(
    logged_in: httpx.AsyncClient, llm: FakeLlm, session: AsyncSession, catalog: ModelCatalog
) -> None:
    deps = stream_deps_for(session, llm, catalog)

    async def over_budget(*_: object) -> None:
        raise AiBudgetExceededError("The monthly AI budget has been reached")

    deps.precheck = over_budget
    app = logged_in._transport.app  # type: ignore[attr-defined]
    app.dependency_overrides[copilot_router.get_stream_deps] = lambda: deps
    resp = await logged_in.post(S, json=body())
    assert resp.status_code == 503 and resp.json()["code"] == "ai_budget_exceeded"
    assert (await session.execute(select(CopilotThread))).first() is None  # nada foi criado


async def test_errors_mid_stream_become_typed_error_events(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    llm.queue_rounds(AiBudgetExceededError("The monthly AI budget has been reached"))
    events = await stream(logged_in, S, body())
    assert events[-2] == {
        "type": "error",
        "code": "ai_budget_exceeded",
        "message": "The monthly AI budget has been reached",
    }
    assert events[-1] == {"type": "done", "finish": "error"}
    thread = (await logged_in.get(f"{T}/{events[0]['thread_id']}")).json()
    assert thread["messages"][-1]["status"] == "error"


async def test_context_is_compacted_past_65_percent_of_the_window(
    logged_in: httpx.AsyncClient, llm: FakeLlm, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "copilot_context_cap_tokens", 4000)
    user = (await session.execute(select(User))).scalars().one()
    thread = CopilotThread(user_id=user.id, title="Longa", summary="", summarized_messages=0)
    session.add(thread)
    await session.flush()
    base = datetime.now(UTC) - timedelta(hours=1)
    for i in range(12):
        role = "user" if i % 2 == 0 else "assistant"
        digest = {"tool": "run_scenario", "scenario_id": str(uuid.uuid4()), "label": f"S{i}"}
        session.add(CopilotMessage(created_at=base + timedelta(seconds=i), thread_id=thread.id, role=role, parts=[{"type": "text", "text": f"mensagem {i} " + "x" * 700}],
                                   tool_trace=[{"name": "run_scenario", "ok": True, "summary": "s", "digest": digest, "result": {"big": "y" * 500}}] if role == "assistant" else []))  # fmt: skip
    await session.commit()
    llm.queue_rounds({"text": ["Continuo a conversa."]})
    events = await stream(logged_in, S, body("E agora?", thread_id=str(thread.id)))
    kinds = types(events)
    assert "compacting" in [e["phase"] for e in events if e["type"] == "status"]
    first_context = next(e for e in events if e["type"] == "context")
    assert first_context["compacted"] is True and first_context["window_tokens"] == 4000
    assert kinds.index("context") < kinds.index("text_delta")
    await session.refresh(thread)
    assert thread.summary and thread.summarized_messages >= 4
    old = (
        (
            await session.execute(
                select(CopilotMessage).where(CopilotMessage.thread_id == thread.id).order_by(CopilotMessage.created_at)
            )
        )
        .scalars()
        .all()
    )
    assert (
        old[1].digested is True and "result" not in old[1].tool_trace[0] and old[-3].digested is False
    )  # as recentes ficam intactas
    sent = stream_calls(llm)[-1]["user"]
    history = [m for m in sent if not str(m["content"]).startswith("[context]")]
    assert not any("mensagem 0 " in str(m["content"]) for m in history)  # type: ignore[union-attr]
    context = next(m for m in sent if str(m["content"]).startswith("[context]"))
    assert thread.summary in str(context["content"])  # o memo segue no bloco [context]


async def test_compact_command_summarises_without_calling_the_model_for_an_answer(
    logged_in: httpx.AsyncClient, llm: FakeLlm
) -> None:
    llm.queue_rounds(
        {"text": ["Primeira resposta sem números."]},
        {"text": ["Segunda resposta sem números."]},
        {"text": ["Terceira."]},
    )
    first = await stream(logged_in, S, body("Olá"))
    tid = first[0]["thread_id"]
    for q in ("Mais uma", "E outra"):
        await stream(logged_in, S, body(q, thread_id=tid))
    done = await stream(logged_in, S, body("/compact", thread_id=tid))
    assert "compacting" in [e["phase"] for e in done if e["type"] == "status"]
    assert "compactada" in text_of(done)
    assert next(e for e in done if e["type"] == "context")["compacted"] is True
    assert not llm.stream_script  # nenhuma volta do modelo foi gasta pelo comando
    thread = (await logged_in.get(f"{T}/{tid}")).json()
    assert thread["has_summary"] is True and thread["summary"]


async def test_regenerate_replaces_the_last_answer(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    llm.queue_rounds({"text": ["Resposta antiga."]}, {"text": ["Resposta nova."]})
    first = await stream(logged_in, S, body("Olá"))
    tid = first[0]["thread_id"]
    events = await stream(logged_in, f"{T}/{tid}/regenerate")
    assert text_of(events) == "Resposta nova."
    thread = (await logged_in.get(f"{T}/{tid}")).json()
    assert [(m["role"], m["text"]) for m in thread["messages"]] == [("user", "Olá"), ("assistant", "Resposta nova.")]


async def test_rate_limit_applies_to_the_stream(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    llm.queue_rounds(*[{"text": ["Ok."]}] * 14)
    codes = [(await logged_in.post(S, json=body("Olá"))).status_code for _ in range(13)]
    assert codes[0] == 200 and 429 in codes


async def test_sse_sends_heartbeats_while_the_model_is_silent(monkeypatch: pytest.MonkeyPatch) -> None:
    from novelo.features.copilot.schemas import CopilotDoneEvent, CopilotStatusEvent  # noqa: PLC0415

    monkeypatch.setattr(copilot_router, "HEARTBEAT_S", 0.05)

    async def slow() -> Any:
        yield CopilotStatusEvent(phase="thinking", label_key="status.thinking")
        await asyncio.sleep(0.2)
        yield CopilotDoneEvent()

    chunks = [c async for c in copilot_router.sse(slow())]
    assert chunks[0].startswith(b"event: status") and chunks[-1].startswith(b"event: done")
    assert b": ping\n\n" in chunks


async def test_event_schema_documents_every_event_and_the_openapi_has_the_union(logged_in: httpx.AsyncClient) -> None:
    catalog = (await logged_in.get("/api/v1/copilot/event-schema")).json()
    assert {e["type"] for e in catalog["events"]} == {
        "start", "status", "tool_start", "tool_result", "text_delta", "card", "retract", "verification",
        "suggestions", "context", "usage", "title", "error", "done", "memory", "plan", "clarify", "sources", "artifact",
        "confirm", "action_result", "navigate", "web_search",
    }  # fmt: skip
    spec = logged_in._transport.app.openapi()  # type: ignore[attr-defined]
    union = spec["components"]["schemas"]["CopilotEventMessage"]
    assert union["discriminator"]["propertyName"] == "type" and len(union["discriminator"]["mapping"]) == 23
    ok = spec["paths"]["/api/v1/copilot/stream"]["post"]["responses"]["200"]["content"]
    assert ok["text/event-stream"]["schema"]["$ref"].endswith("/CopilotEventMessage")
    assert spec["paths"]["/api/v1/copilot/stream"]["post"]["operationId"] == "copilot_stream"


# --- título criativo da conversa (modelo barato, em paralelo com a resposta) ---------------------------


class _Title:
    def __init__(self, title: str) -> None:
        self.title = title


async def _run_turn(session: AsyncSession, llm: FakeLlm, catalog: ModelCatalog, text: str) -> list[Any]:
    user = (await session.execute(select(User))).scalars().one()
    deps = stream_deps_for(session, llm, catalog)
    return [ev async for ev in stream_turn(deps, user.id, PreparedTurn(user_text=text, locale="pt-PT", thread_id=None))]


async def test_creative_title_replaces_the_provisional_one(
    logged_in: httpx.AsyncClient, llm: FakeLlm, session: AsyncSession, catalog: ModelCatalog
) -> None:
    llm.queue_rounds({"text": ["Olá."]})
    llm.queue("_ThreadTitle", _Title("  «Fio da meada em Azurém.»  "))
    events = await _run_turn(session, llm, catalog, "Quanto recolhemos em Azurém?")
    titles = [e.title for e in events if e.type == "title"]
    assert titles == ["Quanto recolhemos em Azurém?", "Fio da meada em Azurém"]
    kinds = [e.type for e in events]
    assert kinds.index("text_delta") < len(kinds) - 1 and kinds[-1] == "done"
    thread = (await session.execute(select(CopilotThread))).scalars().one()
    assert thread.title == "Fio da meada em Azurém" and thread.search_text == "fio da meada em azurem"
    call = next(c for c in llm.calls if c["schema"] == "_ThreadTitle")
    assert "Azurém" in str(call["user"]) and "assistant" not in str(call["user"])  # só a primeira mensagem


@pytest.mark.parametrize(
    "outcome", [RuntimeError("boom"), AiBudgetExceededError("budget"), _Title("Título com 2025"), _Title("Um")]
)
async def test_title_failure_or_bad_title_keeps_the_provisional_one(
    logged_in: httpx.AsyncClient, llm: FakeLlm, session: AsyncSession, catalog: ModelCatalog, outcome: object
) -> None:
    llm.queue_rounds({"text": ["Olá."]})
    llm.queue("_ThreadTitle", outcome)
    events = await _run_turn(session, llm, catalog, "Quanto recolhemos?")
    assert [e.title for e in events if e.type == "title"] == ["Quanto recolhemos?"]
    assert events[-1].type == "done" and not any(e.type == "error" for e in events)
    assert (await session.execute(select(CopilotThread.title))).scalar_one() == "Quanto recolhemos?"


async def test_title_does_not_overwrite_a_user_rename(
    logged_in: httpx.AsyncClient, session: AsyncSession, catalog: ModelCatalog
) -> None:
    class Renaming(FakeLlm):
        async def structured(self, **kw: Any) -> object:
            await asyncio.sleep(0.05)  # o título chega depois de o utilizador renomear
            return await super().structured(**kw)

        async def stream_round(self, **kw: Any) -> Any:
            await session.execute(update(CopilotThread).values(title="O meu nome"))
            await session.commit()
            async for piece in super().stream_round(**kw):
                yield piece

    llm = Renaming()
    llm.queue_rounds({"text": ["Olá."]})
    llm.queue("_ThreadTitle", _Title("Novelo de Creixomil"))
    events = await _run_turn(session, llm, catalog, "E se Creixomil passar a pedido?")
    assert [e.title for e in events if e.type == "title"] == ["E se Creixomil passar a pedido?"]
    assert (await session.execute(select(CopilotThread.title))).scalar_one() == "O meu nome"


async def test_title_does_not_delay_the_first_token(
    logged_in: httpx.AsyncClient, session: AsyncSession, catalog: ModelCatalog
) -> None:
    class Slow(FakeLlm):
        async def structured(self, **kw: Any) -> object:
            await asyncio.sleep(30)  # nunca chega a tempo
            return await super().structured(**kw)

    llm = Slow()
    llm.queue_rounds({"text": ["Olá."]})
    user = (await session.execute(select(User))).scalars().one()
    gen = stream_turn(
        stream_deps_for(session, llm, catalog), user.id, PreparedTurn(user_text="Olá", locale="pt-PT", thread_id=None)
    )
    async for ev in gen:
        if ev.type == "text_delta":
            break
    await gen.aclose()  # primeiro token sem esperar pelo título; a tarefa é cancelada sem fugas
    await asyncio.sleep(0)
    assert not [t for t in asyncio.all_tasks() if "make_title" in repr(t)]
