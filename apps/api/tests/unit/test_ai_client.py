"""Cliente do OpenRouter: tool calling, limites, repetições, reserva, orçamento, uso e cache. Sem rede."""

import json
import logging
from typing import Any

import httpx
import pytest
from pydantic import BaseModel

from novelo.adapters.openrouter import OpenRouterClient, ToolSpec
from novelo.ai.cache import response_cache
from novelo.ai.runtime import AiRuntime, ResolvedTask, UsageEvent
from novelo.ai.tasks import AiTask
from novelo.core.config import Settings
from novelo.core.errors import AiBudgetExceededError, UpstreamError

SECRET = "sk-or-super-secret-key"


class Out(BaseModel):
    text: str


def settings(**kw: Any) -> Settings:
    return Settings(OPENROUTER_API_KEY=SECRET, LLM_RETRY_BACKOFF_S=0, **kw)


def reply(message: dict[str, Any], usage: dict[str, Any] | None = None) -> httpx.Response:
    body: dict[str, Any] = {"choices": [{"message": message}]}
    if usage is not None:
        body["usage"] = usage
    return httpx.Response(200, json=body)


def tool_call(name: str, args: dict[str, Any], call_id: str = "c1") -> dict[str, Any]:
    return {"id": call_id, "type": "function", "function": {"name": name, "arguments": json.dumps(args)}}


TOOLS = [ToolSpec(name="get_baseline", description="x", parameters={"type": "object", "properties": {}})]


def resolved(model: str = "m/primary", fallback: str | None = None) -> ResolvedTask:
    return ResolvedTask(model, "database", fallback, "env", 300, "database", "low", "env")


def runtime(sink: list[UsageEvent], **kw: Any) -> AiRuntime:
    async def record(event: UsageEvent) -> None:
        sink.append(event)

    task_kw = kw.pop("task_kw", {})
    tasks = {t: resolved(**task_kw) for t in AiTask}
    return AiRuntime(tasks=tasks, sink=record, **kw)


async def test_tool_loop_executes_tools_and_sends_openai_format() -> None:
    sent: list[dict[str, Any]] = []

    def handler(req: httpx.Request) -> httpx.Response:
        body = json.loads(req.content)
        sent.append(body)
        if len(sent) == 1:
            return reply({"role": "assistant", "content": None, "tool_calls": [tool_call("get_baseline", {})]})
        return reply({"role": "assistant", "content": " Recolheram-se 301,3 t. "})

    seen: list[tuple[str, str]] = []

    async def execute(name: str, args: str) -> Any:
        seen.append((name, args))
        return {"collected_t": 301.3}

    client = OpenRouterClient(settings(), transport=httpx.MockTransport(handler))
    res = await client.chat(system="sys", messages=[{"role": "user", "content": "olá"}], tools=TOOLS, execute=execute)
    assert res.text == "Recolheram-se 301,3 t." and res.iterations == 2 and seen == [("get_baseline", "{}")]
    first, second = sent
    assert first["tools"][0]["type"] == "function" and first["tool_choice"] == "auto" and first["temperature"] == 0
    assert first["messages"][0] == {"role": "system", "content": "sys"}  # prompt estável primeiro
    tool_msg = second["messages"][-1]
    assert tool_msg["role"] == "tool" and tool_msg["tool_call_id"] == "c1" and "301.3" in tool_msg["content"]


async def test_iteration_limit_disables_tools_on_the_last_round() -> None:
    choices: list[str] = []

    def handler(req: httpx.Request) -> httpx.Response:
        body = json.loads(req.content)
        choices.append(body["tool_choice"])
        if body["tool_choice"] == "none":
            return reply({"role": "assistant", "content": "Resposta final."})
        return reply({"role": "assistant", "content": None, "tool_calls": [tool_call("get_baseline", {})]})

    async def execute(_: str, __: str) -> Any:
        return {}

    client = OpenRouterClient(settings(), transport=httpx.MockTransport(handler))
    res = await client.chat(system="s", messages=[], tools=TOOLS, execute=execute, max_iterations=99)
    assert res.iterations == 6 and choices == ["auto"] * 5 + ["none"]  # nunca mais de 6 voltas


async def test_model_that_ignores_tool_choice_none_is_an_error() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return reply({"role": "assistant", "content": None, "tool_calls": [tool_call("get_baseline", {})]})

    async def execute(_: str, __: str) -> Any:
        return {}

    client = OpenRouterClient(settings(), transport=httpx.MockTransport(handler))
    with pytest.raises(UpstreamError):
        await client.chat(system="s", messages=[], tools=TOOLS, execute=execute, max_iterations=2)


async def test_transient_errors_are_retried_with_a_bound_and_hard_errors_are_not() -> None:
    calls = 0

    def flaky(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(503) if calls < 3 else reply({"content": json.dumps({"text": "ok"})})

    client = OpenRouterClient(settings(), transport=httpx.MockTransport(flaky))
    assert (await client.structured(system="s", user="u", schema=Out)).text == "ok" and calls == 3

    calls = 0
    always_down = OpenRouterClient(settings(), transport=httpx.MockTransport(lambda _: _count(503)))
    with pytest.raises(UpstreamError):
        await always_down.structured(system="s", user="u", schema=Out)

    hard = OpenRouterClient(settings(), transport=httpx.MockTransport(lambda _: httpx.Response(401)))
    with pytest.raises(UpstreamError, match="401"):
        await hard.structured(system="s", user="u", schema=Out)


def _count(status: int) -> httpx.Response:
    return httpx.Response(status)


async def test_timeouts_are_retried_then_reported() -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        raise httpx.ReadTimeout("slow")

    client = OpenRouterClient(settings(), transport=httpx.MockTransport(handler))
    with pytest.raises(UpstreamError, match="timeout"):
        await client.structured(system="s", user="u", schema=Out)
    assert calls == 3  # 1 + LLM_MAX_RETRIES (2)


async def test_fallback_model_answers_when_the_primary_is_down() -> None:
    models: list[str] = []

    def handler(req: httpx.Request) -> httpx.Response:
        model = json.loads(req.content)["model"]
        models.append(model)
        return httpx.Response(502) if model == "m/primary" else reply({"content": json.dumps({"text": "da reserva"})})

    events: list[UsageEvent] = []
    rt = runtime(events, task_kw={"fallback": "m/backup"})
    client = OpenRouterClient(settings(), transport=httpx.MockTransport(handler), runtime=rt)
    out = await client.structured(system="s", user="u", schema=Out, task="explain")
    assert out.text == "da reserva" and models[-1] == "m/backup" and models[0] == "m/primary"
    assert [(e.model, e.success) for e in events] == [("m/primary", False), ("m/backup", True)]


async def test_usage_cost_comes_from_the_provider_or_the_catalog_and_never_stores_content() -> None:
    def handler(req: httpx.Request) -> httpx.Response:
        usage = {"prompt_tokens": 1000, "completion_tokens": 100, "cost": 0.00042}
        if json.loads(req.content)["messages"][-1]["content"] == "sem custo":
            usage = {"prompt_tokens": 1000, "completion_tokens": 100}
        return reply({"content": json.dumps({"text": "resposta secreta"})}, usage)

    events: list[UsageEvent] = []
    rt = runtime(events, price_of=lambda m: (1e-7, 5e-7))
    client = OpenRouterClient(settings(), transport=httpx.MockTransport(handler), runtime=rt)
    await client.structured(system="s", user="com custo", schema=Out, task="briefing")
    await client.structured(system="s", user="sem custo", schema=Out, task="briefing")
    a, b = events
    assert (a.cost_usd, a.cost_source) == (0.00042, "provider")
    assert b.cost_source == "catalog" and b.cost_usd == pytest.approx(1000 * 1e-7 + 100 * 5e-7)
    assert a.task == "briefing" and a.input_hash and len(a.input_hash) == 64
    assert "secreta" not in repr(events) and "com custo" not in repr(events)  # nada de prompts nem respostas
    assert rt.spent_usd == pytest.approx(a.cost_usd + b.cost_usd)


async def test_budget_is_a_hard_stop_before_any_network_call() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        raise AssertionError("não devia haver chamada")

    rt = runtime([], budget_usd=1.0, spent_usd=1.0)
    client = OpenRouterClient(settings(), transport=httpx.MockTransport(handler), runtime=rt)
    with pytest.raises(AiBudgetExceededError):
        await client.structured(system="s", user="u", schema=Out, task="explain")
    assert rt.budget_state == "exceeded"
    assert AiRuntime(tasks={}, budget_usd=10, spent_usd=8.5).budget_state == "warning"
    assert AiRuntime(tasks={}, budget_usd=10, spent_usd=1).budget_state == "ok"
    assert AiRuntime(tasks={}).budget_state == "unlimited"


async def test_payload_has_max_tokens_reasoning_strict_schema_and_task_model() -> None:
    bodies: list[dict[str, Any]] = []

    def handler(req: httpx.Request) -> httpx.Response:
        bodies.append(json.loads(req.content))
        return reply({"content": json.dumps({"text": "ok"})})

    rt = runtime([], task_kw={"model": "m/vision"})
    client = OpenRouterClient(settings(), transport=httpx.MockTransport(handler), runtime=rt)
    await client.structured(system="s", user="u", schema=Out, task="triage")
    body = bodies[0]
    assert body["model"] == "m/vision" and body["max_tokens"] == 300 and body["reasoning"] == {"effort": "low"}
    assert body["response_format"]["json_schema"]["strict"] is True and body["usage"] == {"include": True}
    assert client.model_for("triage") == "m/vision"


async def test_identical_whatif_and_explain_requests_hit_the_cache() -> None:
    class ScenarioDelta(BaseModel):  # o nome do schema decide a tarefa (e a cache)
        text: str

    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return reply({"content": json.dumps({"text": "x"})})

    response_cache.clear()
    client = OpenRouterClient(settings(), transport=httpx.MockTransport(handler))
    for _ in range(3):
        await client.structured(system="s", user="mesma pergunta", schema=ScenarioDelta)
    await client.structured(system="s", user="outra pergunta", schema=ScenarioDelta)
    assert calls == 2
    response_cache.clear()


async def test_logs_never_contain_the_api_key_or_prompts(caplog: pytest.LogCaptureFixture) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(503)

    caplog.set_level(logging.DEBUG)
    client = OpenRouterClient(settings(), transport=httpx.MockTransport(handler))
    with pytest.raises(UpstreamError):
        await client.structured(system="PROMPT-SECRETO", user="PERGUNTA-PRIVADA", schema=Out)
    logs = caplog.text
    assert SECRET not in logs and "PROMPT-SECRETO" not in logs and "PERGUNTA-PRIVADA" not in logs
    assert "llm call failed" in logs


async def test_ping_returns_latency_and_cost() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return reply({"content": "ok"}, {"prompt_tokens": 12, "completion_tokens": 1, "cost": 0.000002})

    call = await OpenRouterClient(settings(), transport=httpx.MockTransport(handler)).ping("m/x")
    assert call.model == "m/x" and call.cost_usd == 0.000002 and call.latency_s >= 0


async def test_account_exposes_only_whitelisted_fields() -> None:
    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith("/key"):
            return httpx.Response(200, json={"data": {"label": "sk-or-v1-abc...xyz", "limit": 10, "usage": 2.5}})
        return httpx.Response(404)

    data = await OpenRouterClient(settings(), transport=httpx.MockTransport(handler)).account()
    assert data == {"limit": 10, "usage": 2.5}


def test_clean_title_accepts_short_creative_titles_only() -> None:
    from novelo.features.copilot.aux import clean_title  # noqa: PLC0415

    assert clean_title(" «fio da meada em Azurém.» ") == "Fio da meada em Azurém"
    assert clean_title("Rede de 2025") is None  # números
    assert clean_title("Palavra") is None  # curto demais
    assert clean_title("um dois três quatro cinco seis sete oito nove") is None  # longo demais
    assert clean_title("x" * 70 + " y") is None
    assert clean_title("") is None


async def test_aux_tasks_route_by_latency_and_main_tasks_do_not() -> None:
    bodies: list[dict[str, Any]] = []

    def handler(req: httpx.Request) -> httpx.Response:
        bodies.append(json.loads(req.content))
        return reply({"content": json.dumps({"text": "ok"})})

    client = OpenRouterClient(settings(), transport=httpx.MockTransport(handler))
    await client.structured(system="s", user="u", schema=Out, task="copilot_aux")
    await client.structured(system="s", user="u", schema=Out, task="triage")
    assert bodies[0]["provider"] == {"sort": "latency"} and "provider" not in bodies[1]
    off = OpenRouterClient(settings(LLM_AUX_PROVIDER_SORT=""), transport=httpx.MockTransport(handler))
    await off.structured(system="s", user="u", schema=Out, task="copilot_aux")
    assert "provider" not in bodies[2]


async def test_only_anthropic_models_get_explicit_cache_control_on_the_system_prompt() -> None:
    bodies: list[dict[str, Any]] = []

    def handler(req: httpx.Request) -> httpx.Response:
        bodies.append(json.loads(req.content))
        return reply({"content": json.dumps({"text": "ok"})})

    client = OpenRouterClient(settings(), transport=httpx.MockTransport(handler))
    await client.structured(system="SYS", user="u", schema=Out, task="explain", model="anthropic/claude-x")
    await client.structured(system="SYS", user="u", schema=Out, task="explain", model="openai/gpt-x")
    cached = bodies[0]["messages"][0]
    assert cached["content"] == [{"type": "text", "text": "SYS", "cache_control": {"type": "ephemeral"}}]
    assert bodies[1]["messages"][0] == {"role": "system", "content": "SYS"}


async def test_clients_share_one_connection_pool_that_survives_client_close() -> None:
    a, b = OpenRouterClient(settings()), OpenRouterClient(settings())
    ta, tb = a._http._transport, b._http._transport
    assert ta is tb
    await a.aclose()
    assert b._http._transport is tb and not b._http.is_closed
    await b.aclose()
