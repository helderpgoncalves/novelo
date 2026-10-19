"""Cliente do OpenRouter (API compatível com OpenAI) com saída estruturada validada por Pydantic e tool calling.

Regra do projeto: o modelo nunca faz contas. Devolve JSON que um modelo Pydantic valida;
os números vêm sempre do otimizador ou da base de dados (ver docs/engenharia/ia.md).

Logs: só metadados (modelo, estado, latência, tokens, nomes de ferramentas). Nunca a chave, os cabeçalhos,
os prompts, as fotos nem o conteúdo das respostas.
"""

import asyncio
import hashlib
import json
import logging
import time
import weakref
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Literal, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from novelo.ai.cache import fingerprint, response_cache
from novelo.ai.runtime import AiRuntime, UsageEvent
from novelo.ai.tasks import CACHEABLE, SCHEMA_TASKS, TASK_MAX_TOKENS, AiTask
from novelo.core.config import Settings, get_settings
from novelo.core.errors import AiBudgetExceededError, FeatureDisabledError, UpstreamError

T = TypeVar("T", bound=BaseModel)

log = logging.getLogger("novelo.llm")

MAX_TOOL_ITERATIONS = 6  # limite duro de voltas modelo -> ferramentas -> modelo
_ACCOUNT_FIELDS = frozenset({"limit", "limit_remaining", "usage", "is_free_tier", "total_credits", "total_usage"})
_RETRY_STATUS = frozenset({408, 429, 500, 502, 503, 504})
_SEMAPHORES: "weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, asyncio.Semaphore]" = weakref.WeakKeyDictionary()


def _semaphore(limit: int) -> asyncio.Semaphore:
    """Limite de chamadas simultâneas ao fornecedor (um semáforo por event loop)."""
    loop = asyncio.get_running_loop()
    sem = _SEMAPHORES.get(loop)
    if sem is None:
        sem = _SEMAPHORES[loop] = asyncio.Semaphore(limit)
    return sem


class ToolSpec(BaseModel):
    """Ferramenta no formato OpenAI `tools`. `parameters` é o JSON Schema (normalmente de um modelo Pydantic)."""

    name: str
    description: str
    parameters: dict[str, Any]

    def as_openai(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {"name": self.name, "description": self.description, "parameters": self.parameters},
        }


@dataclass(frozen=True)
class ToolCallRecord:
    name: str
    arguments: str
    result: Any


@dataclass(frozen=True)
class CallUsage:
    """Uma chamada ao modelo. `cost_usd` só existe se o OpenRouter o devolver."""

    model: str
    latency_s: float
    prompt_tokens: int | None
    completion_tokens: int | None
    cost_usd: float | None


@dataclass
class ChatResult:
    text: str
    messages: list[dict[str, Any]]  # conversa completa (inclui as mensagens de ferramentas), para continuar
    tool_calls: list[ToolCallRecord] = field(default_factory=list)
    iterations: int = 0


# (nome, argumentos em JSON bruto) -> resultado serializável em JSON. Não deve levantar: devolve {"error": ...}.
ToolExecutor = Callable[[str, str], Awaitable[Any]]


class OpenRouterClient:
    def __init__(
        self,
        settings: Settings | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
        runtime: AiRuntime | None = None,
    ) -> None:
        self._s = settings or get_settings()
        self._rt = runtime
        self._http = httpx.AsyncClient(
            base_url=self._s.openrouter_base_url,
            timeout=self._s.llm_timeout_s,
            transport=transport,
            headers={
                "Authorization": f"Bearer {self._s.openrouter_api_key}",
                "HTTP-Referer": "https://novelo.bitsapiens.io",
                "X-Title": "Novelo",
            },
        )
        self.usage: list[CallUsage] = []  # uma entrada por chamada bem-sucedida (avaliações e custos)

    def _require_enabled(self) -> None:
        if not self._s.llm_enabled:
            raise FeatureDisabledError("AI is disabled: OPENROUTER_API_KEY is not set")

    def model_for(self, task: AiTask | str) -> str:
        """Modelo que a tarefa vai usar (base de dados, se houver runtime; senão o `.env`)."""
        t = AiTask(task)
        resolved = self._rt.resolve(t) if self._rt else None
        if resolved:
            return resolved.model
        return self._s.llm_model_vision if t == AiTask.TRIAGE else self._s.llm_model_text

    def _fallback_for(self, task: AiTask) -> str | None:
        resolved = self._rt.resolve(task) if self._rt else None
        if resolved:
            return resolved.fallback_model
        return self._s.llm_model_fallback or None

    def _base_payload(self, task: AiTask, model: str, messages: list[dict[str, Any]]) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": model,
            "temperature": 0,
            "usage": {"include": True},  # o OpenRouter devolve o custo real em `usage.cost`
            "messages": messages,
        }
        if self._rt:
            max_tokens = self._rt.max_tokens(task)
            resolved = self._rt.resolve(task)
            effort = resolved.reasoning_effort if resolved else None
        else:
            max_tokens = self._s.llm_max_output_tokens or TASK_MAX_TOKENS[task]
            effort = self._s.llm_reasoning_effort
        payload["max_tokens"] = max_tokens
        if effort and task != AiTask.TEST:
            payload["reasoning"] = {"effort": effort}
        return payload

    async def _complete(self, task: AiTask, payload: dict[str, Any], *, allow_fallback: bool = True) -> dict[str, Any]:
        """Uma chamada com orçamento, concorrência limitada, repetições e, se falhar, o modelo de reserva."""
        if self._rt:
            self._rt.check_budget()
        async with _semaphore(self._s.llm_max_concurrency):
            try:
                return await self._post(task, payload)
            except (AiBudgetExceededError, FeatureDisabledError):
                raise
            except UpstreamError:
                fallback = self._fallback_for(task) if allow_fallback else None
                if not fallback or fallback == payload.get("model"):
                    raise
                log.warning("llm fallback task=%s from=%s to=%s", task.value, payload.get("model"), fallback)
                return await self._post(task, {**payload, "model": fallback})

    async def _post(self, task: AiTask, payload: dict[str, Any]) -> dict[str, Any]:
        """POST /chat/completions com timeout e repetição de falhas transitórias (timeout, 429, 5xx)."""
        model = str(payload.get("model"))
        input_hash = hashlib.sha256(json.dumps(payload.get("messages"), default=str).encode()).hexdigest()
        started_all = time.perf_counter()
        last: str = "unknown error"
        error_code = "upstream_error"
        for attempt in range(self._s.llm_max_retries + 1):
            started = time.perf_counter()
            try:
                resp = await self._http.post("/chat/completions", json=payload)
            except httpx.TimeoutException:
                last = "timeout"
            except httpx.TransportError as exc:
                last = f"transport error ({type(exc).__name__})"
            else:
                elapsed = time.perf_counter() - started
                if resp.status_code in _RETRY_STATUS:
                    last = f"HTTP {resp.status_code}"
                elif resp.status_code >= 400:
                    log.warning("llm call rejected model=%s status=%s", model, resp.status_code)
                    last = f"HTTP {resp.status_code}"
                    await self._emit(
                        task,
                        model,
                        None,
                        time.perf_counter() - started_all,
                        False,
                        f"http_{resp.status_code}",
                        input_hash,
                    )
                    raise UpstreamError(f"The model provider rejected the request (HTTP {resp.status_code})")
                else:
                    try:
                        data: dict[str, Any] = resp.json()
                    except ValueError as exc:
                        await self._emit(task, model, None, elapsed, False, "invalid_json", input_hash)
                        raise UpstreamError("The model provider returned invalid JSON") from exc
                    await self._emit(task, model, data, elapsed, True, None, input_hash)
                    return data
            log.warning("llm call failed model=%s attempt=%s reason=%s", model, attempt + 1, last)
            if attempt < self._s.llm_max_retries:
                await asyncio.sleep(self._s.llm_retry_backoff_s * 2**attempt)
        await self._emit(task, model, None, time.perf_counter() - started_all, False, error_code, input_hash)
        raise UpstreamError(f"The model provider is unavailable: {last}")

    async def _emit(
        self,
        task: AiTask,
        model: str,
        data: dict[str, Any] | None,
        elapsed: float,
        success: bool,
        error_code: str | None,
        input_hash: str,
    ) -> None:
        raw = data.get("usage") if data else None
        usage: dict[str, Any] = raw if isinstance(raw, dict) else {}
        prompt, completion = usage.get("prompt_tokens"), usage.get("completion_tokens")
        cost: float | None = float(usage["cost"]) if isinstance(usage.get("cost"), (int, float)) else None
        source: Literal["provider", "catalog", "unknown"] = "provider" if cost is not None else "unknown"
        if cost is None and success and self._rt and self._rt.price_of and prompt is not None:
            price = self._rt.price_of(model)
            if price:
                cost, source = prompt * price[0] + (completion or 0) * price[1], "catalog"
        if success:
            self.usage.append(CallUsage(model, round(elapsed, 3), prompt, completion, cost))
            log.info(
                "llm call ok task=%s model=%s latency_s=%.2f tokens=%s/%s",
                task.value,
                model,
                elapsed,
                prompt,
                completion,
            )
        if self._rt:
            self._rt.spent_usd += cost or 0.0
            if self._rt.sink:
                event = UsageEvent(
                    task.value,
                    model,
                    prompt,
                    completion,
                    cost,
                    source,
                    round(elapsed * 1000),
                    success,
                    error_code,
                    input_hash,
                )
                try:
                    await self._rt.sink(event)
                except Exception:  # registar uso nunca pode estragar a resposta
                    log.exception("could not record AI usage")

    async def structured(
        self,
        *,
        system: str,
        user: str | list[dict[str, Any]],
        schema: type[T],
        model: str | None = None,
        retries: int = 1,
        task: AiTask | str | None = None,
    ) -> T:
        """Pede JSON que cumpra `schema` (json_schema estrito); volta a pedir `retries` vezes se não validar."""
        self._require_enabled()
        the_task = AiTask(task) if task else SCHEMA_TASKS.get(schema.__name__, AiTask.EXPLAIN)
        chosen = model or self.model_for(the_task)
        key = None
        if schema.__name__ in SCHEMA_TASKS and the_task in CACHEABLE and isinstance(user, str):
            key = fingerprint(the_task.value, chosen, system, user, schema.__name__)
            if (hit := response_cache.get(key)) is not None:
                log.info("llm cache hit task=%s", the_task.value)
                return schema.model_validate_json(hit)
        # O prompt de sistema vai primeiro e é estável: favorece o prompt caching do fornecedor.
        payload = self._base_payload(
            the_task, chosen, [{"role": "system", "content": system}, {"role": "user", "content": user}]
        )
        payload["response_format"] = {
            "type": "json_schema",
            "json_schema": {"name": schema.__name__, "strict": True, "schema": schema.model_json_schema()},
        }
        last_error: Exception | None = None
        for _ in range(retries + 1):
            data = await self._complete(the_task, payload, allow_fallback=model is None)
            try:
                content = data["choices"][0]["message"]["content"]
                result = schema.model_validate(json.loads(content))
            except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValidationError) as exc:
                last_error = exc
                log.warning("llm response failed validation schema=%s error=%s", schema.__name__, type(exc).__name__)
                continue
            if key:
                response_cache.put(key, result.model_dump_json())
            return result
        raise UpstreamError(f"The model did not return a valid response: {last_error}")

    async def ping(self, model: str) -> CallUsage:
        """Chamada mínima para testar um modelo no painel. Devolve latência e custo."""
        self._require_enabled()
        payload = self._base_payload(
            AiTask.TEST, model, [{"role": "user", "content": "Reply with the single word: ok"}]
        )
        before = len(self.usage)
        await self._complete(AiTask.TEST, payload, allow_fallback=False)
        return self.usage[before]

    async def chat(
        self,
        *,
        system: str,
        messages: list[dict[str, Any]],
        tools: list[ToolSpec],
        execute: ToolExecutor,
        model: str | None = None,
        max_iterations: int = MAX_TOOL_ITERATIONS,
        allow_tools: bool = True,
        task: AiTask | str = AiTask.COPILOT,
    ) -> ChatResult:
        """Conversa com ferramentas (tool calling OpenAI): o modelo pede, `execute` corre, o modelo continua.

        No máximo `max_iterations` (nunca mais de 6) chamadas ao modelo; na última as ferramentas ficam
        desligadas (`tool_choice: none`) para o modelo ter de responder. Há um limite de tempo total.
        """
        self._require_enabled()
        the_task = AiTask(task)
        limit = max(1, min(max_iterations, MAX_TOOL_ITERATIONS))
        history = list(messages)
        records: list[ToolCallRecord] = []
        try:
            async with asyncio.timeout(self._s.llm_chat_timeout_s):
                for iteration in range(1, limit + 1):
                    last_round = iteration == limit or not allow_tools
                    payload = self._base_payload(
                        the_task, model or self.model_for(the_task), [{"role": "system", "content": system}, *history]
                    )
                    if tools:
                        payload["tools"] = [t.as_openai() for t in tools]
                        payload["tool_choice"] = "none" if last_round else "auto"
                    data = await self._complete(the_task, payload, allow_fallback=model is None)
                    try:
                        message = data["choices"][0]["message"]
                    except (KeyError, IndexError, TypeError) as exc:
                        raise UpstreamError("The model returned a malformed response") from exc
                    calls = message.get("tool_calls") or []
                    if not calls or last_round:
                        if calls:
                            raise UpstreamError("The model kept asking for tools after the iteration limit")
                        history.append({"role": "assistant", "content": message.get("content") or ""})
                        return ChatResult(
                            text=str(message.get("content") or "").strip(),
                            messages=history,
                            tool_calls=records,
                            iterations=iteration,
                        )
                    history.append({"role": "assistant", "content": message.get("content"), "tool_calls": calls})
                    for call in calls:
                        name, raw_args = _read_call(call)
                        log.info("llm tool call tool=%s iteration=%s", name, iteration)
                        result = await execute(name, raw_args)
                        records.append(ToolCallRecord(name=name, arguments=raw_args, result=result))
                        history.append(
                            {
                                "role": "tool",
                                "tool_call_id": str(call.get("id", "")),
                                "content": json.dumps(result, ensure_ascii=False, default=str),
                            }
                        )
        except TimeoutError as exc:
            raise UpstreamError("The model conversation timed out") from exc
        raise UpstreamError("The model did not finish")  # inalcançável: a última volta devolve ou levanta

    async def account(self) -> dict[str, Any]:
        """Saldo e limite da chave (`/credits` e `/key`). Falha com graça: devolve só o que conseguir."""
        out: dict[str, Any] = {}
        for path in ("/key", "/credits"):
            try:
                resp = await self._http.get(path)
                if resp.status_code == 200:
                    data = resp.json().get("data")
                    if isinstance(data, dict):
                        out.update(
                            {k: v for k, v in data.items() if k in _ACCOUNT_FIELDS}
                        )  # lista fechada: nada de `label`
            except (httpx.HTTPError, ValueError):
                log.warning("openrouter %s unavailable", path)
        return out

    async def aclose(self) -> None:
        await self._http.aclose()


def _read_call(call: Any) -> tuple[str, str]:
    try:
        fn = call["function"]
        return str(fn["name"]), str(fn.get("arguments") or "{}")
    except (KeyError, TypeError) as exc:
        raise UpstreamError("The model returned a malformed tool call") from exc
