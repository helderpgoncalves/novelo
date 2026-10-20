"""Streaming do OpenRouter (SSE): deltas, tool_calls, uso final, erros a meio, repetições e cancelamento."""

import asyncio
import json
from typing import Any

import httpx
import pytest

from novelo.adapters.openrouter import OpenRouterClient, RoundResult, TextPiece
from novelo.ai.runtime import AiRuntime, ResolvedTask, UsageEvent
from novelo.ai.tasks import AiTask
from novelo.core.config import Settings
from novelo.core.errors import UpstreamError


def chunk(delta: dict[str, Any], finish: str | None = None, **extra: Any) -> str:
    body = {"id": "gen-1", "choices": [{"index": 0, "delta": delta, "finish_reason": finish}], **extra}
    return f"data: {json.dumps(body)}\n\n"


def sse(*parts: str) -> bytes:
    return "".join(parts).encode()


class SlowStream(httpx.AsyncByteStream):
    """Resposta que só termina se o cliente a fechar: simula o fornecedor a gerar texto."""

    def __init__(self, first: bytes) -> None:
        self.first, self.closed = first, False

    async def __aiter__(self) -> Any:
        yield self.first
        await asyncio.sleep(30)
        yield b"data: [DONE]\n\n"

    async def aclose(self) -> None:
        self.closed = True


def client(handler: Any, **kw: Any) -> OpenRouterClient:
    return OpenRouterClient(
        Settings(OPENROUTER_API_KEY="k", LLM_RETRY_BACKOFF_S=0), transport=httpx.MockTransport(handler), **kw
    )


async def collect(c: OpenRouterClient, **kw: Any) -> list[Any]:
    out = []
    async for piece in c.stream_round(system="s", messages=[{"role": "user", "content": "olá"}], tools=[], **kw):
        out.append(piece)
    return out


async def test_text_deltas_comments_usage_and_request_shape() -> None:
    seen: list[dict[str, Any]] = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(json.loads(req.content))
        body = sse(
            ": OPENROUTER PROCESSING\n\n",
            chunk({"role": "assistant", "content": "Olá "}),
            chunk({"content": "mundo"}, finish="stop"),
            chunk({"content": ""}, finish="stop", usage={"prompt_tokens": 100, "completion_tokens": 7, "cost": 0.0003}),
            "data: [DONE]\n\n",
        )
        return httpx.Response(200, content=body)

    c = client(handler)
    pieces = await collect(c)
    texts = [p.text for p in pieces if isinstance(p, TextPiece)]
    done = pieces[-1]
    assert texts == ["Olá ", "mundo"] and isinstance(done, RoundResult)
    assert done.text == "Olá mundo" and done.finish_reason == "stop" and done.tool_calls == []
    assert done.usage is not None and done.usage.cost_usd == 0.0003 and done.usage.prompt_tokens == 100
    body = seen[0]
    assert (
        body["stream"] is True
        and body["stream_options"] == {"include_usage": True}
        and body["usage"] == {"include": True}
    )
    assert body["messages"][0] == {"role": "system", "content": "s"}


async def test_tool_call_fragments_are_assembled_by_index() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        body = sse(
            chunk(
                {
                    "tool_calls": [
                        {
                            "index": 0,
                            "id": "call_a",
                            "type": "function",
                            "function": {"name": "get_baseline", "arguments": ""},
                        }
                    ]
                }
            ),
            chunk(
                {
                    "tool_calls": [
                        {
                            "index": 1,
                            "id": "call_b",
                            "type": "function",
                            "function": {"name": "list_scenarios", "arguments": '{"lim'},
                        }
                    ]
                }
            ),
            chunk({"tool_calls": [{"index": 1, "function": {"arguments": 'it": 3}'}}]}),
            chunk({"tool_calls": [{"index": 0, "function": {"arguments": "{}"}}]}, finish="tool_calls"),
            "data: [DONE]\n\n",
        )
        return httpx.Response(200, content=body)

    done = (await collect(client(handler)))[-1]
    assert isinstance(done, RoundResult) and done.finish_reason == "tool_calls"
    assert [(t.id, t.name, t.arguments) for t in done.tool_calls] == [
        ("call_a", "get_baseline", "{}"),
        ("call_b", "list_scenarios", '{"limit": 3}'),
    ]


async def test_transient_status_is_retried_before_any_output_and_fallback_is_used() -> None:
    models: list[str] = []

    def handler(req: httpx.Request) -> httpx.Response:
        model = json.loads(req.content)["model"]
        models.append(model)
        if model == "m/primary":
            return httpx.Response(503)
        return httpx.Response(200, content=sse(chunk({"content": "da reserva"}, finish="stop"), "data: [DONE]\n\n"))

    resolved = ResolvedTask("m/primary", "database", "m/backup", "database", 300, "code", "low", "env")
    events: list[UsageEvent] = []

    async def sink(e: UsageEvent) -> None:
        events.append(e)

    c = client(handler, runtime=AiRuntime(tasks=dict.fromkeys(AiTask, resolved), sink=sink))
    done = (await collect(c))[-1]
    assert isinstance(done, RoundResult) and done.text == "da reserva" and done.model == "m/backup"
    assert models.count("m/primary") == 3 and models[-1] == "m/backup"  # 1 + 2 repetições, depois a reserva
    assert [(e.model, e.success) for e in events] == [("m/primary", False), ("m/backup", True)]


async def test_error_chunk_mid_stream_is_an_upstream_error_and_is_recorded() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        err = {
            "id": "x",
            "error": {"code": "server_error", "message": "boom"},
            "choices": [{"delta": {"content": ""}, "finish_reason": "error"}],
        }
        return httpx.Response(200, content=sse(chunk({"content": "parcial"}), f"data: {json.dumps(err)}\n\n"))

    c = client(handler)
    with pytest.raises(UpstreamError, match="mid-generation"):
        await collect(c)


async def test_closing_the_generator_cancels_the_request_and_records_partial_usage() -> None:
    stream = SlowStream(sse(chunk({"content": "Primeiro pedaço do texto"})).replace(b"\n\n", b"\n\n"))
    events: list[UsageEvent] = []

    async def sink(e: UsageEvent) -> None:
        events.append(e)

    resolved = ResolvedTask("m/x", "database", None, "env", 300, "code", "low", "env")
    c = client(
        lambda _: httpx.Response(200, stream=stream),
        runtime=AiRuntime(tasks=dict.fromkeys(AiTask, resolved), sink=sink),
    )
    gen = c.stream_round(system="s", messages=[], tools=[])
    first = await gen.__anext__()
    assert isinstance(first, TextPiece) and first.text.startswith("Primeiro")
    await gen.aclose()  # o cliente do copiloto desligou
    await asyncio.sleep(0)
    assert stream.closed is True  # a ligação ao fornecedor foi fechada (pára o modelo)
    assert [(e.success, e.error_code) for e in events] == [(False, "cancelled")]
    assert events[0].completion_tokens and events[0].completion_tokens >= 1


async def test_reasoning_deltas_are_not_forwarded_as_text() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            content=sse(
                chunk({"reasoning": "a pensar..."}), chunk({"content": "ok"}, finish="stop"), "data: [DONE]\n\n"
            ),
        )

    pieces = await collect(client(handler))
    assert [type(p).__name__ for p in pieces] == ["ReasoningPiece", "TextPiece", "RoundResult"]
