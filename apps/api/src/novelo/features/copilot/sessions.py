"""Pesquisa nas conversas anteriores do próprio utilizador (Postgres full-text, sem acentos, prefixos)."""

import re
import uuid
from datetime import datetime

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.features.copilot.memory import message_text
from novelo.features.copilot.models import CopilotMessage, CopilotThread
from novelo.features.copilot.schemas_memory import SessionHit, SessionSearchOut
from novelo.features.copilot.tables import fold

_TERM = re.compile(r"[a-z0-9]{2,}")
SNIPPET_CHARS = 260


def fts_query(q: str) -> str | None:
    """'Serzedelo cobertura' -> 'serzedelo:* & cobertura:*' (prefixos, sem acentos, sem caracteres especiais)."""
    terms = _TERM.findall(fold(q))[:8]
    return " & ".join(f"{t}:*" for t in terms) if terms else None


def snippet(original: str, q: str) -> str:
    plain = fold(original)
    terms = _TERM.findall(fold(q))
    idx = next((plain.find(t) for t in terms if plain.find(t) >= 0), 0)
    start = max(0, min(idx, len(original)) - 80)
    cut = original[start : start + SNIPPET_CHARS].replace("\n", " ").strip()
    return ("…" if start else "") + cut + ("…" if start + SNIPPET_CHARS < len(original) else "")


async def search(
    db: AsyncSession,
    user_id: uuid.UUID,
    q: str,
    limit: int = 10,
    exclude_thread: uuid.UUID | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
) -> SessionSearchOut:
    query = fts_query(q)
    if query is None:
        return SessionSearchOut(query=q, hits=[], total=0)
    match = text("to_tsvector('simple', copilot_messages.search_text) @@ to_tsquery('simple', :q)").bindparams(q=query)
    base = (
        select(CopilotMessage, CopilotThread.title)
        .join(CopilotThread, CopilotThread.id == CopilotMessage.thread_id)
        .where(CopilotThread.user_id == user_id, CopilotThread.ephemeral.is_(False), match)
    )
    if exclude_thread:
        base = base.where(CopilotThread.id != exclude_thread)
    if since:
        base = base.where(CopilotMessage.created_at >= since)
    if until:
        base = base.where(CopilotMessage.created_at <= until)
    total = await db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = (await db.execute(base.order_by(CopilotMessage.created_at.desc()).limit(limit))).all()
    hits = [
        SessionHit(
            thread_id=m.thread_id, thread_title=title or "", message_id=m.id, role=m.role,
            snippet=snippet(message_text(m), q), occurred_at=m.created_at,
        )
        for m, title in rows
    ]  # fmt: skip
    return SessionSearchOut(query=q, hits=hits, total=total)


async def around(
    db: AsyncSession, user_id: uuid.UUID, thread_id: uuid.UUID, message_id: uuid.UUID, window: int = 3
) -> list[dict[str, str]]:
    """Mensagens à volta de uma (para 'abrir o contexto' de um resultado). Só conversas do próprio utilizador."""
    thread = await db.get(CopilotThread, thread_id)
    if thread is None or thread.user_id != user_id:
        return []
    msgs = list(
        (
            await db.execute(
                select(CopilotMessage)
                .where(CopilotMessage.thread_id == thread_id)
                .order_by(CopilotMessage.created_at, CopilotMessage.id)
            )
        ).scalars()
    )
    idx = next((i for i, m in enumerate(msgs) if m.id == message_id), None)
    if idx is None:
        return []
    return [
        {"role": m.role, "text": message_text(m)[:600], "at": m.created_at.isoformat()}
        for m in msgs[max(0, idx - window) : idx + window + 1]
    ]
