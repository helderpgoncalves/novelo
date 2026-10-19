"""Gestão de IA: configuração por tarefa (a base de dados manda), orçamento, uso, catálogo e testes de modelo."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import Integer, String, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.openrouter import OpenRouterClient
from novelo.ai.catalog import CatalogModel, ModelCatalog
from novelo.ai.catalog import catalog as default_catalog
from novelo.ai.eval_triage import TriageEvalReport, load_report
from novelo.ai.runtime import BUDGET_WARN_PCT, AiRuntime, ResolvedTask, Source, UsageEvent
from novelo.ai.tasks import (
    CONFIGURABLE_TASKS,
    OPERATION_LABEL,
    RECOMMENDED,
    RECOMMENDED_MODEL,
    TASK_MAX_TOKENS,
    TASK_REQUIREMENTS,
    TYPICAL_TOKENS,
    AiTask,
)
from novelo.core.config import Settings, get_settings
from novelo.core.errors import AppError, NotFoundError, UpstreamError
from novelo.core.logging import request_id_var
from novelo.features.ai_admin.models import AiSettings, AiUsage
from novelo.features.ai_admin.schemas import (
    AiCreditsOut,
    AiModelOut,
    AiModelsOut,
    AiSettingsOut,
    AiSettingsUpdate,
    AiUsageOut,
    BudgetOut,
    EffectiveTask,
    GlobalDefaults,
    ModelSort,
    TaskConfigOut,
    TaskOverride,
    TestModelOut,
    UsageDay,
    UsageGroup,
    UsageTotals,
)
from novelo.features.users.models import User


class ModelNotSuitableError(AppError):
    status_code = 400
    code = "bad_request"


# --- Configuração ----------------------------------------------------------------------------------


async def get_row(db: AsyncSession) -> AiSettings:
    row = (await db.execute(select(AiSettings))).scalars().first()
    if row is None:
        row = AiSettings(singleton=True, tasks={})
        db.add(row)
        await db.commit()
    return row


def _override(row: AiSettings, task: AiTask) -> TaskOverride:
    return TaskOverride.model_validate((row.tasks or {}).get(task.value, {}))


def resolve_task(row: AiSettings | None, s: Settings, task: AiTask) -> ResolvedTask:
    """Tarefa -> valor efetivo e origem: valor da tarefa, depois global (BD), depois `.env`, depois o código."""
    o = _override(row, task) if row else TaskOverride()
    vision = task == AiTask.TRIAGE

    def pick(own: Any, global_db: Any, env: Any, code: Any = None) -> tuple[Any, Source]:
        if own is not None:
            return own, "database"
        if global_db is not None:
            return global_db, "global_default"
        if env not in (None, "", 0):
            return env, "env"
        return code, "code"

    model, model_src = pick(
        o.model,
        (row.default_vision_model if vision else row.default_text_model) if row else None,
        s.llm_model_vision if vision else s.llm_model_text,
    )
    fb, fb_src = pick(o.fallback_model, row.default_fallback_model if row else None, s.llm_model_fallback)
    tokens, tok_src = pick(
        o.max_output_tokens,
        row.default_max_output_tokens if row else None,
        s.llm_max_output_tokens,
        TASK_MAX_TOKENS[task],
    )
    effort, eff_src = pick(
        o.reasoning_effort, row.default_reasoning_effort if row else None, s.llm_reasoning_effort, "low"
    )
    return ResolvedTask(
        model=model,
        model_source=model_src,
        fallback_model=fb,
        fallback_source=fb_src if fb else "env",
        max_output_tokens=int(tokens),
        max_tokens_source=tok_src,
        reasoning_effort=effort,
        reasoning_source=eff_src,
    )


def _budget_value(row: AiSettings | None, s: Settings) -> float | None:
    value = float(row.monthly_budget_usd) if row and row.monthly_budget_usd is not None else s.llm_monthly_budget_usd
    return value or None


def _month_start() -> datetime:
    now = datetime.now(UTC)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


async def month_spent(db: AsyncSession) -> float:
    total = await db.scalar(
        select(func.coalesce(func.sum(AiUsage.cost_usd), 0)).where(AiUsage.created_at >= _month_start())
    )
    return float(total or 0)


def _budget_out(budget: float | None, spent: float) -> BudgetOut:
    pct = round(spent / budget * 100, 1) if budget else None
    state = (
        "unlimited"
        if not budget
        else "exceeded"
        if spent >= budget
        else "warning"
        if (pct or 0) >= BUDGET_WARN_PCT
        else "ok"
    )
    return BudgetOut(
        monthly_budget_usd=budget, spent_usd=round(spent, 4), used_pct=pct, state=state, warn_pct=BUDGET_WARN_PCT
    )


async def build_runtime(db: AsyncSession, user: User | None, settings: Settings | None = None) -> AiRuntime:
    s = settings or get_settings()
    row = await get_row(db)
    request_id = request_id_var.get()
    user_id = user.id if user else None

    async def sink(event: UsageEvent) -> None:
        db.add(
            AiUsage(
                task=event.task,
                model=event.model,
                prompt_tokens=event.prompt_tokens,
                completion_tokens=event.completion_tokens,
                cost_usd=Decimal(str(round(event.cost_usd, 6))) if event.cost_usd is not None else None,
                cost_source=event.cost_source,
                latency_ms=event.latency_ms,
                success=event.success,
                error_code=event.error_code,
                request_id=None if request_id == "-" else request_id,
                input_hash=event.input_hash,
                user_id=user_id,
            )
        )
        await db.commit()

    return AiRuntime(
        tasks={t: resolve_task(row, s, t) for t in (*CONFIGURABLE_TASKS, AiTask.TEST)},
        budget_usd=_budget_value(row, s),
        spent_usd=await month_spent(db),
        sink=sink,
        price_of=default_catalog.price_of,
    )


async def build_client(db: AsyncSession, user: User | None) -> OpenRouterClient:
    return OpenRouterClient(runtime=await build_runtime(db, user))


def _defaults_out(row: AiSettings | None) -> GlobalDefaults:
    if row is None:
        return GlobalDefaults()
    return GlobalDefaults(
        text_model=row.default_text_model,
        vision_model=row.default_vision_model,
        fallback_model=row.default_fallback_model,
        max_output_tokens=row.default_max_output_tokens,
        reasoning_effort=row.default_reasoning_effort,
    )


def _env_out(s: Settings) -> GlobalDefaults:
    return GlobalDefaults(
        text_model=s.llm_model_text,
        vision_model=s.llm_model_vision,
        fallback_model=s.llm_model_fallback or None,
        max_output_tokens=s.llm_max_output_tokens or None,
        reasoning_effort=s.llm_reasoning_effort,
    )


async def get_settings_out(db: AsyncSession) -> AiSettingsOut:
    s = get_settings()
    row = await get_row(db)
    tasks = []
    for t in CONFIGURABLE_TASKS:
        eff = resolve_task(row, s, t)
        tasks.append(
            TaskConfigOut(
                task=t,
                requirements=sorted(TASK_REQUIREMENTS[t]),
                recommended_model=RECOMMENDED[t],
                override=_override(row, t),
                effective=EffectiveTask(**eff.__dict__),
            )
        )
    return AiSettingsOut(
        enabled=s.llm_enabled,
        defaults=_defaults_out(row),
        env=_env_out(s),
        tasks=tasks,
        budget=_budget_out(_budget_value(row, s), await month_spent(db)),
        updated_at=row.updated_at,
    )


def _required_by_model(body: AiSettingsUpdate) -> dict[str, tuple[set[str], list[str]]]:
    """Cada modelo escolhido explicitamente -> capacidades que alguma tarefa lhe vai exigir."""
    d = body.defaults
    own = {t.task: t for t in body.tasks}
    need: dict[str, tuple[set[str], list[str]]] = {}

    def add(model: str | None, task: AiTask) -> None:
        if model:
            caps, who = need.setdefault(model, (set(), []))
            caps |= TASK_REQUIREMENTS[task]
            who.append(task.value)

    for t in CONFIGURABLE_TASKS:
        o = own.get(t)
        default_model = d.vision_model if t == AiTask.TRIAGE else d.text_model
        add(o.model if o and o.model else default_model, t)
        add(o.fallback_model if o and o.fallback_model else d.fallback_model, t)
    return need


async def update_settings(db: AsyncSession, body: AiSettingsUpdate, user: User, catalog: ModelCatalog) -> AiSettingsOut:
    snap = await catalog.snapshot()
    for model_id, (caps, who) in _required_by_model(body).items():
        found = snap.models.get(model_id)
        if found is None:
            raise ModelNotSuitableError(f"Model '{model_id}' does not exist in the OpenRouter catalog")
        missing = sorted(caps - found.capabilities())
        if missing:
            raise ModelNotSuitableError(f"Model '{model_id}' lacks {missing}, required by: {sorted(set(who))}")
    row = await get_row(db)
    d = body.defaults
    row.default_text_model, row.default_vision_model = d.text_model, d.vision_model
    row.default_fallback_model, row.default_max_output_tokens = d.fallback_model, d.max_output_tokens
    row.default_reasoning_effort = d.reasoning_effort
    row.monthly_budget_usd = Decimal(str(body.monthly_budget_usd)) if body.monthly_budget_usd is not None else None
    row.tasks = {
        t.task.value: t.model_dump(mode="json", exclude={"task"}, exclude_none=True)
        for t in body.tasks
        if t.model_dump(exclude={"task"}, exclude_none=True)
    }
    row.updated_by_id = user.id
    await db.commit()
    return await get_settings_out(db)


# --- Catálogo --------------------------------------------------------------------------------------


async def _measured_costs(db: AsyncSession, task: AiTask) -> dict[str, tuple[float, int]]:
    """Custo médio por operação (pedido) e nº de amostras, por modelo, a partir do ai_usage."""
    op = func.coalesce(AiUsage.request_id, cast(AiUsage.id, String))
    per_op = (
        select(AiUsage.model.label("model"), func.sum(AiUsage.cost_usd).label("cost"))
        .where(AiUsage.task == task.value, AiUsage.success.is_(True), AiUsage.cost_usd.is_not(None))
        .group_by(AiUsage.model, op)
        .subquery()
    )
    rows = (
        await db.execute(select(per_op.c.model, func.avg(per_op.c.cost), func.count()).group_by(per_op.c.model))
    ).all()
    return {m: (float(avg), int(n)) for m, avg, n in rows}


def _estimate(m: CatalogModel, task: AiTask) -> float | None:
    if m.input_per_m_usd is None or m.output_per_m_usd is None:
        return None
    tin, tout = TYPICAL_TOKENS[task]
    return (tin * m.input_per_m_usd + tout * m.output_per_m_usd) / 1e6


async def list_models(
    db: AsyncSession,
    catalog: ModelCatalog,
    *,
    task: AiTask | None,
    capability: list[str],
    q: str | None,
    sort: ModelSort,
    limit: int,
) -> AiModelsOut:
    if task == AiTask.TEST:
        raise ModelNotSuitableError("The test task has no model requirements")
    snap = await catalog.snapshot()
    required = set(TASK_REQUIREMENTS[task]) if task else set()
    required |= set(capability)
    measured = await _measured_costs(db, task) if task else {}
    out: list[AiModelOut] = []
    for m in snap.models.values():
        if not required <= m.capabilities():
            continue
        if q and q.lower() not in f"{m.id} {m.name}".lower():
            continue
        cost, basis, samples = None, None, 0
        if task:
            if m.id in measured:
                (cost, samples), basis = measured[m.id], "measured"
            else:
                cost, basis = _estimate(m, task), "estimate"
        out.append(
            AiModelOut(
                **m.model_dump(include=set(AiModelOut.model_fields)),
                recommended=bool(task and m.id == RECOMMENDED[task]) or (not task and m.id == RECOMMENDED_MODEL),
                compatible=True if task else None,
                cost_per_operation_usd=round(cost, 6) if cost is not None else None,
                cost_basis=basis,
                cost_samples=samples,
            )
        )
    if sort == "cost" and task:
        out.sort(key=lambda x: (x.cost_per_operation_usd is None, x.cost_per_operation_usd or 0, x.id))
    elif sort == "price":
        out.sort(key=lambda x: (x.input_per_m_usd is None, x.input_per_m_usd or 0, x.id))
    else:
        out.sort(key=lambda x: (not x.recommended, x.name.lower()))
    return AiModelsOut(
        models=out[:limit],
        total=len(out),
        task=task,
        operation=OPERATION_LABEL[task] if task else None,
        stale=snap.stale,
        recommended_model=RECOMMENDED[task] if task else RECOMMENDED_MODEL,
    )


# --- Uso -------------------------------------------------------------------------------------------


def _group(rows: Any, with_task: bool, with_model: bool) -> list[UsageGroup]:
    out = []
    for r in rows:
        out.append(
            UsageGroup(
                task=r.task if with_task else None,
                model=r.model if with_model else None,
                calls=r.calls,
                errors=int(r.errors or 0),
                prompt_tokens=int(r.pt or 0),
                completion_tokens=int(r.ct or 0),
                cost_usd=round(float(r.cost or 0), 6),
                avg_latency_ms=round(float(r.lat or 0), 1),
            )
        )
    return out


async def usage_report(db: AsyncSession, days: int) -> AiUsageOut:
    since = datetime.now(UTC) - timedelta(days=days)
    metrics: list[Any] = [
        func.count().label("calls"),
        func.sum(cast(AiUsage.success.is_(False), Integer)).label("errors"),
        func.sum(AiUsage.prompt_tokens).label("pt"),
        func.sum(AiUsage.completion_tokens).label("ct"),
        func.sum(AiUsage.cost_usd).label("cost"),
        func.avg(AiUsage.latency_ms).label("lat"),
    ]
    where = AiUsage.created_at >= since

    async def grouped(*cols: Any) -> Any:
        return (
            await db.execute(
                select(*cols, *metrics)
                .where(where)
                .group_by(*cols)
                .order_by(func.sum(AiUsage.cost_usd).desc().nulls_last())
            )
        ).all()

    total = (await db.execute(select(*metrics).where(where))).one()
    day = func.date_trunc("day", AiUsage.created_at).label("day")
    days_rows = (
        await db.execute(
            select(day, func.count().label("calls"), func.coalesce(func.sum(AiUsage.cost_usd), 0).label("cost"))
            .where(where)
            .group_by(day)
            .order_by(day)
        )
    ).all()
    s = get_settings()
    row = await get_row(db)
    return AiUsageOut(
        days=days,
        totals=UsageTotals(
            calls=total.calls,
            errors=int(total.errors or 0),
            prompt_tokens=int(total.pt or 0),
            completion_tokens=int(total.ct or 0),
            cost_usd=round(float(total.cost or 0), 6),
            avg_latency_ms=round(float(total.lat or 0), 1),
        ),
        month=_budget_out(_budget_value(row, s), await month_spent(db)),
        by_day=[UsageDay(day=r.day.date(), calls=r.calls, cost_usd=round(float(r.cost), 6)) for r in days_rows],
        by_task=_group(await grouped(AiUsage.task), True, False),
        by_model=_group(await grouped(AiUsage.model), False, True),
        by_task_model=_group(await grouped(AiUsage.task, AiUsage.model), True, True),
    )


# --- Créditos, teste e avaliação -------------------------------------------------------------------


def _usd(value: Any) -> float | None:
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


async def credits(client: OpenRouterClient) -> AiCreditsOut:
    if not get_settings().llm_enabled:
        return AiCreditsOut(
            available=False, message="OPENROUTER_API_KEY is not set", limit_usd=None, limit_remaining_usd=None,
            key_usage_usd=None, total_credits_usd=None, total_usage_usd=None, is_free_tier=None,
        )  # fmt: skip
    data = await client.account()
    if not data:
        return AiCreditsOut(
            available=False, message="OpenRouter did not return balance information", limit_usd=None,
            limit_remaining_usd=None, key_usage_usd=None, total_credits_usd=None, total_usage_usd=None,
            is_free_tier=None,
        )  # fmt: skip
    free = data.get("is_free_tier")
    return AiCreditsOut(
        available=True,
        message=None,
        limit_usd=_usd(data.get("limit")),
        limit_remaining_usd=_usd(data.get("limit_remaining")),
        key_usage_usd=_usd(data.get("usage")),
        total_credits_usd=_usd(data.get("total_credits")),
        total_usage_usd=_usd(data.get("total_usage")),
        is_free_tier=free if isinstance(free, bool) else None,
    )


async def test_model(client: OpenRouterClient, catalog: ModelCatalog, model: str, task: AiTask | None) -> TestModelOut:
    missing: list[str] = []
    if task:
        snap = await catalog.snapshot()
        found = snap.models.get(model)
        if found is None:
            return TestModelOut(
                ok=False, model=model, latency_ms=None, cost_usd=None, prompt_tokens=None, completion_tokens=None,
                missing_capabilities=[], error="Model not found in the OpenRouter catalog",
            )  # fmt: skip
        missing = sorted(TASK_REQUIREMENTS[task] - found.capabilities())
    try:
        call = await client.ping(model)
    except UpstreamError as exc:
        return TestModelOut(
            ok=False, model=model, latency_ms=None, cost_usd=None, prompt_tokens=None, completion_tokens=None,
            missing_capabilities=missing, error=exc.message,
        )  # fmt: skip
    return TestModelOut(
        ok=not missing,
        model=model,
        latency_ms=round(call.latency_s * 1000),
        cost_usd=call.cost_usd,
        prompt_tokens=call.prompt_tokens,
        completion_tokens=call.completion_tokens,
        missing_capabilities=missing,
        error=None,
    )


def triage_eval() -> TriageEvalReport:
    report = load_report(get_settings().data_dir.parent / "eval" / "triage-last.json")
    if report is None:
        raise NotFoundError("No triage evaluation has been run yet")
    return report
