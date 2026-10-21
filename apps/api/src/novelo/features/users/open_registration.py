"""Registo aberto: com a definição `open_registration` ligada, as contas novas não esperam por um administrador.

Aplica-se a quem se regista por password, cria conta com Google ou entra (password, Google, magic link) com a conta
ainda `pending`. Nunca a contas desativadas, recusadas ou cujo email já foi recusado antes (mesmo que a conta tenha
sido eliminada entretanto: a auditoria da recusa guarda o SHA-256 do email) e nunca muda o papel.
Sem imports de FastAPI. Quem chama faz o commit (a aprovação e a auditoria ficam na mesma transação).
"""

import hashlib
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.request_meta import RequestMeta
from novelo.features.app_settings.models import AppSettings
from novelo.features.audit import service as audit
from novelo.features.audit.models import AuditLog
from novelo.features.users.models import User

log = logging.getLogger(__name__)

AutoVia = Literal["password", "google", "magic_link", "bulk"]
AUTO_APPROVE_ACTION = "user.auto_approve"
AUTO_APPROVE_NOTE = "aprovado automaticamente: registo aberto"


def email_digest(email: str) -> str:
    """SHA-256 do email normalizado: identifica uma recusa sem guardar o email depois de a conta ser eliminada."""
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()


async def is_open(db: AsyncSession) -> bool:
    return bool(await db.scalar(select(AppSettings.open_registration).limit(1)))


async def previously_rejected(db: AsyncSession, email: str) -> bool:
    address = email.strip().lower()
    found = await db.scalar(
        select(func.count())
        .select_from(AuditLog)
        .where(
            AuditLog.action == "user.reject",
            or_(AuditLog.details["email_sha256"].astext == email_digest(address), AuditLog.target_label == address),
        )
    )
    return bool(found)


def _eligible(user: User) -> bool:
    return user.is_active and user.approval_status == "pending" and user.role != "admin"


async def _approve(db: AsyncSession, user: User, via: AutoVia, actor: User | None, meta: RequestMeta | None) -> None:
    user.approval_status = "approved"
    user.approved_by_id = actor.id if actor is not None else None
    user.approved_at = datetime.now(UTC)
    user.rejected_reason = None
    details = {"reason": "open_registration", "via": via, "role": user.role, "note": AUTO_APPROVE_NOTE}
    if actor is None:
        await audit.record(
            db, AUTO_APPROVE_ACTION, actor_id=None, target_type="user", target_id=user.id, target_label=user.email,
            meta=meta, details=details,
        )  # fmt: skip
    else:
        await audit.record_by(
            db, actor, AUTO_APPROVE_ACTION, meta=meta, target_type="user", target_id=user.id,
            target_label=user.email, details=details,
        )  # fmt: skip


async def auto_approve_if_open(db: AsyncSession, user: User, via: AutoVia, meta: RequestMeta | None = None) -> bool:
    """Aprova a conta `pending` se o registo estiver aberto. Não faz commit. Devolve se aprovou."""
    if not _eligible(user) or not await is_open(db):
        return False
    if await previously_rejected(db, user.email):
        log.info("open registration: email previously rejected, stays pending user=%s", user.id)
        return False
    await _approve(db, user, via, None, meta)
    return True


@dataclass(frozen=True)
class BulkOutcome:
    approved: int
    skipped_previously_rejected: int


async def approve_all_pending(db: AsyncSession, admin: User, meta: RequestMeta | None) -> BulkOutcome:
    """Aprova as contas `pending` ativas (ação explícita de um administrador). Não faz commit."""
    pending = (
        (await db.execute(select(User).where(User.approval_status == "pending").order_by(User.created_at)))
        .scalars()
        .all()
    )
    approved = skipped = 0
    for user in pending:
        if not _eligible(user):
            continue
        if await previously_rejected(db, user.email):
            skipped += 1
            continue
        await _approve(db, user, "bulk", admin, meta)
        approved += 1
    return BulkOutcome(approved, skipped)
