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
from collections.abc import AsyncGenerator, Awaitable, Callable
from contextlib import aclosing
from dataclasses import dataclass, field
from typing import Any, Literal, TypeVar

import anyio
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


def strict_json_schema(schema: type[BaseModel]) -> dict[str, Any]:
    """JSON Schema aceite pelo modo `strict` (OpenAI): objetos fechados e todos os campos obrigatórios.

    O Pydantic continua a validar a resposta com o modelo original (defaults e limites incluídos).
    """

    def fix(node: Any) -> Any:
        if isinstance(node, list):
            return [fix(x) for x in node]
        if not isinstance(node, dict):
            return node
        if "$ref" in node:
            return {"$ref": node["$ref"]}  # irmãos de $ref (description...) fazem o modo strict rejeitar o esquema
        out = {k: fix(v) for k, v in node.items() if k not in {"default", "title"} or isinstance(v, dict)}
        if out.get("type") == "object" or "properties" in out:
            props = out.get("properties", {})
            out["additionalProperties"] = False
            out["required"] = list(props)
        return out

    fixed: dict[str, Any] = fix(schema.model_json_schema())
    return fixed


def _error_detail(resp: httpx.Response) -> str:
    """Mensagem de erro do fornecedor (curta; nunca inclui cabeçalhos nem a chave)."""
    try:
        err = resp.json().get("error", {})
        return str(err.get("message", ""))[:200] if isinstance(err, dict) else str(err)[:200]
    except (ValueError, AttributeError):
        return ""


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


@dataclass(frozen=True)
class RawToolCall:
    id: str
    name: str
    arguments: str


@dataclass(frozen=True)
class TextPiece:
    text: str


@dataclass(frozen=True)
class ReasoningPiece:
    """O modelo está a raciocinar (o texto do raciocínio não é reencaminhado para o utilizador)."""


@dataclass(frozen=True)
class RoundResult:
    """Fim de uma volta em streaming: texto completo, chamadas a ferramentas e uso real."""

    text: str
    tool_calls: list[RawToolCall]
    finish_reason: str | None
    model: str
    usage: CallUsage | None


StreamPiece = TextPiece | ReasoningPiece | RoundResult

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
                "HTTP-Referer": "https://novelo.helder.si",
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
                    detail = _error_detail(resp)
                    log.warning("llm call rejected model=%s status=%s detail=%s", model, resp.status_code, detail)
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
        raise UpstreamError(f"The model provider is unavailable: {last}")  # `last` é só «HTTP 5xx», «timeout»...

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
            "json_schema": {"name": schema.__name__, "strict": True, "schema": strict_json_schema(schema)},
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
        log.warning("llm response invalid after retries: %s", type(last_error).__name__)
        raise UpstreamError("The model did not return a valid response")

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

    async def stream_round(
        self,
        *,
        system: str,
        messages: list[dict[str, Any]],
        tools: list[ToolSpec],
        task: AiTask | str = AiTask.COPILOT,
        model: str | None = None,
        tools_enabled: bool = True,
        force_tool: str | None = None,
    ) -> AsyncGenerator[StreamPiece, None]:
        """Uma volta do modelo em streaming (SSE): texto em tempo real e, no fim, as chamadas a ferramentas.

        Acumula os `tool_calls` por índice (o nome vem no 1.º fragmento, os argumentos em pedaços), pede o `usage`
        final (`stream_options.include_usage`) e ignora os comentários `: OPENROUTER PROCESSING`. Fechar o gerador
        (cliente desligou) fecha a ligação ao fornecedor, que pára o modelo; o uso parcial fica registado.
        Repete falhas transitórias e tenta o modelo de reserva só antes de ter saído qualquer texto.
        """
        self._require_enabled()
        the_task = AiTask(task)
        chosen = model or self.model_for(the_task)
        payload = self._base_payload(the_task, chosen, [{"role": "system", "content": system}, *messages])
        payload["stream"] = True
        payload["stream_options"] = {"include_usage": True}
        if tools:
            payload["tools"] = [t.as_openai() for t in tools]
            payload["tool_choice"] = "auto" if tools_enabled else "none"
            if force_tool and tools_enabled:
                payload["tool_choice"] = {"type": "function", "function": {"name": force_tool}}
        if self._rt:
            self._rt.check_budget()
        candidates = [chosen]
        fallback = self._fallback_for(the_task) if model is None else None
        if fallback and fallback != chosen:
            candidates.append(fallback)
        for index, candidate in enumerate(candidates):
            payload["model"] = candidate
            emitted = False
            try:
                async with aclosing(self._stream_once(the_task, payload)) as pieces:
                    async for piece in pieces:
                        emitted = emitted or isinstance(piece, TextPiece)
                        yield piece
                return
            except UpstreamError:
                if emitted or index == len(candidates) - 1:
                    raise
                log.warning(
                    "llm stream fallback task=%s from=%s to=%s", the_task.value, candidate, candidates[index + 1]
                )

    async def _stream_once(self, task: AiTask, payload: dict[str, Any]) -> AsyncGenerator[StreamPiece, None]:
        model = str(payload["model"])
        input_hash = hashlib.sha256(json.dumps(payload.get("messages"), default=str).encode()).hexdigest()
        started = time.perf_counter()
        state = _RoundState()
        try:
            async with (
                _semaphore(self._s.llm_max_concurrency),
                aclosing(self._read_with_retries(payload, state)) as pieces,
            ):
                async for piece in pieces:
                    yield piece
        except UpstreamError:
            with anyio.CancelScope(shield=True):
                await self._emit(task, model, None, time.perf_counter() - started, False, "upstream_error", input_hash)
            raise
        except (asyncio.CancelledError, GeneratorExit):
            # Cliente desligou: regista o que se gastou até aqui (limite inferior) e deixa o cancelamento seguir.
            with anyio.CancelScope(shield=True):
                partial = {"usage": {"completion_tokens": max(1, len(state.text) // 4)}}
                await self._emit(task, model, partial, time.perf_counter() - started, False, "cancelled", input_hash)
            raise
        elapsed = time.perf_counter() - started
        await self._emit(task, model, {"usage": state.usage} if state.usage else None, elapsed, True, None, input_hash)
        recorded = self.usage[-1] if self.usage else None
        yield RoundResult(state.text, state.tool_calls(), state.finish, model, recorded)

    async def _read_with_retries(
        self, payload: dict[str, Any], state: "_RoundState"
    ) -> AsyncGenerator[StreamPiece, None]:
        last = "unknown error"
        for attempt in range(self._s.llm_max_retries + 1):
            try:
                async with self._http.stream("POST", "/chat/completions", json=payload) as resp:
                    if resp.status_code in _RETRY_STATUS:
                        last = f"HTTP {resp.status_code}"
                    elif resp.status_code >= 400:
                        await resp.aread()
                        detail = _error_detail(resp)
                        log.warning("llm stream rejected status=%s detail=%s", resp.status_code, detail)
                        raise UpstreamError(f"The model provider rejected the request (HTTP {resp.status_code})")
                    else:
                        async for line in resp.aiter_lines():
                            if not line.startswith("data:"):
                                continue  # linhas vazias e comentários SSE (keep-alive)
                            body = line[5:].strip()
                            if body == "[DONE]":
                                break
                            for piece in state.feed(body):
                                yield piece
                        return
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                if state.got_output:
                    raise UpstreamError("The model stream was interrupted") from exc
                last = "timeout" if isinstance(exc, httpx.TimeoutException) else "transport error"
            log.warning("llm stream failed attempt=%s reason=%s", attempt + 1, last)
            if attempt < self._s.llm_max_retries:
                await asyncio.sleep(self._s.llm_retry_backoff_s * 2**attempt)
        raise UpstreamError(f"The model provider is unavailable: {last}")  # `last` é só «HTTP 5xx», «timeout»...

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


class _RoundState:
    """Estado de uma volta em streaming: junta os fragmentos de texto e de `tool_calls` (por índice)."""

    def __init__(self) -> None:
        self.parts: list[str] = []
        self.calls: dict[int, dict[str, str]] = {}
        self.finish: str | None = None
        self.usage: dict[str, Any] | None = None
        self.got_output = False

    @property
    def text(self) -> str:
        return "".join(self.parts)

    def feed(self, body: str) -> list[StreamPiece]:
        try:
            chunk = json.loads(body)
        except json.JSONDecodeError:
            return []
        if chunk.get("error"):  # erro a meio da geração: o estado HTTP já era 200
            raise UpstreamError("The model stream failed mid-generation")
        if isinstance(chunk.get("usage"), dict):
            self.usage = chunk["usage"]
        choice = (chunk.get("choices") or [{}])[0]
        delta = choice.get("delta") or {}
        self.finish = choice.get("finish_reason") or self.finish
        out: list[StreamPiece] = []
        if delta.get("content"):
            self.got_output = True
            self.parts.append(delta["content"])
            out.append(TextPiece(delta["content"]))
        elif delta.get("reasoning"):
            out.append(ReasoningPiece())
        for tc in delta.get("tool_calls") or []:
            self.got_output = True
            slot = self.calls.setdefault(int(tc.get("index", 0)), {"id": "", "name": "", "args": ""})
            fn = tc.get("function") or {}
            slot["id"] = tc.get("id") or slot["id"]
            slot["name"] = fn.get("name") or slot["name"]
            slot["args"] += fn.get("arguments") or ""
        return out

    def tool_calls(self) -> list[RawToolCall]:
        return [
            RawToolCall(id=c["id"] or f"call_{i}", name=c["name"], arguments=c["args"] or "{}")
            for i, c in sorted(self.calls.items())
            if c["name"]
        ]
