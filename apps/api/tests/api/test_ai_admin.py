"""Painel de IA: configuração por tarefa, validação de capacidades, catálogo, uso, orçamento, créditos e testes."""

from typing import Any

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.openrouter import OpenRouterClient
from novelo.ai.catalog import ModelCatalog
from novelo.ai.runtime import UsageEvent
from novelo.ai.tasks import AiTask
from novelo.core.config import get_settings
from novelo.core.errors import AiBudgetExceededError, UpstreamError
from novelo.features.ai_admin import service
from novelo.features.ai_admin.models import AiUsage
from novelo.features.ai_admin.schemas import AiSettingsUpdate, GlobalDefaults, TaskConfigIn
from novelo.features.users import service as auth_service
from tests.conftest import PASSWORD, FakeLlm

AI = "/api/v1/ai"


@pytest.fixture
async def admin(client: httpx.AsyncClient, session: AsyncSession) -> httpx.AsyncClient:
    await auth_service.create_user(session, email="admin@x.pt", password=PASSWORD, role="admin", email_verified=True)
    resp = await client.post("/api/v1/auth/login", json={"email": "admin@x.pt", "password": PASSWORD})
    assert resp.status_code == 200
    return client


def body(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {"defaults": {}, "monthly_budget_usd": None, "tasks": []}
    return {**base, **overrides}


async def test_only_admins_reach_the_panel(logged_in: httpx.AsyncClient) -> None:
    for path in ("settings", "models", "usage", "credits", "eval/triage"):
        assert (await logged_in.get(f"{AI}/{path}")).status_code == 403
    assert (await logged_in.put(f"{AI}/settings", json=body())).status_code == 403
    assert (await logged_in.post(f"{AI}/test", json={"model": "openai/gpt-6-luna"})).status_code == 403


async def test_settings_show_effective_model_and_its_origin_per_task(admin: httpx.AsyncClient) -> None:
    first = (await admin.get(f"{AI}/settings")).json()
    tasks = {t["task"]: t for t in first["tasks"]}
    assert set(tasks) == {"copilot", "whatif", "explain", "briefing", "alert_resolution", "copilot_aux", "triage"}
    assert tasks["triage"]["effective"]["model"] == get_settings().llm_model_vision
    assert tasks["triage"]["effective"]["model_source"] == "env" and tasks["triage"]["requirements"] == [
        "image",
        "structured_outputs",
    ]
    assert (
        tasks["copilot"]["effective"]["max_tokens_source"] == "code"
        and tasks["copilot"]["effective"]["reasoning_effort"] == "low"
    )

    update = body(
        defaults={"text_model": "acme/text-only", "max_output_tokens": 700, "fallback_model": "openai/gpt-6-luna"},
        tasks=[
            {"task": "copilot", "model": "openai/gpt-6-luna", "reasoning_effort": "medium"},
            {"task": "explain", "max_output_tokens": 200},
        ],
        monthly_budget_usd=25,
    )
    saved = await admin.put(f"{AI}/settings", json=update)
    assert saved.status_code == 200, saved.text
    out = {t["task"]: t["effective"] for t in saved.json()["tasks"]}
    assert (out["copilot"]["model"], out["copilot"]["model_source"]) == ("openai/gpt-6-luna", "database")
    assert (out["whatif"]["model"], out["whatif"]["model_source"]) == ("acme/text-only", "global_default")
    # o modelo de visão não herda o de texto
    assert (out["triage"]["model"], out["triage"]["model_source"]) == (get_settings().llm_model_vision, "env")
    assert (out["explain"]["max_output_tokens"], out["explain"]["max_tokens_source"]) == (200, "database")
    assert (out["whatif"]["max_output_tokens"], out["whatif"]["max_tokens_source"]) == (700, "global_default")
    assert out["copilot"]["reasoning_effort"] == "medium" and out["whatif"]["reasoning_source"] == "env"
    assert (
        out["whatif"]["fallback_model"] == "openai/gpt-6-luna" and out["whatif"]["fallback_source"] == "global_default"
    )
    assert saved.json()["budget"]["monthly_budget_usd"] == 25 and saved.json()["budget"]["state"] == "ok"

    cleared = (await admin.put(f"{AI}/settings", json=body())).json()  # nulo = volta a herdar
    assert {t["effective"]["model_source"] for t in cleared["tasks"]} == {"env"}


async def test_models_must_exist_and_support_what_the_task_needs(admin: httpx.AsyncClient) -> None:
    def put(**kw: Any) -> Any:
        return admin.put(f"{AI}/settings", json=body(**kw))

    unknown = await put(tasks=[{"task": "explain", "model": "nobody/nothing"}])
    assert unknown.status_code == 400 and "does not exist" in unknown.json()["message"]
    no_image = await put(tasks=[{"task": "triage", "model": "acme/text-only"}])
    assert no_image.status_code == 400 and "image" in no_image.json()["message"]
    no_tools = await put(tasks=[{"task": "copilot", "model": "acme/vision-no-tools"}])
    assert no_tools.status_code == 400 and "tools" in no_tools.json()["message"]
    # um modelo global de texto herdado pelo copiloto também tem de ter ferramentas
    assert (await put(defaults={"text_model": "acme/vision-no-tools"})).status_code == 400
    assert (await put(tasks=[{"task": "explain", "model": "acme/vision-no-tools"}])).status_code == 200
    assert (await put(tasks=[{"task": "test", "model": "acme/text-only"}])).status_code == 422
    assert (await put(tasks=[{"task": "explain"}, {"task": "explain"}])).status_code == 422


async def test_model_catalog_filters_by_task_and_estimates_cost_per_operation(admin: httpx.AsyncClient) -> None:
    triage = (await admin.get(f"{AI}/models", params={"task": "triage", "sort": "cost"})).json()
    ids = [m["id"] for m in triage["models"]]
    assert "acme/text-only" not in ids and "openai/gpt-6-luna" in ids  # visão exige imagem
    assert triage["operation"] == "per_item_sorted" and triage["recommended_model"] == "openai/gpt-6-luna"
    luna = next(m for m in triage["models"] if m["id"] == "openai/gpt-6-luna")
    assert luna["recommended"] is True and luna["cost_basis"] == "estimate" and luna["compatible"] is True
    assert luna["cost_per_operation_usd"] == pytest.approx((2200 * 0.1 + 250 * 0.5) / 1e6)
    assert (
        triage["models"][-1]["id"] == "typesafe/jev-router" and triage["models"][-1]["cost_per_operation_usd"] is None
    )
    assert triage["stale"] is False

    copilot = [m["id"] for m in (await admin.get(f"{AI}/models", params={"task": "copilot"})).json()["models"]]
    assert "acme/vision-no-tools" not in copilot and "acme/text-only" in copilot  # copiloto exige tools
    everything = (await admin.get(f"{AI}/models")).json()
    assert everything["total"] == 4 and everything["task"] is None
    images = (await admin.get(f"{AI}/models", params=[("capability", "image"), ("q", "acme")])).json()
    assert [m["id"] for m in images["models"]] == ["acme/vision-no-tools"]


async def test_measured_cost_replaces_the_estimate_once_there_is_history(
    admin: httpx.AsyncClient, session: AsyncSession
) -> None:
    for i, cost in enumerate((0.002, 0.004)):  # duas peças triadas (2 pedidos), a 2.ª com 2 chamadas
        session.add(AiUsage(task="triage", model="openai/gpt-6-luna", cost_usd=cost / (1 + i), cost_source="provider",
                            latency_ms=900, success=True, request_id=f"r{i}"))  # fmt: skip
        if i == 1:
            session.add(AiUsage(task="triage", model="openai/gpt-6-luna", cost_usd=cost / 2, cost_source="provider",
                                latency_ms=900, success=True, request_id="r1"))  # fmt: skip
    await session.commit()
    luna = next(
        m
        for m in (await admin.get(f"{AI}/models", params={"task": "triage"})).json()["models"]
        if m["id"] == "openai/gpt-6-luna"
    )
    assert luna["cost_basis"] == "measured" and luna["cost_samples"] == 2
    assert luna["cost_per_operation_usd"] == pytest.approx(0.003)  # média por pedido, somando as chamadas


async def test_usage_report_groups_by_day_task_and_model(admin: httpx.AsyncClient, session: AsyncSession) -> None:
    rows = [
        ("copilot", "m/a", 0.01, True),
        ("copilot", "m/a", 0.02, True),
        ("triage", "m/b", 0.005, True),
        ("triage", "m/b", None, False),
    ]
    for task, model, cost, ok in rows:
        session.add(AiUsage(task=task, model=model, cost_usd=cost, cost_source="provider" if cost else "unknown",
                            latency_ms=1000, success=ok, prompt_tokens=100, completion_tokens=10))  # fmt: skip
    await session.commit()
    usage = (await admin.get(f"{AI}/usage", params={"days": 7})).json()
    assert usage["totals"]["calls"] == 4 and usage["totals"]["errors"] == 1
    assert usage["totals"]["cost_usd"] == pytest.approx(0.035) and usage["month"]["spent_usd"] == pytest.approx(0.035)
    by_task = {g["task"]: g for g in usage["by_task"]}
    assert by_task["copilot"]["calls"] == 2 and by_task["triage"]["errors"] == 1
    assert {g["model"] for g in usage["by_model"]} == {"m/a", "m/b"} and len(usage["by_task_model"]) == 2
    assert len(usage["by_day"]) == 1 and usage["by_day"][0]["calls"] == 4


async def test_credits_degrade_gracefully(
    admin: httpx.AsyncClient, llm: FakeLlm, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(service.get_settings(), "openrouter_api_key", "k")
    llm.account_data = {"limit": 10, "limit_remaining": 7.5, "usage": 2.5, "is_free_tier": False}
    ok = (await admin.get(f"{AI}/credits")).json()
    assert ok["available"] is True and ok["limit_remaining_usd"] == 7.5 and ok["key_usage_usd"] == 2.5
    llm.account_data = {}
    down = (await admin.get(f"{AI}/credits")).json()
    assert down["available"] is False and down["message"]


async def test_model_ping_reports_latency_and_cost_and_checks_capability(
    admin: httpx.AsyncClient, llm: FakeLlm
) -> None:
    ok = (await admin.post(f"{AI}/test", json={"model": "openai/gpt-6-luna", "task": "triage"})).json()
    assert (
        ok["ok"] is True and ok["latency_ms"] == 420 and ok["cost_usd"] == 0.000003 and ok["missing_capabilities"] == []
    )
    bad = (await admin.post(f"{AI}/test", json={"model": "acme/text-only", "task": "triage"})).json()
    assert bad["ok"] is False and bad["missing_capabilities"] == ["image"]
    gone = (await admin.post(f"{AI}/test", json={"model": "nobody/nothing", "task": "triage"})).json()
    assert gone["ok"] is False and "catalog" in gone["error"]
    llm.ping_error = UpstreamError("provider down")
    down = (await admin.post(f"{AI}/test", json={"model": "openai/gpt-6-luna"})).json()
    assert down["ok"] is False and down["error"] == "provider down"


async def test_runtime_resolves_budget_and_records_usage_without_content(
    session: AsyncSession, catalog: ModelCatalog
) -> None:
    user = await auth_service.create_user(session, email="u@x.pt", password=PASSWORD, role="admin", email_verified=True)
    body_ = AiSettingsUpdate(
        defaults=GlobalDefaults(),
        monthly_budget_usd=1.0,
        tasks=[TaskConfigIn(task=AiTask.TRIAGE, model="openai/gpt-6-luna", fallback_model="acme/vision-no-tools")],
    )
    await service.update_settings(session, body_, user, catalog)
    runtime = await service.build_runtime(session, user)
    triage = runtime.resolve(AiTask.TRIAGE)
    assert triage and triage.fallback_model == "acme/vision-no-tools" and runtime.budget_usd == 1.0
    assert runtime.sink is not None
    await runtime.sink(UsageEvent("triage", "openai/gpt-6-luna", 1000, 100, 0.9, "provider", 800, True, None, "a" * 64))
    runtime = await service.build_runtime(session, user)
    assert runtime.spent_usd == pytest.approx(0.9) and runtime.budget_state == "warning"
    assert runtime.sink is not None
    await runtime.sink(UsageEvent("triage", "openai/gpt-6-luna", 1000, 100, 0.2, "provider", 800, True, None, None))
    stopped = await service.build_runtime(session, user)
    with pytest.raises(AiBudgetExceededError):
        stopped.check_budget()
    client = OpenRouterClient(runtime=stopped)
    assert client.model_for("triage") == "openai/gpt-6-luna"
    stored = (await session.execute(select(AiUsage))).scalars().all()
    assert {c.name for c in AiUsage.__table__.columns}.isdisjoint(
        {"prompt", "response", "image", "content", "messages"}
    )
    assert len(stored) == 2 and stored[0].user_id == user.id


async def test_web_searches_are_recorded_and_counted_in_the_usage_report(
    admin: httpx.AsyncClient, session: AsyncSession
) -> None:
    from novelo.features.users.models import User  # noqa: PLC0415

    user = (await session.execute(select(User).where(User.email == "admin@x.pt"))).scalar_one()
    runtime = await service.build_runtime(session, user)
    assert runtime.sink is not None
    event = UsageEvent("web_search", "openai/gpt-6-luna", 900, 3, 0.0078, "provider", 1500, True, None, None, 2)
    await runtime.sink(event)
    usage = (await admin.get(f"{AI}/usage", params={"days": 7})).json()
    assert usage["totals"]["web_search_requests"] == 2 and usage["totals"]["cost_usd"] == pytest.approx(0.0078)
    by_task = {g["task"]: g for g in usage["by_task"]}
    assert by_task["web_search"]["web_search_requests"] == 2 and by_task["web_search"]["calls"] == 1
    assert (await session.execute(select(AiUsage.web_search_requests))).scalar_one() == 2
