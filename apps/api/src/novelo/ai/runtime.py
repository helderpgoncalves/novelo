"""Configuração de IA resolvida para um pedido: modelo, reserva e limites por tarefa, orçamento e registo de uso.

A base de dados manda (`ai_settings`); o `.env` só dá o valor inicial. Sem `AiRuntime` (scripts, testes do cliente)
o cliente usa só o `.env`.
"""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Literal

from novelo.ai.tasks import TASK_MAX_TOKENS, AiTask
from novelo.core.errors import AiBudgetExceededError

Source = Literal["database", "global_default", "env", "code"]
Effort = Literal["low", "medium", "high"]
BUDGET_WARN_PCT = 80.0


@dataclass(frozen=True)
class ResolvedTask:
    """O que se usa de facto numa tarefa, e de onde vem cada valor."""

    model: str
    model_source: Source
    fallback_model: str | None
    fallback_source: Source
    max_output_tokens: int
    max_tokens_source: Source
    reasoning_effort: Effort
    reasoning_source: Source


@dataclass(frozen=True)
class UsageEvent:
    """Uma chamada ao modelo. Nunca inclui prompts, imagens nem respostas: no máximo um hash da entrada."""

    task: str
    model: str
    prompt_tokens: int | None
    completion_tokens: int | None
    cost_usd: float | None
    cost_source: Literal["provider", "catalog", "unknown"]
    latency_ms: int
    success: bool
    error_code: str | None
    input_hash: str | None
    web_search_requests: int = 0  # `usage.server_tool_use.web_search_requests` (custo extra por pesquisa)


UsageSink = Callable[[UsageEvent], Awaitable[None]]
PriceLookup = Callable[[str], tuple[float, float] | None]  # modelo -> (USD/token de entrada, USD/token de saída)


@dataclass
class AiRuntime:
    tasks: dict[AiTask, ResolvedTask]
    budget_usd: float | None = None  # None ou 0 = sem limite
    spent_usd: float = 0.0
    sink: UsageSink | None = None
    price_of: PriceLookup | None = None
    _warned: bool = field(default=False, repr=False)

    def resolve(self, task: AiTask) -> ResolvedTask | None:
        return self.tasks.get(task)

    def max_tokens(self, task: AiTask) -> int:
        resolved = self.tasks.get(task)
        return resolved.max_output_tokens if resolved else TASK_MAX_TOKENS[task]

    def check_budget(self) -> None:
        """Paragem dura: com o orçamento do mês esgotado nenhuma chamada sai."""
        if self.budget_usd and self.spent_usd >= self.budget_usd:
            raise AiBudgetExceededError("The monthly AI budget has been reached")
