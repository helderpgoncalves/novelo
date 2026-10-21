"""Definições globais da aplicação (hoje: registo aberto). Sem imports de FastAPI."""

import uuid

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.errors import ConflictError
from novelo.core.request_meta import RequestMeta
from novelo.features.app_settings.models import AppSettings
from novelo.features.app_settings.schemas import AppSettingsOut, AppSettingsUpdate, AppSettingsUpdated
from novelo.features.audit import service as audit
from novelo.features.users import open_registration
from novelo.features.users import service as users
from novelo.features.users.models import User


async def _row(db: AsyncSession) -> AppSettings | None:
    return (await db.execute(select(AppSettings))).scalars().first()


async def _ensure_row(db: AsyncSession) -> AppSettings:
    """A linha única, criada sem corrida entre processos (ON CONFLICT na coluna `singleton`)."""
    await db.execute(
        insert(AppSettings)
        .values(id=uuid.uuid4(), singleton=True, open_registration=False)
        .on_conflict_do_nothing(index_elements=["singleton"])
    )
    row = await _row(db)
    assert row is not None
    return row


async def get_out(db: AsyncSession) -> AppSettingsOut:
    row = await _row(db)
    return AppSettingsOut(
        open_registration=bool(row and row.open_registration),
        pending_approvals=await users.count_pending(db),
        updated_at=row.updated_at if row else None,
        updated_by_id=row.updated_by_id if row else None,
    )


async def update(db: AsyncSession, admin: User, body: AppSettingsUpdate, meta: RequestMeta) -> AppSettingsUpdated:
    row = await _ensure_row(db)
    before = row.open_registration
    after = before if body.open_registration is None else body.open_registration
    if body.approve_pending and not after:
        raise ConflictError("approve_pending needs open registration")
    row.open_registration = after
    row.updated_by_id = admin.id
    await audit.record_by(
        db,
        admin,
        "settings.update",
        meta=meta,
        target_type="settings",
        target_label="open_registration",
        details={"open_registration": {"from": before, "to": after}, "approve_pending": body.approve_pending},
    )
    bulk = open_registration.BulkOutcome(0, 0)
    if body.approve_pending:
        bulk = await open_registration.approve_all_pending(db, admin, meta)
    await db.commit()
    await db.refresh(row)
    out = await get_out(db)
    return AppSettingsUpdated(
        **out.model_dump(), approved_pending=bulk.approved, skipped_previously_rejected=bulk.skipped_previously_rejected
    )
