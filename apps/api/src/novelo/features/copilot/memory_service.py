"""Escrita de memória com todas as regras: alvo ligado, varrimento, limite, aprovação e eventos para o ecrã."""

import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from novelo.features.copilot import memory_store as store
from novelo.features.copilot.models import CopilotMemoryPending
from novelo.features.copilot.schemas import CopilotMemoryEvent
from novelo.features.copilot.schemas_memory import CopilotSettings


@dataclass
class ApplyResult:
    ok: bool
    payload: dict[str, Any]
    events: list[CopilotMemoryEvent] = field(default_factory=list)


def target_enabled(settings: CopilotSettings, target: str) -> bool:
    return settings.memory_enabled if target == "memory" else settings.user_profile_enabled


def _event(action: str, target: str, content: str, status: str, **kw: Any) -> CopilotMemoryEvent:
    return CopilotMemoryEvent(action=action, target=target, content=content[:400], status=status, **kw)


async def live_state(db: AsyncSession, user_id: uuid.UUID, target: str) -> dict[str, Any]:
    entries = [r.content for r in await store.load_entries(db, user_id, target)]
    return {"entries": entries, "usage": store.usage_text(store.total_chars(entries), store.limit_for(target))}


async def apply(
    db: AsyncSession,
    user_id: uuid.UUID,
    settings: CopilotSettings,
    target: str,
    ops: list[store.MemoryOp],
    *,
    origin: str,
    thread_id: uuid.UUID | None,
    force_direct: bool = False,
) -> ApplyResult:
    """Valida o lote e grava (ou põe em fila, se o utilizador pediu aprovação). `force_direct`: aprovação já dada."""
    if not target_enabled(settings, target):
        return ApplyResult(False, {"success": False, "error": f"The '{target}' memory is turned off by the user"})
    if not ops:
        return ApplyResult(False, {"success": False, "error": "No operations"})
    rows = await store.load_entries(db, user_id, target)
    try:
        plan = store.plan_ops(rows, ops, store.limit_for(target))
    except store.MemoryError_ as exc:
        events = []
        if exc.payload.get("error") == "blocked_by_security":
            events.append(
                _event(
                    "blocked",
                    target,
                    ops[0].content or ops[0].old_text,
                    "blocked",
                    reason=str(exc.payload.get("reason")),
                )
            )
        return ApplyResult(False, {"success": False, **exc.payload}, events)
    if settings.write_approval == "ask" and not force_direct:
        pending = await store.stage(db, user_id, target, ops, origin, thread_id)
        ev = _event("staged", target, pending.summary, "pending", entry_id=pending.id)
        return ApplyResult(
            True,
            {
                "success": True,
                "staged": True,
                "message": "Waiting for the user's approval",
                "pending_id": str(pending.id),
            },
            [ev],
        )
    created = await store.commit_plan(db, user_id, target, plan, origin, thread_id)
    events = [_event("added", target, text, "applied", entry_id=eid) for eid, text in created]
    events += [
        _event("patched", target, after, "applied", entry_id=eid, previous=before)
        for eid, (before, after) in plan.patched.items()
    ]
    removed_texts = {r.id: r.content for r in rows}
    events += [
        _event("removed", target, removed_texts[eid], "applied", entry_id=eid, previous=removed_texts[eid])
        for eid in plan.removed
    ]
    state = await live_state(db, user_id, target)
    note = {"no_duplicate_added": plan.skipped_duplicates} if plan.skipped_duplicates else {}
    return ApplyResult(True, {"success": True, "target": target, **state, **note}, events)


async def approve_pending(
    db: AsyncSession, user_id: uuid.UUID, settings: CopilotSettings, pending_id: uuid.UUID, edited: str | None
) -> ApplyResult:
    from novelo.core.errors import ConflictError, NotFoundError  # noqa: PLC0415

    row = await db.get(CopilotMemoryPending, pending_id)
    if row is None or row.user_id != user_id:
        raise NotFoundError("Pending memory write not found")
    if row.status != "pending":
        raise ConflictError("This memory write was already decided")
    ops = store.ops_from_json(row.ops)
    if edited is not None:
        adds = [o for o in ops if o.action == "add"]
        if len(adds) != 1:
            raise ConflictError("Only a single 'add' can be edited")
        adds[0].content = edited
    result = await apply(
        db, user_id, settings, row.target, ops, origin=row.origin, thread_id=row.source_thread_id, force_direct=True
    )
    row.status = "approved" if result.ok else "pending"
    await db.commit()
    return result
