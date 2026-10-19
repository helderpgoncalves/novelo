from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from novelo.ai.runtime import Effort, Source
from novelo.ai.tasks import CONFIGURABLE_TASKS, AiTask

BudgetState = Literal["unlimited", "ok", "warning", "exceeded"]
CostBasis = Literal["measured", "estimate"]
ModelSort = Literal["name", "cost", "price"]


class TaskOverride(BaseModel):
    """Valores próprios de uma tarefa. Campos nulos herdam o valor global."""

    model: str | None = Field(default=None, max_length=120, description="Slug do OpenRouter, ex.: openai/gpt-6-luna")
    fallback_model: str | None = Field(default=None, max_length=120)
    max_output_tokens: int | None = Field(default=None, ge=16, le=8000)
    reasoning_effort: Effort | None = None


class TaskConfigIn(TaskOverride):
    task: AiTask


class GlobalDefaults(BaseModel):
    """Valores globais: herdados por todas as tarefas sem valor próprio. Nulos herdam o `.env`."""

    text_model: str | None = Field(default=None, max_length=120)
    vision_model: str | None = Field(default=None, max_length=120)
    fallback_model: str | None = Field(default=None, max_length=120)
    max_output_tokens: int | None = Field(default=None, ge=16, le=8000)
    reasoning_effort: Effort | None = None


class AiSettingsUpdate(BaseModel):
    """Substitui a configuração: o que vier nulo volta a herdar (da tarefa para o global, do global para o `.env`)."""

    defaults: GlobalDefaults
    monthly_budget_usd: float | None = Field(default=None, ge=0, le=100_000, description="0 = sem limite; nulo = .env")
    tasks: list[TaskConfigIn] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def _tasks_valid(self) -> "AiSettingsUpdate":
        seen = [t.task for t in self.tasks]
        if len(seen) != len(set(seen)):
            raise ValueError("Each task may appear only once")
        bad = [t.value for t in seen if t not in CONFIGURABLE_TASKS]
        if bad:
            raise ValueError(f"Tasks that cannot be configured: {bad}")
        return self


class EffectiveTask(BaseModel):
    model: str
    model_source: Source
    fallback_model: str | None
    fallback_source: Source
    max_output_tokens: int
    max_tokens_source: Source
    reasoning_effort: Effort
    reasoning_source: Source


class TaskConfigOut(BaseModel):
    task: AiTask
    requirements: list[str] = Field(description="Capacidades que o modelo tem de ter: image, tools, structured_outputs")
    recommended_model: str
    override: TaskOverride
    effective: EffectiveTask


class BudgetOut(BaseModel):
    monthly_budget_usd: float | None = Field(description="Nulo = sem limite")
    spent_usd: float = Field(description="Custo acumulado no mês corrente (UTC)")
    used_pct: float | None
    state: BudgetState
    warn_pct: float


class AiSettingsOut(BaseModel):
    enabled: bool = Field(description="Há chave do OpenRouter configurada")
    defaults: GlobalDefaults = Field(description="Valores globais guardados na base de dados")
    env: GlobalDefaults = Field(description="Valores do .env, usados quando a base de dados não define o campo")
    tasks: list[TaskConfigOut]
    budget: BudgetOut
    updated_at: datetime | None


class AiModelOut(BaseModel):
    id: str
    name: str
    context_length: int | None
    input_per_m_usd: float | None
    output_per_m_usd: float | None
    dynamic_pricing: bool
    input_modalities: list[str]
    supports_image: bool
    supports_tools: bool
    supports_structured_outputs: bool
    recommended: bool
    compatible: bool | None = Field(description="Cumpre os requisitos da tarefa pedida; nulo sem tarefa")
    cost_per_operation_usd: float | None = Field(description="Custo de uma operação da tarefa pedida")
    cost_basis: CostBasis | None = Field(description="measured = média real do ai_usage; estimate = tokens típicos")
    cost_samples: int


class AiModelsOut(BaseModel):
    models: list[AiModelOut]
    total: int
    task: AiTask | None
    operation: str | None = Field(description="per_item_sorted, per_question, per_briefing, per_explanation, per_alert")
    stale: bool = Field(description="O catálogo do OpenRouter não respondeu: serve-se a cópia anterior")
    recommended_model: str | None


class UsageTotals(BaseModel):
    calls: int
    errors: int
    prompt_tokens: int
    completion_tokens: int
    cost_usd: float
    avg_latency_ms: float


class UsageDay(BaseModel):
    day: date
    calls: int
    cost_usd: float


class UsageGroup(BaseModel):
    task: str | None
    model: str | None
    calls: int
    errors: int
    prompt_tokens: int
    completion_tokens: int
    cost_usd: float
    avg_latency_ms: float


class AiUsageOut(BaseModel):
    days: int
    totals: UsageTotals
    month: BudgetOut
    by_day: list[UsageDay]
    by_task: list[UsageGroup]
    by_model: list[UsageGroup]
    by_task_model: list[UsageGroup]


class AiCreditsOut(BaseModel):
    available: bool
    message: str | None
    limit_usd: float | None
    limit_remaining_usd: float | None
    key_usage_usd: float | None
    total_credits_usd: float | None
    total_usage_usd: float | None
    is_free_tier: bool | None


class TestModelRequest(BaseModel):
    model: str = Field(min_length=3, max_length=120)
    task: AiTask | None = Field(default=None, description="Se indicada, verifica também a compatibilidade")


class TestModelOut(BaseModel):
    ok: bool
    model: str
    latency_ms: int | None
    cost_usd: float | None
    prompt_tokens: int | None
    completion_tokens: int | None
    missing_capabilities: list[str]
    error: str | None
