# ruff: noqa: PLR0912, PLR0915
"""O copiloto em streaming: um pedido -> eventos tipados (SSE).

Camadas do prompt (da mais estável para a mais volátil):
  1. regras (copilot_v2.md)  2. persona + memória + perfil, CONGELADAS por conversa (preserva o prompt cache)
  3. histórico  4. bloco [context] do pedido (ecrã, menções, anexos, ações recentes, memo) + a pergunta.

Se o verificador rejeitar o texto depois de transmitido, emite-se `retract` e o texto reescrito. Se o cliente desligar,
o gerador é fechado: pára a chamada ao modelo, regista o uso parcial e grava a mensagem como `cancelled`.
"""

import asyncio
import base64
import json
import logging
import re
import uuid
from collections.abc import AsyncGenerator, Awaitable, Callable
from contextlib import AbstractAsyncContextManager, aclosing
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from typing import Any

import anyio
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.openrouter import (
    OpenRouterClient,
    ReasoningPiece,
    RoundResult,
    ServerToolsDroppedPiece,
    TextPiece,
    WebSignalPiece,
)
from novelo.ai.catalog import ModelCatalog
from novelo.ai.prompts import load
from novelo.ai.tasks import AiTask
from novelo.ai.verify import check_numbers
from novelo.ai.web import ServerTools, domain_of, server_tools_from, short_excerpt, user_urls
from novelo.core.config import get_settings
from novelo.core.errors import AiBudgetExceededError, AppError, ErrorCode, FeatureDisabledError
from novelo.features.copilot import aux, memory, memory_store, persona, review, user_settings
from novelo.features.copilot import web as web_service
from novelo.features.copilot.attachments import image_store
from novelo.features.copilot.mentions import ResolvedMention
from novelo.features.copilot.models import CopilotAction, CopilotAttachment, CopilotMessage, CopilotThread
from novelo.features.copilot.schemas import (
    CopilotCardEvent,
    CopilotContextEvent,
    CopilotDoneEvent,
    CopilotErrorEvent,
    CopilotEvent,
    CopilotRetractEvent,
    CopilotSource,
    CopilotSourcesEvent,
    CopilotStartEvent,
    CopilotStatusEvent,
    CopilotSuggestionsEvent,
    CopilotTextDeltaEvent,
    CopilotTitleEvent,
    CopilotToolResultEvent,
    CopilotToolStartEvent,
    CopilotUsageEvent,
    CopilotVerificationEvent,
    MentionRef,
)
from novelo.features.copilot.schemas_memory import CopilotSettings
from novelo.features.copilot.tables import fold
from novelo.features.copilot.tools import STATUS_KEYS, CopilotTools, args_summary, status_detail
from novelo.features.users.models import ImpersonationInfo, User

log = logging.getLogger("novelo.copilot")
_MEMORY_CUE = re.compile(
    r"\b(lembra-te|lembra te|memoriza|remember)\s+(de\s+)?(que|that|to)\b|\b(esquece|forget)\b", re.IGNORECASE
)

MAX_ROUNDS = 6
TITLE_WAIT_S = 4.0  # no fim do turno, quanto se espera pelo título criativo
REWRITE_ROUNDS = 3
TOOL_RESULT_CHARS = 12_000
TRACE_RESULT_BYTES = 60_000
WARNING_TEXT = {
    "pt-PT": "Não consegui validar os números desta resposta, por isso mostro apenas os resultados calculados.",
    "en": "I could not verify the numbers in this answer, so I am showing only the calculated results.",
}
COMPACTED_TEXT = {
    "pt-PT": "Conversa compactada: guardei um resumo das voltas antigas.",
    "en": "Conversation compacted: I kept a summary of the older turns.",
}
NOTHING_TO_COMPACT = {
    "pt-PT": "Ainda não há voltas antigas para compactar.",
    "en": "There are no older turns to compact yet.",
}
REWRITE = (
    "Your last answer used numbers that are not in the tool results or the verified context of this turn: {numbers}. "
    "Rewrite it using only numbers copied exactly from those sources (call a tool if you need one), "
    "in the same language, without mentioning this correction. A figure that comes from a web source is only allowed "
    "if it appears in that source's excerpt AND you label it «fonte externa» (or 'external source') with its citation."
)


@dataclass
class PreparedTurn:
    """Tudo o que se valida antes de abrir o stream (para devolver erros HTTP normais) e que não depende do modelo."""

    user_text: str
    locale: str
    thread_id: uuid.UUID | None
    mention_refs: list[MentionRef] = field(default_factory=list)
    mentions: list[ResolvedMention] = field(default_factory=list)
    attachment_ids: list[uuid.UUID] = field(default_factory=list)
    page_line: str = ""
    page_facts: list[dict[str, Any]] = field(default_factory=list)
    regenerate: bool = False
    confirm: bool = False
    edit_message_id: uuid.UUID | None = None


@dataclass
class StreamDeps:
    session_factory: Callable[[], AbstractAsyncContextManager[AsyncSession]]
    make_llm: Callable[[AsyncSession, User], Awaitable[OpenRouterClient]]
    catalog: ModelCatalog
    precheck: Callable[[AsyncSession, User], Awaitable[None]]


def _status(phase: str, key: str, detail: str | None = None) -> CopilotStatusEvent:
    return CopilotStatusEvent(phase=phase, label_key=key, detail=detail)


def _error_code(exc: BaseException) -> ErrorCode:
    return exc.code if isinstance(exc, AppError) else "internal_error"


def _cap_result(result: dict[str, Any]) -> dict[str, Any] | None:
    """Resultado de uma ferramenta de dados para voltas seguintes; reduz as linhas até caber."""
    table = result["table"]
    rows = list(table["rows"])
    while rows and len(json.dumps(rows, default=str)) > TRACE_RESULT_BYTES:
        rows = rows[: len(rows) // 2]
    return {**result, "table": {**table, "rows": rows}}


class _Run:
    def __init__(
        self, deps: StreamDeps, db: AsyncSession, user: User, llm: OpenRouterClient, turn: PreparedTurn
    ) -> None:
        self.deps, self.db, self.user, self.llm, self.turn = deps, db, user, llm, turn
        self.user_id = user.id
        self.thread: CopilotThread | None = None
        self.thread_id: uuid.UUID | None = None
        self.settings = CopilotSettings()
        self.message_id = uuid.uuid4()
        self.text = ""
        self.persisted = False
        self.verified: bool | None = None
        self.tools: CopilotTools = CopilotTools(db, user, llm, turn.locale)
        self.trace: list[dict[str, Any]] = []
        self.extra_facts: list[Any] = [*turn.page_facts, *(m.facts for m in turn.mentions)]
        self.usage0 = len(getattr(llm, "usage", []))
        self.prompt_version = "v3"
        self.model = ""
        self.emitted_cards: set[uuid.UUID] = set()
        self.recalled = False
        self.title_task: asyncio.Task[str | None] | None = None  # título criativo, em paralelo com a resposta
        self.provisional_title = ""
        self.web = web_service.WebSession(web_service.WebPolicy(False, "disabled_by_system"), 0)
        self.external_numbers: set[float] = set()
        self.server_dropped = False  # o fornecedor recusou os server tools neste pedido
        self.notice_sent = False

    # --- persistência ----------------------------------------------------------------------------

    async def _snapshot(self) -> dict[str, str]:
        out = await memory_store.render_snapshot(
            self.db, self.user_id, memory_on=self.settings.memory_enabled, user_on=self.settings.user_profile_enabled
        )
        out["persona"] = persona.render(self.settings)
        return out

    async def _open_thread(self) -> CopilotThread:
        t = self.turn
        if t.edit_message_id and t.thread_id:
            return await self._branch(t.thread_id, t.edit_message_id)
        if t.thread_id:
            thread = await self.db.get(CopilotThread, t.thread_id)
            if thread is None or thread.user_id != self.user_id:
                raise AppError("Thread not found")  # nunca revela a existência de conversas alheias
            self.thread_id = thread.id
            if not thread.snapshot:
                thread.snapshot = await self._snapshot()
                await self.db.commit()
            if t.regenerate:
                q = (
                    select(CopilotMessage)
                    .where(CopilotMessage.thread_id == thread.id)
                    .order_by(CopilotMessage.created_at.desc())
                    .limit(1)
                )
                last = (await self.db.execute(q)).scalar_one_or_none()
                if last is not None and last.role == "assistant":
                    await self.db.delete(last)
                    await self.db.commit()
            return thread
        thread = CopilotThread(
            user_id=self.user_id, title=aux.first_message_title(t.user_text), summary="", summarized_messages=0,
            snapshot=await self._snapshot(), ephemeral=not self.settings.save_history,
        )  # fmt: skip
        self.db.add(thread)
        await self.db.commit()
        self.thread_id = thread.id
        return thread

    async def _branch(self, source_id: uuid.UUID, message_id: uuid.UUID) -> CopilotThread:
        """Editar uma mensagem do utilizador: nova conversa com o que veio antes dela (a original fica intacta)."""
        source = await self.db.get(CopilotThread, source_id)
        if source is None or source.user_id != self.user_id:
            raise AppError("Thread not found")
        msgs = list(
            (
                await self.db.execute(
                    select(CopilotMessage)
                    .where(CopilotMessage.thread_id == source.id)
                    .order_by(CopilotMessage.created_at, CopilotMessage.id)
                )
            ).scalars()
        )
        idx = next((i for i, m in enumerate(msgs) if m.id == message_id and m.role == "user"), None)
        if idx is None:
            raise AppError("Message not found")
        thread = CopilotThread(
            user_id=self.user_id, title=source.title, summary="", summarized_messages=0, snapshot=source.snapshot or await self._snapshot(),
            ephemeral=source.ephemeral, parent_thread_id=source.id, project=source.project, search_text=source.search_text,
        )  # fmt: skip
        self.db.add(thread)
        await self.db.flush()
        for m in msgs[:idx]:
            self.db.add(
                CopilotMessage(
                    thread_id=thread.id, role=m.role, parts=m.parts, tool_trace=[{k: v for k, v in t.items() if k != "result"} for t in m.tool_trace],
                    cards=m.cards, usage=m.usage, verified=m.verified, model=m.model, prompt_version=m.prompt_version, status=m.status,
                    digested=True, search_text=m.search_text, created_at=m.created_at,
                )
            )  # fmt: skip
        await self.db.commit()
        self.thread_id = thread.id
        return thread

    async def _save_user_message(self, attachments: list[CopilotAttachment]) -> None:
        assert self.thread_id is not None
        parts: list[dict[str, Any]] = [{"type": "text", "text": self.turn.user_text}]
        parts += [
            {"type": "attachment", "id": str(a.id), "filename": a.filename, "kind": a.kind, "size_bytes": a.size_bytes}
            for a in attachments
        ]
        parts += [
            {"type": "mention", "mention_type": m.ref.type.value, "id": m.ref.id, "label": m.label}
            for m in self.turn.mentions
        ]
        self.db.add(
            CopilotMessage(
                thread_id=self.thread_id, role="user", parts=parts, status="complete", created_at=datetime.now(UTC),
                search_text=fold(self.turn.user_text + " " + " ".join(a.filename for a in attachments)),
            )
        )  # fmt: skip
        await self.db.execute(
            update(CopilotThread).where(CopilotThread.id == self.thread_id).values(updated_at=datetime.now(UTC))
        )
        await self.db.commit()

    async def _persist(self, status: str, usage: dict[str, Any] | None = None) -> None:
        if self.persisted or self.thread_id is None:
            return
        self.persisted = True
        parts: list[dict[str, Any]] = [{"type": "text", "text": self.text}]
        parts += [{"type": "artifact", "id": str(a)} for a in self.tools.artifact_ids]
        parts += [
            {
                "type": "web_source",
                "label": c.title,
                "url": c.url,
                "domain": c.domain,
                "excerpt": short_excerpt(c.content),
            }
            for c in self.web.citations
        ]
        action_ids = [str(e.action.id) for e in self.sent_actions]
        parts += [{"type": "action", "id": a} for a in action_ids]
        self.db.add(
            CopilotMessage(
                id=self.message_id, thread_id=self.thread_id, role="assistant", parts=parts, tool_trace=self.trace,
                cards=[c.model_dump(mode="json") for c in self.tools.cards.values()], usage=usage or {}, verified=self.verified,
                model=self.model or None, prompt_version=self.prompt_version, status=status, created_at=datetime.now(UTC),
                search_text=fold(self.text),
            )
        )  # fmt: skip
        await self.db.execute(
            update(CopilotThread).where(CopilotThread.id == self.thread_id).values(updated_at=datetime.now(UTC))
        )
        await self.db.commit()

    @property
    def sent_actions(self) -> list[Any]:
        return [e for e in self._all_events if getattr(e, "type", "") in {"confirm", "action_result"}]

    _all_events: list[CopilotEvent] = []  # noqa: RUF012

    # --- ciclo principal -------------------------------------------------------------------------

    async def go(self) -> AsyncGenerator[CopilotEvent, None]:
        self._all_events = []
        try:
            async with aclosing(self._body()) as events:
                async for event in events:
                    async for early in self._creative_title(wait=False):  # assim que estiver pronto, sem esperar
                        self._all_events.append(early)
                        yield early
                    self._all_events.append(event)
                    yield event
        except (asyncio.CancelledError, GeneratorExit):
            self._drop_title_task()
            with anyio.CancelScope(
                shield=True
            ):  # o cliente desligou: guardar o que houver e deixar o cancelamento seguir
                await self.db.rollback()
                await self._persist("cancelled", self._usage_dict())
            raise
        except Exception as exc:
            self._drop_title_task()
            if not isinstance(exc, AppError):
                log.exception("copilot stream failed")
            with anyio.CancelScope(shield=True):
                await self.db.rollback()
                await self._persist("error", self._usage_dict())
            message = exc.message if isinstance(exc, AppError) else "Unexpected server error"
            yield CopilotErrorEvent(code=_error_code(exc), message=message)
            yield CopilotDoneEvent(finish="error")

    def _drop_title_task(self) -> None:
        if self.title_task is not None and not self.title_task.done():
            self.title_task.cancel()
        self.title_task = None

    async def _creative_title(self, *, wait: bool) -> AsyncGenerator[CopilotEvent, None]:
        """Emite o título criativo quando o modelo o devolver. Falha ou título renomeado pelo utilizador: fica o provisório.

        Só toca na base de dados aqui (a sessão não é partilhável com a tarefa). Com `wait`, espera pouco: no fim do turno.
        """
        task = self.title_task
        if task is None or self.thread is None or not (wait or task.done()):
            return
        self.title_task = None
        try:
            new = await asyncio.wait_for(task, timeout=TITLE_WAIT_S) if wait else task.result()
        except Exception:  # inclui TimeoutError  # nunca estraga a resposta
            task.cancel()
            return
        if not new or new == self.provisional_title:
            return
        # Não renomeia o que o utilizador já renomeou: só atualiza se o título na BD ainda for o provisório.
        res = await self.db.execute(
            update(CopilotThread)
            .where(CopilotThread.id == self.thread.id, CopilotThread.title == self.provisional_title)
            .values(title=new, search_text=fold(new))
        )
        await self.db.commit()
        if res.rowcount:  # type: ignore[attr-defined]
            yield CopilotTitleEvent(title=new)

    def _usage_dict(self) -> dict[str, Any]:
        calls = list(getattr(self.llm, "usage", []))[self.usage0 :]
        costs = [c.cost_usd for c in calls if getattr(c, "cost_usd", None) is not None]
        prompt = sum(getattr(c, "prompt_tokens", 0) or 0 for c in calls)
        completion = sum(getattr(c, "completion_tokens", 0) or 0 for c in calls)
        searches = sum(getattr(c, "web_search_requests", 0) or 0 for c in calls)
        return {
            "web_search_requests": searches,
            "prompt_tokens": prompt,
            "completion_tokens": completion,
            "tokens": prompt + completion,
            "cost_usd": round(sum(costs), 6) if costs else None,
        }

    async def _attachments(self) -> list[CopilotAttachment]:
        ids = self.turn.attachment_ids
        if not ids:
            return []
        q = select(CopilotAttachment).where(CopilotAttachment.id.in_(ids), CopilotAttachment.user_id == self.user_id)
        by_id = {r.id: r for r in (await self.db.execute(q)).scalars()}
        return [by_id[i] for i in ids if i in by_id]

    async def _model_sees_images(self, model: str) -> bool:
        try:
            found = (await self.deps.catalog.snapshot()).models.get(model)
        except Exception:
            return False
        return bool(found and found.supports_image)

    async def _stored_messages(self) -> list[CopilotMessage]:
        assert self.thread_id is not None
        q = (
            select(CopilotMessage)
            .where(CopilotMessage.thread_id == self.thread_id)
            .order_by(CopilotMessage.created_at, CopilotMessage.id)
        )
        return list((await self.db.execute(q)).scalars().all())

    async def _recent_actions(self) -> list[str]:
        assert self.thread_id is not None
        q = (
            select(CopilotAction)
            .where(CopilotAction.thread_id == self.thread_id, CopilotAction.user_id == self.user_id)
            .order_by(CopilotAction.created_at.desc())
            .limit(5)
        )
        rows = list((await self.db.execute(q)).scalars())
        lines = []
        for a in rows:
            result = json.dumps(a.result, ensure_ascii=False, default=str)[:300] if a.result else ""
            lines.append(f"  [{a.status}] {a.type}: {a.summary[:120]} {result}")
            if a.result:
                self.extra_facts.append(a.result)
        return lines

    def _filter_memory(self, events: list[Any]) -> list[Any]:
        return [] if self.settings.memory_notifications == "off" else events

    async def _body(self) -> AsyncGenerator[CopilotEvent, None]:
        t = self.turn
        self.settings = await user_settings.load(self.db, self.user_id)
        self.web = web_service.WebSession(
            web_service.policy_for(self.user, self.settings), get_settings().web_search_max_calls
        )
        self.thread = await self._open_thread()
        attachments = await self._attachments()
        if not t.regenerate:
            await self._save_user_message(attachments)
        prior_results: dict[str, dict[str, Any]] = {}
        for m in await self._stored_messages():
            for tr in m.tool_trace:
                if tr.get("result_id") and isinstance(tr.get("result"), dict):
                    prior_results[tr["result_id"]] = tr["result"]
        self.tools = CopilotTools(
            self.db, self.user, self.llm, t.locale, settings=self.settings, thread_id=self.thread_id, message_id=self.message_id,
            confirmed=t.confirm, prior_results=prior_results, web=self.web,
        )  # fmt: skip
        self.model = self.llm.model_for(AiTask.COPILOT)
        yield CopilotStartEvent(
            thread_id=self.thread.id, message_id=self.message_id, model=self.model, prompt_version=self.prompt_version
        )
        if self.thread.title and not t.thread_id:
            self.thread.search_text = fold(self.thread.title)
            await self.db.commit()
            yield CopilotTitleEvent(title=self.thread.title)
            if t.user_text.strip() != "/compact" and not web_service.parse_command(t.user_text)[0]:
                self.provisional_title = self.thread.title
                self.title_task = asyncio.create_task(aux.make_title(self.llm, t.user_text))
        yield _status("thinking", "status.thinking")
        base, version = load("copilot")
        self.prompt_version = version
        snap = self.thread.snapshot or {}
        system = "\n\n".join([base, *[snap[k] for k in ("persona", "memory", "user") if snap.get(k)]])
        window = await memory.window_for(self.deps.catalog, self.model)

        is_websearch, wanted = web_service.parse_command(t.user_text)
        if is_websearch:
            async for ev in self._websearch_command(wanted, system, window):
                yield ev
            return

        if t.user_text.strip() == "/compact":
            yield _status("compacting", "status.compacting")
            done = await memory.compact_thread(self.db, self.llm, self.thread, force=True)
            self.text = (COMPACTED_TEXT if done else NOTHING_TO_COMPACT)[
                t.locale if t.locale in COMPACTED_TEXT else "pt-PT"
            ]
            yield CopilotTextDeltaEvent(delta=self.text)
            yield CopilotContextEvent(
                used_tokens=memory.count_tokens(system, self.thread.summary, [], ""),
                window_tokens=window,
                compacted=bool(done),
            )
            await self._persist("complete", self._usage_dict())
            yield CopilotDoneEvent()
            return

        if snap.get("memory") or snap.get("user"):
            self.recalled = True
            if self.settings.memory_notifications == "verbose":
                yield _status("thinking", "status.recalling_memory")
        stored = await self._stored_messages()
        prior = stored[:-1]
        can_see = await self._model_sees_images(self.model)
        recent_actions = await self._recent_actions()
        content, notices = self._current_content(attachments, can_see, self.thread, prior, recent_actions)
        for notice in notices:
            yield notice
        history = memory.history_messages(prior, self.thread.summarized_messages)
        images = sum(1 for a in attachments if a.kind == "image")
        used = memory.count_tokens(system, memory_text(self.thread, prior), history, str(content), images=images)
        compacted = False
        if used >= int(window * self.settings.auto_compact_pct / 100):
            yield _status("compacting", "status.compacting")
            compacted = bool(await memory.compact_thread(self.db, self.llm, self.thread))
            stored = await self._stored_messages()
            prior = stored[:-1]
            content, _ = self._current_content(attachments, can_see, self.thread, prior, recent_actions)
            history = memory.history_messages(prior, self.thread.summarized_messages)
            used = memory.count_tokens(system, memory_text(self.thread, prior), history, str(content))
        yield CopilotContextEvent(used_tokens=used, window_tokens=window, compacted=compacted)
        _, today_facts = web_service.today_line()
        self.extra_facts += [
            today_facts,
            *memory.recent_digests(prior),
            {"attachments": [a.preview for a in attachments], "meta": [a.meta for a in attachments]},
        ]

        messages: list[dict[str, Any]] = [*history, {"role": "user", "content": content}]
        async with aclosing(self._converse(system, messages, MAX_ROUNDS, self._forced_tool())) as converse:
            async for ev in converse:
                yield ev
        if self.server_dropped and self.text and not self.notice_sent:
            self.notice_sent = (
                True  # a pesquisa foi recusada a meio: avisa já, o utilizador não fica a supor que houve web
            )
            note = (
                "\n\n"
                + web_service.WEB_UNAVAILABLE_TEXT[
                    t.locale if t.locale in web_service.WEB_UNAVAILABLE_TEXT else "pt-PT"
                ]
            )
            self.text += note
            yield CopilotTextDeltaEvent(delta=note)
        if self.tools.end_turn_text is None:
            async with aclosing(self._verify(system, messages)) as verify:
                async for ev in verify:
                    yield ev
        else:
            self.verified = True  # pergunta de clarificação: sem números
            yield CopilotVerificationEvent(verified=True, warning=None)

        ok = bool(self.verified)
        sources = self._sources(attachments)
        if ok and sources:
            yield CopilotSourcesEvent(items=sources)
        if ok and self.text and self.settings.follow_up_suggestions and self.tools.end_turn_text is None:
            yield _status("writing", "status.suggesting")
            yield CopilotSuggestionsEvent(
                items=await aux.make_suggestions(
                    self.llm, t.locale, t.user_text, self.text, [x["name"] for x in self.trace]
                )
            )
        # revisão de memória em segundo plano (barata, só de vez em quando; nunca em conversas efémeras)
        if ok and self.text:
            stored = await self._stored_messages()
            if review.due(self.settings, self.thread, stored):
                yield _status("thinking", "status.reviewing_memory")
                for ev in self._filter_memory(
                    await review.run(self.db, self.llm, self.user_id, self.thread, self.settings, stored, self.text)
                ):
                    yield ev
        async for ev in self._creative_title(wait=True):
            yield ev
        usage = self._usage_dict()
        await self._persist("complete", usage)
        yield CopilotUsageEvent(
            **{k: usage[k] for k in ("prompt_tokens", "completion_tokens", "tokens", "cost_usd", "web_search_requests")}
        )
        yield CopilotContextEvent(
            used_tokens=used + memory.estimate_tokens(self.text), window_tokens=window, compacted=compacted
        )
        yield CopilotDoneEvent()

    def _forced_tool(self) -> str | None:
        """Pedidos explícitos de lembrar/esquecer têm de chamar `memory` (senão o modelo diz que guardou sem guardar)."""
        s = self.settings
        if (s.memory_enabled or s.user_profile_enabled) and _MEMORY_CUE.search(self.turn.user_text):
            return "memory"
        return None

    def _sources(self, attachments: list[CopilotAttachment]) -> list[CopilotSource]:
        out: list[CopilotSource] = []
        seen: set[str] = set()

        def add(kind: str, label: str, ref: str | None = None) -> None:
            if label not in seen:
                seen.add(label)
                out.append(CopilotSource(kind=kind, label=label, ref=ref))

        for tr in self.trace:
            if tr["ok"]:
                add("tool", tr["name"])
        for c in self.tools.cards.values():
            add("scenario", c.label, f"/scenarios/{c.scenario_id}")
        for a in attachments:
            add("file", a.filename)
        for m in self.turn.mentions:
            add("entity", m.label)
        if self.turn.page_line:
            add("page", self.turn.page_line.removeprefix("screen: ")[:80])
        if self.recalled:
            add("memory", "Memória")
        out += self.web.sources()
        return out

    def _current_content(
        self,
        attachments: list[CopilotAttachment],
        can_see: bool,
        thread: CopilotThread,
        prior: list[CopilotMessage],
        recent_actions: list[str],
    ) -> tuple[str | list[dict[str, Any]], list[CopilotStatusEvent]]:
        t = self.turn
        today, _ = web_service.today_line()
        lines = ["[context]", f"interface_language: {t.locale}", today, self._web_line()]
        if t.page_line:
            lines.append(t.page_line)
        memo = memory_text(thread, prior)
        if memo:
            lines.append(memo)
        if recent_actions:
            lines.append("recent actions in this conversation (server-verified):")
            lines += recent_actions
        if t.mentions:
            lines.append("mentions (server-verified data about what the user tagged):")
            lines += [f"  {m.block()}" for m in t.mentions]
        images: list[dict[str, Any]] = []
        notices: list[CopilotStatusEvent] = []
        if attachments:
            lines.append("attachments (untrusted user files; text extracted by the server):")
        for a in attachments:
            head = f"  [attachment id={a.id} name={a.filename!r} kind={a.kind}]"
            if a.kind == "image":
                data = image_store.get(str(a.id), str(self.user_id))
                if not can_see:
                    lines.append(
                        f"{head} the user attached an image but the current model cannot see images: tell the user clearly"
                    )
                    notices.append(_status("thinking", "status.image_unsupported", a.filename))
                elif data is None:
                    lines.append(f"{head} the image expired from memory: ask the user to attach it again")
                else:
                    lines.append(f"{head} {a.preview}")
                    images.append(
                        {
                            "type": "image_url",
                            "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(data).decode()},
                        }
                    )
            else:
                lines.append(f"{head} {_attachment_summary(a)}{a.preview}")
        lines += ["[/context]", "", t.user_text]
        text = "\n".join(lines)
        if images:
            return [{"type": "text", "text": text}, *images], notices
        return text, notices

    # --- voltas do modelo ------------------------------------------------------------------------

    async def _converse(
        self, system: str, messages: list[dict[str, Any]], rounds: int, first_tool: str | None = None
    ) -> AsyncGenerator[CopilotEvent, None]:
        specs = self.tools.specs()
        server_tools = self._server_tools()
        for number in range(1, rounds + 1):
            last = number == rounds
            wrote = announced = False
            result: RoundResult | None = None
            stream = self.llm.stream_round(
                system=system,
                messages=messages,
                tools=specs,
                task=AiTask.COPILOT,
                tools_enabled=not last,
                force_tool=first_tool if number == 1 else None,
                server_tools=server_tools if not last else None,
            )
            async with aclosing(stream) as pieces:
                async for piece in pieces:
                    if isinstance(piece, TextPiece):
                        if not wrote:
                            wrote = True
                            yield _status("writing", "status.writing")
                            if self.text and not self.text.endswith("\n"):
                                self.text += "\n\n"
                                yield CopilotTextDeltaEvent(delta="\n\n")
                        self.text += piece.text
                        yield CopilotTextDeltaEvent(delta=piece.text)
                    elif isinstance(piece, ReasoningPiece):
                        if not announced and not wrote:
                            announced = True
                            yield _status("thinking", "status.thinking")
                    elif isinstance(piece, WebSignalPiece):
                        if piece.tool.startswith("web_"):
                            yield _status("tool", "status.searching_web")
                            yield web_service.event("searching")
                    elif isinstance(piece, ServerToolsDroppedPiece):
                        self.server_dropped = self.web.unavailable = True
                        yield web_service.event(
                            "unavailable", reason="region" if piece.reason.endswith("403") else "provider_rejected"
                        )
                    else:
                        result = piece
            if result is None:
                return
            self.model = result.model
            if result.citations or result.web_search_requests:
                self.web.add(result.citations)
                self.web.requests += result.web_search_requests
                yield web_service.event("done", results=len(result.citations), requests=result.web_search_requests)
            if not result.tool_calls or last:
                messages.append({"role": "assistant", "content": result.text})
                return
            messages.append(
                {
                    "role": "assistant", "content": result.text or None,
                    "tool_calls": [{"id": c.id, "type": "function", "function": {"name": c.name, "arguments": c.arguments}} for c in result.tool_calls],
                }
            )  # fmt: skip
            yield _status("planning", "status.planning")
            for call in result.tool_calls:
                async with aclosing(self._run_tool(call, messages)) as events:
                    async for ev in events:
                        yield ev
            if self.tools.end_turn_text:
                self.text = (self.text + "\n\n" if self.text else "") + self.tools.end_turn_text
                yield CopilotTextDeltaEvent(delta=self.tools.end_turn_text)
                return

    async def _run_tool(self, call: Any, messages: list[dict[str, Any]]) -> AsyncGenerator[CopilotEvent, None]:
        yield _status("tool", STATUS_KEYS.get(call.name, "status.working"), status_detail(call.name, call.arguments))
        if self.settings.show_tool_steps:
            yield CopilotToolStartEvent(id=call.id, name=call.name, args_summary=args_summary(call.arguments))
        outcome = await self.tools.run(call.name, call.arguments)
        if self.settings.show_tool_steps:
            yield CopilotToolResultEvent(
                id=call.id,
                name=call.name,
                ok=outcome.ok,
                summary=outcome.summary[:200],
                duration_ms=outcome.duration_ms,
            )
        entry: dict[str, Any] = {
            "name": call.name,
            "ok": outcome.ok,
            "summary": outcome.summary[:200],
            "digest": self.tools.digests[-1] if outcome.ok and self.tools.digests else None,
        }
        if outcome.result_id and outcome.table is not None:
            full = self.tools.results[outcome.result_id]
            entry |= {"result_id": outcome.result_id, "result": _cap_result(full)}
        self.trace.append(entry)
        for ev in self.tools.drain_events():
            yield ev
        for mev in self._filter_memory(self.tools.drain_memory_events()):
            yield mev
        for card_id, card in list(self.tools.cards.items()):
            if card_id not in self.emitted_cards:
                self.emitted_cards.add(card_id)
                yield CopilotCardEvent(card=card)
        messages.append(
            {
                "role": "tool",
                "tool_call_id": call.id,
                "content": json.dumps(outcome.result, ensure_ascii=False, default=str)[:TOOL_RESULT_CHARS],
            }
        )

    async def _verify(self, system: str, messages: list[dict[str, Any]]) -> AsyncGenerator[CopilotEvent, None]:
        yield _status("verifying", "status.verifying_numbers")
        bad = self._unsupported([*self.tools.facts, *self.extra_facts])
        if bad:
            log.info("copilot answer failed number check numbers=%s; rewriting once", sorted(bad))
            log.debug("rejected text (debug only): %s", self.text[:600].replace("\n", " "))
            if self.text:
                yield CopilotRetractEvent()
            self.text = ""
            numbers = ", ".join(str(n) for n in sorted(bad) if n >= 0) or "(empty answer)"
            messages.append({"role": "user", "content": REWRITE.format(numbers=numbers)})
            async with aclosing(self._converse(system, messages, REWRITE_ROUNDS)) as rewrite:
                async for ev in rewrite:
                    yield ev
            yield _status("verifying", "status.verifying_numbers")
            bad = self._unsupported([*self.tools.facts, *self.extra_facts])
        if bad:
            if self.text:
                yield CopilotRetractEvent()
            self.text = WARNING_TEXT[self.turn.locale if self.turn.locale in WARNING_TEXT else "pt-PT"]
            yield CopilotTextDeltaEvent(delta=self.text)
            self.verified = False
            yield CopilotVerificationEvent(verified=False, warning="numbers_unverified")
            return
        self.verified = True
        yield CopilotVerificationEvent(verified=True, warning=None, external_numbers=sorted(self.external_numbers))

    def _unsupported(self, facts: list[Any]) -> set[float]:
        if not self.text.strip():
            return {-1.0}
        check = check_numbers(self.text, facts, self.web.excerpts, also_allowed=self.turn.user_text)
        self.external_numbers = check.external
        return check.unsupported

    def _web_line(self) -> str:
        p = self.web.policy
        if p.search:
            how = "tool web_search" if get_settings().web_search_mode == "tool" else "server tool"
            return f"web_search: on ({how}; only for external context, never for Novelo data; web figures are 'fonte externa')"
        return f"web_search: off ({p.reason}); do not claim to have searched the web"

    def _server_tools(self) -> ServerTools | None:
        """Server tools do OpenRouter deste pedido: pesquisa (modo inline) e leitura de links que o utilizador escreveu."""
        cfg = get_settings()
        if not self.web.policy.search:
            return None
        inline = cfg.web_search_mode == "inline"
        tools = server_tools_from(cfg, search=inline, fetch=True)
        allowed = self._fetch_domains(cfg.domains(cfg.web_fetch_allowed_domains)) if tools.web_fetch else ()
        tools = replace(
            tools,
            web_fetch=bool(allowed),
            fetch_allowed=allowed,
            datetime=tools.datetime and inline,
            web_search=tools.web_search and inline,
        )
        return tools if tools.any else None

    def _fetch_domains(self, configured: list[str]) -> tuple[str, ...]:
        """Só se lê o que o utilizador colou (https) e, se houver lista configurada, só dos domínios permitidos."""
        domains = {domain_of(u) for u in user_urls(self.turn.user_text)}
        if configured:
            domains = {d for d in domains if any(d == c or d.endswith("." + c) for c in configured)}
        return tuple(sorted(d for d in domains if d))

    async def _websearch_command(
        self, wanted: str | None, system: str, window: int
    ) -> AsyncGenerator[CopilotEvent, None]:
        """`/websearch on|off`: muda a preferência do utilizador sem chamar o modelo."""
        locale = self.turn.locale if self.turn.locale in web_service.WEBSEARCH_REPLY else "pt-PT"
        texts = web_service.WEBSEARCH_REPLY[locale]
        reason = web_service.policy_for(self.user, CopilotSettings()).reason
        if wanted is None:
            current = web_service.policy_for(self.user, self.settings)
            text = (
                texts["usage"]
                if self.turn.user_text.strip().lower() != "/websearch"
                else (texts[reason] if reason else texts["status_on" if current.search else "status_off"])
            )
        elif reason:
            text = texts[reason]
        else:
            await user_settings.save(self.db, self.user_id, self.settings.model_copy(update={"web_search": wanted}))
            text = texts["on" if wanted == "auto" else "off"]
        self.text = text
        yield CopilotTextDeltaEvent(delta=text)
        yield CopilotContextEvent(
            used_tokens=memory.count_tokens(system, "", [], ""), window_tokens=window, compacted=False
        )
        self.verified = True
        await self._persist("complete", self._usage_dict())
        yield CopilotDoneEvent()


def _attachment_summary(a: CopilotAttachment) -> str:
    """Uma frase com o que foi extraído, para o modelo não duvidar de que há conteúdo (ex.: PDF de poucas linhas)."""
    m = a.meta
    if a.kind == "pdf":
        return f"(PDF, {m.get('pages', '?')} page(s), {m.get('chars', 0)} characters of extracted text) "
    if a.kind == "text":
        return f"({m.get('chars', 0)} characters of text, {m.get('lines', '?')} lines) "
    if a.kind == "table":
        return f"(table with {m.get('rows', '?')} rows and {m.get('columns', '?')} columns; summary) "
    return ""


def memory_text(thread: CopilotThread, prior: list[CopilotMessage]) -> str:
    return memory.memo_block(thread, memory.recent_digests(prior))


async def stream_turn(
    deps: StreamDeps, user_id: uuid.UUID, turn: PreparedTurn, impersonation: ImpersonationInfo | None = None
) -> AsyncGenerator[CopilotEvent, None]:
    """Gerador de eventos de um pedido. Abre a sua própria sessão (vive tanto como o stream).
    `impersonation` vem do pedido HTTP: esta sessão nova não o sabe, e as ações críticas dependem dele."""
    async with deps.session_factory() as db:
        user = await db.get(User, user_id)
        if user is None:
            yield CopilotErrorEvent(code="unauthenticated", message="Account no longer exists")
            yield CopilotDoneEvent(finish="error")
            return
        user.impersonation = impersonation
        try:
            llm = await deps.make_llm(db, user)
        except (AiBudgetExceededError, FeatureDisabledError) as exc:
            yield CopilotErrorEvent(code=exc.code, message=exc.message)
            yield CopilotDoneEvent(finish="error")
            return
        try:
            async with aclosing(_Run(deps, db, user, llm, turn).go()) as events:
                async for event in events:
                    yield event
        finally:
            with anyio.CancelScope(shield=True):
                await llm.aclose()
