"""Privacidade do copiloto: exportar (RGPD), apagar tudo e aplicar a retenção. Apagar remove também o histórico derivado."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.features.copilot import memory_store, user_settings
from novelo.features.copilot.models import (
    CopilotAction,
    CopilotArtifact,
    CopilotAttachment,
    CopilotMemoryEntry,
    CopilotMemoryPending,
    CopilotThread,
    CopilotUserSettings,
)
from novelo.features.copilot.schemas_memory import CopilotSettings

EPHEMERAL_HOURS = 24
ORPHAN_ATTACHMENT_HOURS = 24


def _rows(result: Any) -> int:
    return int(getattr(result, "rowcount", 0) or 0)


async def _count(db: AsyncSession, stmt: Any) -> int:
    return int(await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)


async def delete_all(db: AsyncSession, user_id: uuid.UUID, keep_action: uuid.UUID | None) -> dict[str, int]:
    """Apaga tudo do copiloto de um utilizador. `keep_action`: a linha de auditoria da própria eliminação."""
    counts = {
        "threads": await _count(db, select(CopilotThread.id).where(CopilotThread.user_id == user_id)),
        "memory_entries": await _count(db, select(CopilotMemoryEntry.id).where(CopilotMemoryEntry.user_id == user_id)),
        "attachments": await _count(db, select(CopilotAttachment.id).where(CopilotAttachment.user_id == user_id)),
        "artifacts": await _count(db, select(CopilotArtifact.id).where(CopilotArtifact.user_id == user_id)),
    }
    for model in (
        CopilotArtifact,
        CopilotAttachment,
        CopilotMemoryEntry,
        CopilotMemoryPending,
        CopilotUserSettings,
        CopilotThread,
    ):
        await db.execute(delete(model).where(model.user_id == user_id))
    actions = delete(CopilotAction).where(CopilotAction.user_id == user_id)
    if keep_action is not None:
        actions = actions.where(CopilotAction.id != keep_action)
    await db.execute(actions)
    await db.commit()
    return counts


async def purge_expired(db: AsyncSession, now: datetime | None = None) -> dict[str, int]:
    """Aplica a retenção de cada utilizador (e o máximo do sistema), as conversas efémeras e os anexos órfãos."""
    now = now or datetime.now(UTC)
    removed = {"threads": 0, "attachments": 0, "artifacts": 0, "actions": 0, "memory_pending": 0}
    cutoff = now - timedelta(hours=EPHEMERAL_HOURS)
    res = await db.execute(
        delete(CopilotThread).where(CopilotThread.ephemeral.is_(True), CopilotThread.updated_at < cutoff)
    )
    removed["threads"] += _rows(res)
    orphan = await db.execute(
        delete(CopilotAttachment).where(
            CopilotAttachment.created_at < now - timedelta(hours=ORPHAN_ATTACHMENT_HOURS),
            ~CopilotAttachment.id.in_(await _referenced_attachments(db)),
        )
    )
    removed["attachments"] += _rows(orphan)
    users = set((await db.execute(select(CopilotUserSettings.user_id))).scalars()) | set(
        (await db.execute(select(CopilotThread.user_id).distinct())).scalars()
    )
    for uid in users:
        days = user_settings.effective_retention(await user_settings.load(db, uid))
        if not days:
            continue
        limit = now - timedelta(days=days)
        for key, model in (("threads", CopilotThread), ("artifacts", CopilotArtifact), ("actions", CopilotAction)):
            r = await db.execute(
                delete(model).where(
                    model.user_id == uid, model.created_at < limit if key != "threads" else model.updated_at < limit
                )
            )
            removed[key] += _rows(r)
        r = await db.execute(
            delete(CopilotMemoryPending).where(
                CopilotMemoryPending.user_id == uid, CopilotMemoryPending.created_at < limit
            )
        )
        removed["memory_pending"] += _rows(r)
    await db.commit()
    return removed


async def _referenced_attachments(db: AsyncSession) -> list[uuid.UUID]:
    from novelo.features.copilot.models import CopilotMessage  # noqa: PLC0415

    rows = (await db.execute(select(CopilotMessage.parts))).scalars().all()
    return [uuid.UUID(p["id"]) for parts in rows for p in parts if p.get("type") == "attachment"]


async def export_all(db: AsyncSession, user_id: uuid.UUID) -> dict[str, Any]:
    """Tudo o que o copiloto guarda sobre o utilizador (definições, memória, ações). As conversas vêm de `threads.get_thread`."""
    entries = [
        {"target": r.target, "content": r.content, "origin": r.origin, "created_at": r.created_at.isoformat()}
        for t in ("memory", "user")
        for r in await memory_store.load_entries(db, user_id, t)
    ]
    settings: CopilotSettings = await user_settings.load(db, user_id)
    return {"settings": settings.model_dump(), "memory": entries}
