"""API de gestão da memória do utilizador (Definições): entradas, fila de aprovação, limpar, exportar, apagar tudo."""

import uuid
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.openrouter import OpenRouterClient
from novelo.ai.tasks import AiTask
from novelo.ai.verify import unsupported_rounded
from novelo.core.errors import AiBudgetExceededError, ConflictError, FeatureDisabledError, NotFoundError
from novelo.features.copilot import (
    actions,
    memory_service,
    memory_store,
    persona,
    privacy,
    security,
    threads,
    user_settings,
)
from novelo.features.copilot.models import CopilotAction, CopilotMemoryEntry, CopilotMemoryPending, CopilotThread
from novelo.features.copilot.schemas import DataExport
from novelo.features.copilot.schemas_memory import (
    CopilotSettings,
    MemoryEntryCreate,
    MemoryEntryList,
    MemoryEntryOut,
    MemoryEntryUpdate,
    MemoryMeter,
    PendingApprove,
    PendingMemoryOut,
    PersonaPreviewIn,
    PersonaPreviewOut,
)
from novelo.features.copilot.tables import fold
from novelo.features.users.models import User

ALL_ON = {"memory_enabled": True, "user_profile_enabled": True, "write_approval": "auto"}


def _out(r: CopilotMemoryEntry) -> MemoryEntryOut:
    return MemoryEntryOut(
        id=r.id, target=r.target, content=r.content, origin=r.origin, pinned=r.pinned,
        source_thread_id=r.source_thread_id, created_at=r.created_at, updated_at=r.updated_at,
    )  # fmt: skip


async def list_entries(db: AsyncSession, user: User, target: str | None) -> MemoryEntryList:
    q = select(CopilotMemoryEntry).where(CopilotMemoryEntry.user_id == user.id)
    if target:
        q = q.where(CopilotMemoryEntry.target == target)
    rows = (
        (await db.execute(q.order_by(CopilotMemoryEntry.target, CopilotMemoryEntry.created_at, CopilotMemoryEntry.id)))
        .scalars()
        .all()
    )
    meters = {k: MemoryMeter(**v) for k, v in (await memory_store.usage_meters(db, user.id)).items()}
    return MemoryEntryList(items=[_out(r) for r in rows], usage=meters)


async def _direct(
    db: AsyncSession, user: User, target: str, ops: list[memory_store.MemoryOp]
) -> memory_service.ApplyResult:
    forced = (await user_settings.load(db, user.id)).model_copy(update=ALL_ON)
    return await memory_service.apply(
        db, user.id, forced, target, ops, origin="manual", thread_id=None, force_direct=True
    )


def _raise(result: memory_service.ApplyResult) -> None:
    if not result.ok:
        raise ConflictError(str(result.payload.get("error") or result.payload.get("reason") or "Memory write rejected"))


async def create_entry(db: AsyncSession, user: User, body: MemoryEntryCreate) -> MemoryEntryOut:
    result = await _direct(db, user, body.target, [memory_store.MemoryOp("add", content=body.content)])
    _raise(result)
    created = next((e for e in result.events if e.action == "added"), None)
    row = await db.get(CopilotMemoryEntry, created.entry_id) if created and created.entry_id else None
    if row is None:  # duplicado exato: devolve a entrada existente
        rows = [
            r for r in await memory_store.load_entries(db, user.id, body.target) if r.content == body.content.strip()
        ]
        row = rows[0]
    row.pinned = body.pinned
    await db.commit()
    await db.refresh(row)
    return _out(row)


async def update_entry(db: AsyncSession, user: User, entry_id: uuid.UUID, body: MemoryEntryUpdate) -> MemoryEntryOut:
    row = await db.get(CopilotMemoryEntry, entry_id)
    if row is None or row.user_id != user.id:
        raise NotFoundError("Memory entry not found")
    if body.content is not None and body.content != row.content:
        _raise(
            await _direct(
                db, user, row.target, [memory_store.MemoryOp("patch", content=body.content, old_text=row.content)]
            )
        )
        await db.refresh(row)
    if body.pinned is not None:
        row.pinned = body.pinned
    await db.commit()
    await db.refresh(row)
    return _out(row)


async def delete_entry(db: AsyncSession, user: User, entry_id: uuid.UUID) -> None:
    row = await db.get(CopilotMemoryEntry, entry_id)
    if row is None or row.user_id != user.id:
        raise NotFoundError("Memory entry not found")
    await db.delete(row)
    await db.commit()


async def clear(db: AsyncSession, user: User, target: str) -> int:
    res = await db.execute(
        delete(CopilotMemoryEntry).where(CopilotMemoryEntry.user_id == user.id, CopilotMemoryEntry.target == target)
    )
    await db.commit()
    return int(getattr(res, "rowcount", 0) or 0)


def _pending_out(p: CopilotMemoryPending) -> PendingMemoryOut:
    return PendingMemoryOut(
        id=p.id, target=p.target, summary=p.summary, ops=[{k: str(v) for k, v in o.items()} for o in p.ops], origin=p.origin,
        source_thread_id=p.source_thread_id, status=p.status, created_at=p.created_at,
    )  # fmt: skip


async def list_pending(db: AsyncSession, user: User) -> list[PendingMemoryOut]:
    q = (
        select(CopilotMemoryPending)
        .where(CopilotMemoryPending.user_id == user.id, CopilotMemoryPending.status == "pending")
        .order_by(CopilotMemoryPending.created_at, CopilotMemoryPending.id)
    )
    return [_pending_out(p) for p in (await db.execute(q)).scalars()]


async def approve(db: AsyncSession, user: User, pending_id: uuid.UUID, body: PendingApprove) -> PendingMemoryOut:
    settings = (await user_settings.load(db, user.id)).model_copy(update=ALL_ON)
    result = await memory_service.approve_pending(db, user.id, settings, pending_id, body.content)
    row = await db.get(CopilotMemoryPending, pending_id)
    assert row is not None
    _raise(result)
    return _pending_out(row)


async def reject(db: AsyncSession, user: User, pending_id: uuid.UUID) -> PendingMemoryOut:
    row = await db.get(CopilotMemoryPending, pending_id)
    if row is None or row.user_id != user.id:
        raise NotFoundError("Pending memory write not found")
    if row.status != "pending":
        raise ConflictError("This memory write was already decided")
    row.status = "rejected"
    await db.commit()
    return _pending_out(row)


# --- persona ---------------------------------------------------------------------------------------


class _Preview(BaseModel):
    text: str = Field(min_length=5, max_length=500)


CANNED = {
    "pt-PT": {
        "default": "A captura é a fração do têxtil gerado que chega, de facto, a um ponto de recolha.",
        "analyst": "Captura = têxtil recolhido ÷ têxtil gerado. É um rácio: convém sempre indicar a fonte e a incerteza.",
        "mentor": "Pensa assim: de todo o têxtil que as pessoas deitam fora, a captura diz que parte acaba num contentor certo.",
        "executive": "Captura é a parte do têxtil que a rede apanha. Quanto maior, menos vai para o lixo indiferenciado.",
        "storyteller": "Imagina uma camisola esquecida no armário: a captura conta quantas, em vez do lixo, ganham uma segunda vida.",
        "custom": "A captura é a parte do têxtil gerado que chega a um ponto de recolha.",
    },
    "en": {
        "default": "Capture is the share of generated textile that actually reaches a collection point.",
        "analyst": "Capture = textile collected / textile generated. It is a ratio: always state the source and the uncertainty.",
        "mentor": "Think of it this way: of all the textile people discard, capture tells you how much ends up in the right bin.",
        "executive": "Capture is the share of textile the network catches. Higher means less in general waste.",
        "storyteller": "Picture a forgotten jumper in a wardrobe: capture counts how many get a second life instead of the bin.",
        "custom": "Capture is the share of generated textile that reaches a collection point.",
    },
}


async def preview_persona(llm: OpenRouterClient, body: PersonaPreviewIn) -> PersonaPreviewOut:
    settings = CopilotSettings(
        persona=body.persona, persona_text=body.persona_text, verbosity=body.verbosity, formality=body.formality, emoji=body.emoji,
        preferred_language=body.language,
    )  # fmt: skip
    if body.persona == "custom":
        try:
            persona.check_custom_text(body.persona_text)
        except security.Blocked as exc:
            raise user_settings.InvalidSettingError(
                f"The custom persona was refused: {security.EXPLANATION[exc.reason]}"
            ) from exc
    system = persona.render(settings) + "\n\nAnswer the user's sample in at most 2 sentences. Do not use any number."
    fallback = CANNED[body.language].get(persona.effective_key(settings), CANNED[body.language]["default"])
    try:
        out = await llm.structured(system=system, user=body.sample, schema=_Preview, task=AiTask.COPILOT_AUX, retries=0)
        text = out.text.strip()
        if unsupported_rounded(text, {}):  # a persona não pode fazer aparecer números
            text = fallback
    except (AiBudgetExceededError, FeatureDisabledError):
        text = fallback
    except Exception:
        text = fallback
    return PersonaPreviewOut(text=text, persona=body.persona)


# --- RGPD -----------------------------------------------------------------------------------------


async def export_data(db: AsyncSession, user: User, catalog: Any) -> DataExport:
    base = await privacy.export_all(db, user.id)
    ids = [t.id for t in (await db.execute(select(CopilotThread).where(CopilotThread.user_id == user.id))).scalars()]
    out_threads = [await threads.get_thread(db, user, tid, catalog) for tid in ids]
    acts = (
        (
            await db.execute(
                select(CopilotAction).where(CopilotAction.user_id == user.id).order_by(CopilotAction.created_at)
            )
        )
        .scalars()
        .all()
    )
    return DataExport(
        exported_at=datetime.now(UTC), settings=base["settings"], memory=base["memory"], threads=out_threads,
        actions=[actions.to_out(a) for a in acts],
    )  # fmt: skip


async def delete_data(db: AsyncSession, user: User, confirmation: str) -> dict[str, int]:
    if confirmation.strip().upper() not in {"APAGAR", "DELETE"}:
        raise user_settings.InvalidSettingError("Type APAGAR or DELETE to confirm")
    row = CopilotAction(
        user_id=user.id, type="delete_my_copilot_data", params={}, summary="Delete all copilot data", impact="", risk="critical", reversible=False,
        status="executed", expires_at=datetime.now(UTC), decided_at=datetime.now(UTC), search_text=fold("delete all copilot data"),
    )  # fmt: skip
    db.add(row)
    await db.flush()
    counts = await privacy.delete_all(db, user.id, keep_action=row.id)
    row.result = {"deleted": counts}
    await db.commit()
    return counts
