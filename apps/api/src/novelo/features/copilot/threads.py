"""Conversas do copiloto: listar, pesquisar, ler, atualizar, apagar, partilhar, exportar, feedback e preparação de cada pedido."""

import html
import secrets
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.openrouter import OpenRouterClient
from novelo.ai.catalog import ModelCatalog
from novelo.ai.prompts import load
from novelo.ai.tasks import AiTask
from novelo.core.config import get_settings
from novelo.core.errors import AppError, NotFoundError
from novelo.features.ai_admin import service as ai_admin
from novelo.features.copilot import actions as action_service
from novelo.features.copilot import memory, sessions
from novelo.features.copilot import mentions as mention_service
from novelo.features.copilot.agent import PreparedTurn
from novelo.features.copilot.models import (
    CopilotAction,
    CopilotArtifact,
    CopilotAttachment,
    CopilotFeedback,
    CopilotMessage,
    CopilotThread,
)
from novelo.features.copilot.pagecontext import page_context_line
from novelo.features.copilot.schemas import (
    ArtifactEnvelope,
    AttachmentOut,
    CompactOut,
    CopilotSource,
    CopilotStreamRequest,
    FeedbackIn,
    FeedbackOut,
    MentionRef,
    MentionType,
    MessageOut,
    ProjectOut,
    ScenarioCard,
    ShareOut,
    ThreadExport,
    ThreadOut,
    ThreadPage,
    ThreadSummaryOut,
    ThreadUpdate,
    ToolTraceOut,
)
from novelo.features.copilot.schemas_artifacts import ArtifactSource
from novelo.features.copilot.tables import fold
from novelo.features.users.models import User


class ThreadNotFoundError(NotFoundError):
    pass


async def owned_thread(db: AsyncSession, user: User, thread_id: uuid.UUID) -> CopilotThread:
    thread = await db.get(CopilotThread, thread_id)
    if thread is None or thread.user_id != user.id:  # 404 igual nos dois casos: não revela conversas alheias
        raise ThreadNotFoundError("Thread not found")
    return thread


def attachment_out(a: CopilotAttachment, can_see: bool = True) -> AttachmentOut:
    return AttachmentOut(
        id=a.id, kind=a.kind, filename=a.filename, mime=a.mime, size_bytes=a.size_bytes,
        preview=a.preview, meta=a.meta, model_can_see=can_see or a.kind != "image",
    )  # fmt: skip


async def _counts(db: AsyncSession, ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not ids:
        return {}
    q = (
        select(CopilotMessage.thread_id, func.count())
        .where(CopilotMessage.thread_id.in_(ids))
        .group_by(CopilotMessage.thread_id)
    )
    return {tid: n for tid, n in (await db.execute(q)).all()}


def _summary(t: CopilotThread, count: int, snippet: str | None = None) -> ThreadSummaryOut:
    return ThreadSummaryOut(
        id=t.id, title=t.title or "", archived=t.archived, pinned=t.pinned, project=t.project, ephemeral=t.ephemeral,
        shared=bool(t.share_token), parent_thread_id=t.parent_thread_id, snippet=snippet, message_count=count,
        has_summary=bool(t.summary), created_at=t.created_at, updated_at=t.updated_at,
    )  # fmt: skip


async def list_threads(
    db: AsyncSession,
    user: User,
    offset: int,
    limit: int,
    archived: bool,
    q: str | None = None,
    pinned: bool | None = None,
    project: str | None = None,
) -> ThreadPage:
    base = select(CopilotThread).where(
        CopilotThread.user_id == user.id, CopilotThread.archived.is_(archived), CopilotThread.ephemeral.is_(False)
    )
    if pinned is not None:
        base = base.where(CopilotThread.pinned.is_(pinned))
    if project is not None:
        base = base.where(CopilotThread.project == project)
    fts = sessions.fts_query(q or "")
    if q and fts:
        match = text("to_tsvector('simple', copilot_messages.search_text) @@ to_tsquery('simple', :q)").bindparams(
            q=fts
        )
        hit = select(CopilotMessage.thread_id).where(match).scalar_subquery()
        title_hit = CopilotThread.search_text.ilike(f"%{fold(q).strip()}%")
        base = base.where(or_(CopilotThread.id.in_(hit), title_hit))
    total = await db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = (
        (
            await db.execute(
                base.order_by(CopilotThread.pinned.desc(), CopilotThread.updated_at.desc(), CopilotThread.id.desc())
                .offset(offset)
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    counts = await _counts(db, [t.id for t in rows])
    items = []
    for t in rows:
        last = (
            await db.execute(
                select(CopilotMessage)
                .where(CopilotMessage.thread_id == t.id)
                .order_by(CopilotMessage.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        items.append(_summary(t, counts.get(t.id, 0), memory.message_text(last)[:120] if last else None))
    return ThreadPage(items=items, total=total, offset=offset, limit=limit)


async def projects(db: AsyncSession, user: User) -> list[ProjectOut]:
    q = (
        select(CopilotThread.project, func.count())
        .where(CopilotThread.user_id == user.id, CopilotThread.project != "", CopilotThread.ephemeral.is_(False))
        .group_by(CopilotThread.project)
        .order_by(CopilotThread.project)
    )
    return [ProjectOut(name=n, threads=c) for n, c in (await db.execute(q)).all()]


async def _messages(db: AsyncSession, thread_id: uuid.UUID) -> list[CopilotMessage]:
    q = (
        select(CopilotMessage)
        .where(CopilotMessage.thread_id == thread_id)
        .order_by(CopilotMessage.created_at, CopilotMessage.id)
    )
    return list((await db.execute(q)).scalars().all())


def _part_ids(m: CopilotMessage, kind: str) -> list[uuid.UUID]:
    return [uuid.UUID(p["id"]) for p in m.parts if p.get("type") == kind]


def _message_out(
    m: CopilotMessage, ratings: dict[uuid.UUID, int], atts: dict[uuid.UUID, CopilotAttachment],
    arts: dict[uuid.UUID, CopilotArtifact], acts: dict[uuid.UUID, CopilotAction],
) -> MessageOut:  # fmt: skip
    from novelo.features.copilot import charts  # noqa: PLC0415

    rating = ratings.get(m.id)
    return MessageOut(
        id=m.id,
        role=m.role,
        text=memory.message_text(m),
        attachments=[attachment_out(atts[i]) for i in _part_ids(m, "attachment") if i in atts],
        mentions=[
            MentionRef(type=MentionType(p["mention_type"]), id=p["id"]) for p in m.parts if p.get("type") == "mention"
        ],
        tools=[
            ToolTraceOut(name=t["name"], ok=bool(t.get("ok")), summary=str(t.get("summary", ""))) for t in m.tool_trace
        ],
        cards=[ScenarioCard.model_validate(c) for c in m.cards],
        artifacts=[
            ArtifactEnvelope(
                id=arts[i].id,
                title=arts[i].title,
                sources=[ArtifactSource(**s) for s in arts[i].sources],
                artifact=charts.validate_artifact(arts[i].artifact_type, arts[i].spec),
            )
            for i in _part_ids(m, "artifact")
            if i in arts
        ],
        actions=[action_service.to_out(acts[i]) for i in _part_ids(m, "action") if i in acts],
        web_sources=[
            CopilotSource(
                kind="web",
                label=p["label"],
                ref=p["url"],
                domain=p.get("domain"),
                excerpt=p.get("excerpt"),
                external=True,
            )
            for p in m.parts
            if p.get("type") == "web_source"
        ],
        verified=m.verified,
        status=m.status,
        model=m.model,
        tokens=m.usage.get("tokens") if m.usage else None,
        cost_usd=m.usage.get("cost_usd") if m.usage else None,
        feedback=rating if rating in (1, -1) else None,
        created_at=m.created_at,
    )


async def copilot_model(db: AsyncSession) -> str:
    row = await ai_admin.get_row(db)
    return ai_admin.resolve_task(row, get_settings(), AiTask.COPILOT).model


async def _thread_out(
    db: AsyncSession, thread: CopilotThread, viewer: User, catalog: ModelCatalog, read_only: bool = False
) -> ThreadOut:
    messages = await _messages(db, thread.id)
    ids = [m.id for m in messages]
    ratings: dict[uuid.UUID, int] = {}
    if not read_only and ids:
        ratings = {
            r.message_id: r.rating
            for r in (
                await db.execute(
                    select(CopilotFeedback).where(
                        CopilotFeedback.user_id == viewer.id, CopilotFeedback.message_id.in_(ids)
                    )
                )
            ).scalars()
        }
    att_ids = [i for m in messages for i in _part_ids(m, "attachment")]
    art_ids = [i for m in messages for i in _part_ids(m, "artifact")]
    act_ids = [i for m in messages for i in _part_ids(m, "action")]
    atts = (
        {
            a.id: a
            for a in (await db.execute(select(CopilotAttachment).where(CopilotAttachment.id.in_(att_ids)))).scalars()
        }
        if att_ids
        else {}
    )
    arts = (
        {a.id: a for a in (await db.execute(select(CopilotArtifact).where(CopilotArtifact.id.in_(art_ids)))).scalars()}
        if art_ids
        else {}
    )
    acts = (
        {a.id: a for a in (await db.execute(select(CopilotAction).where(CopilotAction.id.in_(act_ids)))).scalars()}
        if act_ids
        else {}
    )
    system, _ = load("copilot")
    history = memory.history_messages(messages, thread.summarized_messages)
    used = memory.count_tokens(system, memory.memo_block(thread, memory.recent_digests(messages)), history, "")
    window = await memory.window_for(catalog, await copilot_model(db))
    return ThreadOut(
        **_summary(thread, len(messages)).model_dump(), summary=thread.summary,
        messages=[_message_out(m, ratings, atts, arts, acts) for m in messages], used_tokens=used, window_tokens=window,
    )  # fmt: skip


async def get_thread(db: AsyncSession, user: User, thread_id: uuid.UUID, catalog: ModelCatalog) -> ThreadOut:
    return await _thread_out(db, await owned_thread(db, user, thread_id), user, catalog)


async def get_shared(db: AsyncSession, viewer: User, token: str, catalog: ModelCatalog) -> ThreadOut:
    """Leitura de uma conversa partilhada por link: qualquer utilizador autenticado, só leitura, sem feedback do dono."""
    thread = (await db.execute(select(CopilotThread).where(CopilotThread.share_token == token))).scalar_one_or_none()
    if thread is None:
        raise ThreadNotFoundError("Shared conversation not found")
    out = await _thread_out(db, thread, viewer, catalog, read_only=True)
    # quem recebe o link lê a conversa, não os ficheiros nem as ações de quem a partilhou
    messages = [
        m.model_copy(
            update={
                "attachments": [],
                "actions": [],
                "mentions": [],
                "feedback": None,
                "cost_usd": None,
                "tokens": None,
            }
        )
        for m in out.messages
    ]
    return out.model_copy(update={"summary": "", "messages": messages})


async def share(db: AsyncSession, user: User, thread_id: uuid.UUID) -> ShareOut:
    thread = await owned_thread(db, user, thread_id)
    if thread.ephemeral:
        raise AppError("Ephemeral conversations cannot be shared")
    thread.share_token = thread.share_token or secrets.token_urlsafe(24)
    await db.commit()
    return ShareOut(token=thread.share_token, path=f"/chat/shared/{thread.share_token}")


async def unshare(db: AsyncSession, user: User, thread_id: uuid.UUID) -> None:
    thread = await owned_thread(db, user, thread_id)
    thread.share_token = None
    await db.commit()


async def update(db: AsyncSession, user: User, thread_id: uuid.UUID, body: ThreadUpdate) -> ThreadSummaryOut:
    thread = await owned_thread(db, user, thread_id)
    if body.title is not None:
        thread.title = body.title.strip()
        thread.search_text = fold(thread.title)
    if body.pinned is not None:
        thread.pinned = body.pinned
    if body.archived is not None:
        thread.archived = body.archived
    if body.project is not None:
        thread.project = body.project.strip()
    await db.commit()
    await db.refresh(thread)  # updated_at é calculado pela base de dados
    return _summary(thread, (await _counts(db, [thread.id])).get(thread.id, 0))


async def delete(db: AsyncSession, user: User, thread_id: uuid.UUID) -> None:
    """Apaga a conversa e o histórico derivado: mensagens e artefactos (cascata), anexos usados e memórias nela criadas ficam só se o utilizador as geriu."""
    thread = await owned_thread(db, user, thread_id)
    for aid in {i for m in await _messages(db, thread.id) for i in _part_ids(m, "attachment")}:
        att = await db.get(CopilotAttachment, aid)
        if att is not None and att.user_id == user.id:
            await db.delete(att)
    await db.delete(thread)
    await db.commit()


async def compact(
    db: AsyncSession, llm: OpenRouterClient, user: User, thread_id: uuid.UUID, catalog: ModelCatalog
) -> CompactOut:
    thread = await owned_thread(db, user, thread_id)
    done = await memory.compact_thread(db, llm, thread, force=True)
    out = await get_thread(db, user, thread_id, catalog)
    return CompactOut(
        thread=ThreadSummaryOut(**out.model_dump(include=set(ThreadSummaryOut.model_fields))),
        compacted_messages=done, summary=thread.summary, used_tokens=out.used_tokens, window_tokens=out.window_tokens,
    )  # fmt: skip


async def set_feedback(db: AsyncSession, user: User, message_id: uuid.UUID, body: FeedbackIn) -> FeedbackOut:
    message = await db.get(CopilotMessage, message_id)
    if message is None or message.role != "assistant":
        raise NotFoundError("Message not found")
    await owned_thread(db, user, message.thread_id)
    q = select(CopilotFeedback).where(CopilotFeedback.message_id == message_id, CopilotFeedback.user_id == user.id)
    existing = (await db.execute(q)).scalar_one_or_none()
    if existing is None:
        db.add(CopilotFeedback(message_id=message_id, user_id=user.id, rating=body.rating, comment=body.comment))
    else:
        existing.rating, existing.comment = body.rating, body.comment
    await db.commit()
    return FeedbackOut(message_id=message_id, rating=body.rating)


def _markdown(thread: CopilotThread, messages: list[CopilotMessage]) -> str:
    lines = [f"# {thread.title or 'Copilot'}", ""]
    if thread.summary:
        lines += [f"> {thread.summary}", ""]
    for m in messages:
        who = "Utilizador" if m.role == "user" else "Copiloto"
        lines += [f"**{who}** ({m.created_at:%d/%m/%Y %H:%M})", "", memory.message_text(m), ""]
        for c in m.cards:
            k = c.get("kpis", {})
            lines.append(f"- Cenário «{c.get('label')}»: {k.get('tonnes_year')} t/ano, {k.get('eur_per_tonne')} €/t")
        lines.append("")
    return "\n".join(lines)


async def export(db: AsyncSession, user: User, thread_id: uuid.UUID) -> ThreadExport:
    thread = await owned_thread(db, user, thread_id)
    stamp = datetime.now(UTC).strftime("%Y%m%d")
    return ThreadExport(
        filename=f"copilot-{stamp}-{str(thread.id)[:8]}.md", markdown=_markdown(thread, await _messages(db, thread.id))
    )


def markdown_to_html(md: str) -> str:
    """Conversão mínima e segura (tudo escapado) para o PDF da conversa."""
    out = []
    for block in md.split("\n\n"):
        esc = html.escape(block)
        if block.startswith("# "):
            out.append(f"<h1>{html.escape(block[2:])}</h1>")
        elif block.startswith("> "):
            out.append(f"<blockquote>{html.escape(block[2:])}</blockquote>")
        else:
            out.append("<p>" + esc.replace("\n", "<br>").replace("**", "") + "</p>")
    return (
        "<html><meta charset='utf-8'><style>body{font:11pt Inter,sans-serif;margin:20mm}h1{font:500 20pt serif}blockquote{color:#555;border-left:3px solid #ccc;padding-left:8px}</style><body>"
        + "".join(out)
        + "</body></html>"
    )


async def export_pdf(db: AsyncSession, user: User, thread_id: uuid.UUID) -> tuple[str, bytes]:
    from starlette.concurrency import run_in_threadpool  # noqa: PLC0415

    from novelo.features.reports.builder import _render_pdf  # noqa: PLC0415

    ex = await export(db, user, thread_id)
    return ex.filename.replace(".md", ".pdf"), await run_in_threadpool(_render_pdf, markdown_to_html(ex.markdown))


async def prepare_turn(db: AsyncSession, user: User, req: CopilotStreamRequest) -> PreparedTurn:
    """Valida tudo o que pode falhar com um erro HTTP normal antes de abrir o stream."""
    if req.thread_id:
        await owned_thread(db, user, req.thread_id)
    if req.edit_message_id:
        if not req.thread_id:
            raise AppError("edit_message_id needs thread_id")
        msg = await db.get(CopilotMessage, req.edit_message_id)
        if msg is None or msg.thread_id != req.thread_id or msg.role != "user":
            raise NotFoundError("Message not found")
    resolved = [await mention_service.resolve(db, user, ref, req.locale) for ref in req.mentions]
    for att_id in req.attachment_ids:
        att = await db.get(CopilotAttachment, att_id)
        if att is None or att.user_id != user.id:
            raise NotFoundError("Attachment not found")
    line, facts = await page_context_line(db, user, req.page_context, req.locale)
    return PreparedTurn(
        user_text=req.message.strip(), locale=req.locale, thread_id=req.thread_id, mention_refs=list(req.mentions), mentions=resolved,
        attachment_ids=list(req.attachment_ids), page_line=line, page_facts=facts, confirm=req.confirm, edit_message_id=req.edit_message_id,
    )  # fmt: skip


async def prepare_regenerate(db: AsyncSession, user: User, thread_id: uuid.UUID, locale: str) -> PreparedTurn:
    thread = await owned_thread(db, user, thread_id)
    messages = await _messages(db, thread.id)
    last_user = next((m for m in reversed(messages) if m.role == "user"), None)
    if last_user is None:
        raise AppError("There is nothing to regenerate")
    refs = [
        MentionRef(type=MentionType(p["mention_type"]), id=p["id"])
        for p in last_user.parts
        if p.get("type") == "mention"
    ]
    resolved = [await mention_service.resolve(db, user, r, locale) for r in refs]
    return PreparedTurn(
        user_text=memory.message_text(last_user), locale=locale, thread_id=thread.id, mention_refs=refs, mentions=resolved,
        attachment_ids=_part_ids(last_user, "attachment"), regenerate=True,
    )  # fmt: skip


async def timeline(db: AsyncSession, user: User, thread_id: uuid.UUID) -> list[Any]:
    from novelo.features.copilot import history  # noqa: PLC0415

    return await history.thread_timeline(db, await owned_thread(db, user, thread_id))
