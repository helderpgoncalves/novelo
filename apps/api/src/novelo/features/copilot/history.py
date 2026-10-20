"""Histórico unificado do copiloto: cronologia de conversas, ações, artefactos, memórias e anexos; galeria; auditoria."""

import base64
import json
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import and_, or_, select, text, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.errors import AppError, ConflictError, NotFoundError
from novelo.features.copilot import actions, charts, sessions
from novelo.features.copilot.memory import message_text
from novelo.features.copilot.models import (
    CopilotAction,
    CopilotArtifact,
    CopilotAttachment,
    CopilotMemoryEntry,
    CopilotMemoryPending,
    CopilotMessage,
    CopilotThread,
)
from novelo.features.copilot.schemas_actions import ActionPage
from novelo.features.copilot.schemas_history import (
    ArtifactOut,
    ArtifactPage,
    HistoryItem,
    HistoryKind,
    HistoryPage,
    TimelineEvent,
)
from novelo.features.copilot.tables import fold
from novelo.features.users.models import User

RANK: dict[str, int] = {"conversation": 5, "action": 4, "artifact": 3, "memory": 2, "attachment": 1}
ALL_KINDS: tuple[HistoryKind, ...] = ("conversation", "action", "artifact", "memory", "attachment")


class BadCursorError(AppError):
    status_code = 400
    code = "bad_request"


def encode_cursor(at: datetime, rank: int, ident: str) -> str:
    return base64.urlsafe_b64encode(json.dumps([at.isoformat(), rank, ident]).encode()).decode()


def decode_cursor(raw: str | None) -> tuple[datetime, int, str] | None:
    if not raw:
        return None
    try:
        at, rank, ident = json.loads(base64.urlsafe_b64decode(raw.encode()))
        return datetime.fromisoformat(at), int(rank), str(ident)
    except (ValueError, TypeError) as exc:
        raise BadCursorError("Invalid cursor") from exc


def _terms(q: str | None) -> list[str]:
    return [t for t in fold(q or "").split(" ") if t][:6]


def _after(stmt: Any, at_col: Any, id_col: Any, rank: int, cur: tuple[datetime, int, str] | None) -> Any:
    """Só linhas estritamente depois do cursor, na ordem global (instante, tipo, id) decrescente."""
    if cur is None:
        return stmt
    t, crank, cid = cur
    if rank > crank:
        return stmt.where(at_col < t)
    if rank < crank:
        return stmt.where(at_col <= t)
    return stmt.where(tuple_(at_col, id_col) < tuple_(t, uuid.UUID(cid)))


def _like(col: Any, terms: list[str]) -> list[Any]:
    return [col.ilike(f"%{t}%") for t in terms]


def _range(stmt: Any, at_col: Any, since: datetime | None, until: datetime | None) -> Any:
    if since:
        stmt = stmt.where(at_col >= since)
    if until:
        stmt = stmt.where(at_col <= until)
    return stmt


@dataclass
class Q:
    db: AsyncSession
    user: User
    cur: tuple[datetime, int, str] | None
    terms: list[str]
    q: str | None
    since: datetime | None
    until: datetime | None
    status: str | None
    fetch: int


Row = tuple[datetime, int, str, HistoryItem]


async def _conversations(c: Q) -> list[Row]:
    if c.status not in (None, "active", "archived"):
        return []
    stmt = select(CopilotThread).where(CopilotThread.user_id == c.user.id, CopilotThread.ephemeral.is_(False))
    if c.status:
        stmt = stmt.where(CopilotThread.archived.is_(c.status == "archived"))
    if c.terms:
        fts = sessions.fts_query(c.q or "")
        match = text("to_tsvector('simple', copilot_messages.search_text) @@ to_tsquery('simple', :q)").bindparams(
            q=fts or "zzzz"
        )
        hit = select(CopilotMessage.thread_id).where(match).scalar_subquery()
        stmt = stmt.where(or_(CopilotThread.id.in_(hit), and_(*_like(CopilotThread.search_text, c.terms))))
    stmt = _range(
        _after(stmt, CopilotThread.updated_at, CopilotThread.id, RANK["conversation"], c.cur),
        CopilotThread.updated_at,
        c.since,
        c.until,
    )
    out: list[Row] = []
    for t in (
        await c.db.execute(stmt.order_by(CopilotThread.updated_at.desc(), CopilotThread.id.desc()).limit(c.fetch))
    ).scalars():
        last = (
            await c.db.execute(
                select(CopilotMessage)
                .where(CopilotMessage.thread_id == t.id)
                .order_by(CopilotMessage.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        item = HistoryItem(id=f"conversation:{t.id}", kind="conversation", title=t.title or "—", snippet=message_text(last)[:140] if last else None,
                           status="archived" if t.archived else "active", occurred_at=t.updated_at, thread_id=t.id, ref_id=t.id, route=f"/chat/{t.id}")  # fmt: skip
        out.append((t.updated_at, RANK["conversation"], str(t.id), item))
    return out


async def _actions(c: Q) -> list[Row]:
    stmt = select(CopilotAction).where(CopilotAction.user_id == c.user.id)
    if c.status:
        stmt = stmt.where(CopilotAction.status == c.status)
    if c.terms:
        stmt = stmt.where(and_(*_like(CopilotAction.search_text, c.terms)))
    stmt = _range(
        _after(stmt, CopilotAction.created_at, CopilotAction.id, RANK["action"], c.cur),
        CopilotAction.created_at,
        c.since,
        c.until,
    )
    out: list[Row] = []
    for a in (
        await c.db.execute(stmt.order_by(CopilotAction.created_at.desc(), CopilotAction.id.desc()).limit(c.fetch))
    ).scalars():
        item = HistoryItem(
            id=f"action:{a.id}",
            kind="action",
            title=a.summary[:160],
            snippet=a.type,
            status=a.status,
            occurred_at=a.created_at,
            thread_id=a.thread_id,
            ref_id=a.id,
        )
        out.append((a.created_at, RANK["action"], str(a.id), item))
    return out


async def _artifacts(c: Q) -> list[Row]:
    if c.status not in (None, "pinned"):
        return []
    stmt = select(CopilotArtifact).where(CopilotArtifact.user_id == c.user.id)
    if c.status == "pinned":
        stmt = stmt.where(CopilotArtifact.pinned.is_(True))
    if c.terms:
        stmt = stmt.where(and_(*_like(CopilotArtifact.search_text, c.terms)))
    stmt = _range(
        _after(stmt, CopilotArtifact.created_at, CopilotArtifact.id, RANK["artifact"], c.cur),
        CopilotArtifact.created_at,
        c.since,
        c.until,
    )
    out: list[Row] = []
    for r in (
        await c.db.execute(stmt.order_by(CopilotArtifact.created_at.desc(), CopilotArtifact.id.desc()).limit(c.fetch))
    ).scalars():
        item = HistoryItem(
            id=f"artifact:{r.id}",
            kind="artifact",
            title=r.title,
            snippet=r.artifact_type,
            status="pinned" if r.pinned else None,
            occurred_at=r.created_at,
            thread_id=r.thread_id,
            ref_id=r.id,
        )
        out.append((r.created_at, RANK["artifact"], str(r.id), item))
    return out


async def _memories(c: Q) -> list[Row]:
    out: list[Row] = []
    if c.status in (None, "applied"):
        stmt = select(CopilotMemoryEntry).where(CopilotMemoryEntry.user_id == c.user.id)
        if c.terms:
            stmt = stmt.where(and_(*_like(CopilotMemoryEntry.search_text, c.terms)))
        stmt = _range(
            _after(stmt, CopilotMemoryEntry.created_at, CopilotMemoryEntry.id, RANK["memory"], c.cur),
            CopilotMemoryEntry.created_at,
            c.since,
            c.until,
        )
        for m in (
            await c.db.execute(
                stmt.order_by(CopilotMemoryEntry.created_at.desc(), CopilotMemoryEntry.id.desc()).limit(c.fetch)
            )
        ).scalars():
            item = HistoryItem(
                id=f"memory:{m.id}",
                kind="memory",
                title=m.content[:160],
                snippet=m.target,
                status="applied",
                occurred_at=m.created_at,
                thread_id=m.source_thread_id,
                ref_id=m.id,
            )
            out.append((m.created_at, RANK["memory"], str(m.id), item))
    if c.status in (None, "pending"):
        pend = select(CopilotMemoryPending).where(
            CopilotMemoryPending.user_id == c.user.id, CopilotMemoryPending.status == "pending"
        )
        pend = _range(
            _after(pend, CopilotMemoryPending.created_at, CopilotMemoryPending.id, RANK["memory"], c.cur),
            CopilotMemoryPending.created_at,
            c.since,
            c.until,
        )
        for p in (
            await c.db.execute(
                pend.order_by(CopilotMemoryPending.created_at.desc(), CopilotMemoryPending.id.desc()).limit(c.fetch)
            )
        ).scalars():
            if c.terms and not all(t in fold(p.summary) for t in c.terms):
                continue
            item = HistoryItem(
                id=f"memory:{p.id}",
                kind="memory",
                title=p.summary[:160],
                snippet=p.target,
                status="pending",
                occurred_at=p.created_at,
                thread_id=p.source_thread_id,
                ref_id=p.id,
            )
            out.append((p.created_at, RANK["memory"], str(p.id), item))
    return out


async def _attachments(c: Q) -> list[Row]:
    if c.status is not None:
        return []
    stmt = select(CopilotAttachment).where(CopilotAttachment.user_id == c.user.id)
    if c.terms:
        stmt = stmt.where(and_(*_like(CopilotAttachment.search_text, c.terms)))
    stmt = _range(
        _after(stmt, CopilotAttachment.created_at, CopilotAttachment.id, RANK["attachment"], c.cur),
        CopilotAttachment.created_at,
        c.since,
        c.until,
    )
    out: list[Row] = []
    for f in (
        await c.db.execute(
            stmt.order_by(CopilotAttachment.created_at.desc(), CopilotAttachment.id.desc()).limit(c.fetch)
        )
    ).scalars():
        item = HistoryItem(
            id=f"attachment:{f.id}",
            kind="attachment",
            title=f.filename,
            snippet=f.kind,
            status=None,
            occurred_at=f.created_at,
            thread_id=None,
            ref_id=f.id,
        )
        out.append((f.created_at, RANK["attachment"], str(f.id), item))
    return out


async def history_page(
    db: AsyncSession,
    user: User,
    *,
    cursor: str | None,
    kinds: list[HistoryKind],
    since: datetime | None,
    until: datetime | None,
    status: str | None,
    q: str | None,
    limit: int,
) -> HistoryPage:
    c = Q(db, user, decode_cursor(cursor), _terms(q), q, since, until, status, limit + 1)
    wanted = kinds or list(ALL_KINDS)
    sources = {
        "conversation": _conversations,
        "action": _actions,
        "artifact": _artifacts,
        "memory": _memories,
        "attachment": _attachments,
    }
    items: list[Row] = []
    for kind in wanted:
        items += await sources[kind](c)
    items.sort(key=lambda t: (t[0], t[1], t[2]), reverse=True)
    page = items[:limit]
    nxt = encode_cursor(page[-1][0], page[-1][1], page[-1][2]) if len(items) > limit and page else None
    return HistoryPage(items=[i[3] for i in page], next_cursor=nxt)


# --- ações (auditoria) ----------------------------------------------------------------------------------


async def actions_page(
    db: AsyncSession,
    user: User,
    *,
    scope: str,
    cursor: str | None,
    status: str | None,
    type_: str | None,
    q: str | None,
    limit: int,
    locale: str = "pt-PT",
) -> ActionPage:
    if scope == "all" and user.role != "admin":
        from novelo.core.errors import ForbiddenError  # noqa: PLC0415

        raise ForbiddenError("Only administrators can audit every user's actions")
    cur = decode_cursor(cursor)
    stmt = select(CopilotAction, User.email).join(User, User.id == CopilotAction.user_id)
    if scope != "all":
        stmt = stmt.where(CopilotAction.user_id == user.id)
    if status:
        stmt = stmt.where(CopilotAction.status == status)
    if type_:
        stmt = stmt.where(CopilotAction.type == type_)
    terms = _terms(q)
    if terms:
        stmt = stmt.where(and_(*_like(CopilotAction.search_text, terms)))
    stmt = _after(stmt, CopilotAction.created_at, CopilotAction.id, RANK["action"], cur)
    rows = (
        await db.execute(stmt.order_by(CopilotAction.created_at.desc(), CopilotAction.id.desc()).limit(limit + 1))
    ).all()
    page = rows[:limit]
    nxt = (
        encode_cursor(page[-1][0].created_at, RANK["action"], str(page[-1][0].id))
        if len(rows) > limit and page
        else None
    )
    return ActionPage(
        items=[actions.to_out(a, locale, email if scope == "all" else None) for a, email in page], next_cursor=nxt
    )


# --- artefactos --------------------------------------------------------------------------------------


def artifact_out(r: CopilotArtifact) -> ArtifactOut:
    artifact = charts.validate_artifact(r.artifact_type, r.spec)
    return ArtifactOut(
        id=r.id, title=r.title, artifact_type=r.artifact_type, thread_id=r.thread_id, message_id=r.message_id, pinned=r.pinned,
        refreshable=bool(r.refresh), created_at=r.created_at, refreshed_at=r.refreshed_at, sources=r.sources, artifact=artifact,
    )  # fmt: skip


async def artifacts_page(
    db: AsyncSession,
    user: User,
    *,
    cursor: str | None,
    artifact_type: str | None,
    pinned: bool | None,
    q: str | None,
    thread_id: uuid.UUID | None,
    limit: int,
) -> ArtifactPage:
    cur = decode_cursor(cursor)
    stmt = select(CopilotArtifact).where(CopilotArtifact.user_id == user.id)
    if artifact_type:
        stmt = stmt.where(CopilotArtifact.artifact_type == artifact_type)
    if pinned is not None:
        stmt = stmt.where(CopilotArtifact.pinned.is_(pinned))
    if thread_id:
        stmt = stmt.where(CopilotArtifact.thread_id == thread_id)
    terms = _terms(q)
    if terms:
        stmt = stmt.where(and_(*_like(CopilotArtifact.search_text, terms)))
    stmt = _after(stmt, CopilotArtifact.created_at, CopilotArtifact.id, RANK["artifact"], cur)
    rows = list(
        (
            await db.execute(
                stmt.order_by(CopilotArtifact.created_at.desc(), CopilotArtifact.id.desc()).limit(limit + 1)
            )
        ).scalars()
    )
    page = rows[:limit]
    nxt = encode_cursor(page[-1].created_at, RANK["artifact"], str(page[-1].id)) if len(rows) > limit and page else None
    return ArtifactPage(items=[artifact_out(r) for r in page], next_cursor=nxt)


async def owned_artifact(db: AsyncSession, user: User, artifact_id: uuid.UUID) -> CopilotArtifact:
    row = await db.get(CopilotArtifact, artifact_id)
    if row is None or row.user_id != user.id:
        raise NotFoundError("Artifact not found")
    return row


async def set_pinned(db: AsyncSession, user: User, artifact_id: uuid.UUID, pinned: bool) -> ArtifactOut:
    row = await owned_artifact(db, user, artifact_id)
    row.pinned = pinned
    await db.commit()
    return artifact_out(row)


async def delete_artifact(db: AsyncSession, user: User, artifact_id: uuid.UUID) -> None:
    await db.delete(await owned_artifact(db, user, artifact_id))
    await db.commit()


async def refresh_artifact(db: AsyncSession, user: User, artifact_id: uuid.UUID, locale: str = "pt-PT") -> ArtifactOut:
    """Volta a correr a ferramenta de dados com os mesmos argumentos e reconstrói o artefacto com os dados atuais."""
    from novelo.features.copilot.tools import CopilotTools  # noqa: PLC0415

    row = await owned_artifact(db, user, artifact_id)
    if not row.refresh:
        raise ConflictError("This artifact cannot be refreshed")
    box = CopilotTools(db, user, locale=locale)
    outcome = await box.run(row.refresh["tool"], json.dumps(row.refresh["args"]))
    if not outcome.ok or outcome.table is None:
        raise ConflictError("The data could not be refreshed: " + outcome.summary)
    spec = _rebuild(row.refresh, outcome.table, row.artifact_type, row.title)
    row.spec = spec
    row.refreshed_at = datetime.now(UTC)
    await db.commit()
    return artifact_out(row)


def _rebuild(refresh: dict[str, Any], table: dict[str, Any], artifact_type: str, title: str) -> dict[str, Any]:
    a = refresh["builder_args"]
    try:
        if artifact_type == "chart":
            built = charts.build_chart(
                table, a["kind"], a.get("x"), a.get("y", []), a.get("series"), a.get("label"), a.get("size"), title
            )
        elif artifact_type == "table":
            built = charts.build_table(
                table, a.get("columns", []), a.get("sort_by"), a.get("sort_dir", "desc"), a.get("limit", 20), title
            )
        elif artifact_type == "kpis":
            built = charts.build_kpis(table, a["keys"], title, a.get("row", 0))
        elif artifact_type == "comparison":
            built = charts.build_comparison(table, title)
        elif artifact_type == "timeline":
            built = charts.build_timeline(table, a["at_col"], a["label_col"], a.get("detail_col"), title)
        else:
            raise ConflictError("This artifact cannot be refreshed")
    except charts.ArtifactError as exc:
        raise ConflictError("The refreshed data no longer fits this artifact: " + exc.message) from exc
    dumped: dict[str, Any] = built.model_dump(mode="json")
    return dumped


# --- cronologia de uma conversa ------------------------------------------------------------------------


async def thread_timeline(db: AsyncSession, thread: CopilotThread) -> list[TimelineEvent]:
    events = [
        TimelineEvent(
            at=thread.created_at,
            kind="thread",
            label="thread_started",
            detail=("memory_snapshot" if thread.snapshot else None),
            ref_id=thread.id,
        )
    ]
    msgs = (
        (
            await db.execute(
                select(CopilotMessage)
                .where(CopilotMessage.thread_id == thread.id)
                .order_by(CopilotMessage.created_at, CopilotMessage.id)
            )
        )
        .scalars()
        .all()
    )
    for m in msgs:
        events.append(
            TimelineEvent(at=m.created_at, kind="message", label=m.role, detail=message_text(m)[:100], ref_id=m.id)
        )
        events += [
            TimelineEvent(
                at=m.created_at,
                kind="tool",
                label=str(t.get("name")),
                detail=str(t.get("summary", ""))[:120],
                ref_id=m.id,
            )
            for t in m.tool_trace
        ]
        events += [
            TimelineEvent(
                at=m.created_at,
                kind="attachment",
                label=str(p.get("filename")),
                detail=str(p.get("kind")),
                ref_id=uuid.UUID(p["id"]),
            )
            for p in m.parts
            if p.get("type") == "attachment"
        ]
    for mem in (
        await db.execute(select(CopilotMemoryEntry).where(CopilotMemoryEntry.source_thread_id == thread.id))
    ).scalars():
        events.append(
            TimelineEvent(
                at=mem.created_at, kind="memory", label=f"memory_{mem.target}", detail=mem.content[:120], ref_id=mem.id
            )
        )
    for a in (await db.execute(select(CopilotAction).where(CopilotAction.thread_id == thread.id))).scalars():
        events.append(
            TimelineEvent(
                at=a.created_at, kind="action", label=a.type, detail=f"{a.status}: {a.summary}"[:140], ref_id=a.id
            )
        )
    for r in (await db.execute(select(CopilotArtifact).where(CopilotArtifact.thread_id == thread.id))).scalars():
        events.append(
            TimelineEvent(at=r.created_at, kind="artifact", label=r.artifact_type, detail=r.title, ref_id=r.id)
        )
    events.sort(key=lambda e: e.at)
    return events
