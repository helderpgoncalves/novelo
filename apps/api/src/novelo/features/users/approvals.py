"""Aprovação de contas: quem se regista por password ou Google fica `pending` até um administrador aprovar.

Convites, QR do evento, contas criadas por administradores e contas anteriores já são `approved`.
Sem imports de FastAPI.
"""

import time
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.email import EmailSender
from novelo.core.config import get_settings
from novelo.core.errors import (
    AdminConfirmationRequiredError,
    CannotModifySelfError,
    ConflictError,
    UserNotFoundError,
)
from novelo.core.request_meta import RequestMeta
from novelo.features.audit import service as audit
from novelo.features.auth import emails
from novelo.features.auth import service as auth_service
from novelo.features.users import service as users
from novelo.features.users.models import User
from novelo.features.users.schemas import ApproveRequest, RejectRequest

NOTICE_WINDOW_S = 600  # no máximo um aviso aos administradores a cada 10 minutos
_last_notice: float | None = None


def reset_notice_throttle() -> None:
    global _last_notice  # noqa: PLW0603
    _last_notice = None


async def notify_admins(db: AsyncSession, sender: EmailSender, newcomer: User) -> None:
    """Avisa os administradores de que há contas por aprovar (agregado: o email traz o total à espera)."""
    global _last_notice  # noqa: PLW0603
    now = time.monotonic()
    if _last_notice is not None and now - _last_notice < NOTICE_WINDOW_S:
        return
    _last_notice = now
    count = await users.count_pending(db)
    admins = (
        (
            await db.execute(
                select(User).where(User.role == "admin", User.is_active.is_(True), User.approval_status == "approved")
            )
        )
        .scalars()
        .all()
    )
    url = f"{get_settings().app_url.rstrip('/')}/users?tab=pending"
    for admin in admins:
        subject, html, text = emails.approval_requested(admin.locale, url, count, newcomer.name or newcomer.email)
        await auth_service.send_quietly(sender, admin.email, subject, html, text)


async def _target(db: AsyncSession, admin: User, user_id: uuid.UUID) -> User:
    if user_id == admin.id:
        raise CannotModifySelfError("You cannot approve or reject your own account")
    target = await db.get(User, user_id)
    if target is None:
        raise UserNotFoundError("User not found")
    return target


async def approve(
    db: AsyncSession, sender: EmailSender, admin: User, user_id: uuid.UUID, body: ApproveRequest, meta: RequestMeta
) -> User:
    target = await _target(db, admin, user_id)
    if target.approval_status == "approved":
        raise ConflictError("This account is already approved")
    if body.role == "admin" and not body.confirm_admin:
        raise AdminConfirmationRequiredError("Granting the administrator role needs confirm_admin")
    previous = target.approval_status
    target.approval_status = "approved"
    target.role = body.role
    target.approved_by_id = admin.id
    target.approved_at = datetime.now(UTC)
    target.rejected_reason = None
    await audit.record_by(
        db,
        admin,
        "user.approve",
        meta=meta,
        target_type="user",
        target_id=target.id,
        target_label=target.email,
        details={"role": body.role, "from": previous, "notified": body.notify},
    )
    await db.commit()
    if body.notify:
        url = f"{get_settings().app_url.rstrip('/')}/login"
        subject, html, text = emails.approval_granted(target.locale, url, target.name, target.role)
        await auth_service.send_quietly(sender, target.email, subject, html, text)
    return target


async def reject(
    db: AsyncSession, sender: EmailSender, admin: User, user_id: uuid.UUID, body: RejectRequest, meta: RequestMeta
) -> User:
    target = await _target(db, admin, user_id)
    if target.approval_status != "pending":
        raise ConflictError("Only accounts waiting for approval can be rejected")
    target.approval_status = "rejected"
    target.rejected_reason = body.reason
    await auth_service.revoke_all_sessions(db, target.id)
    await audit.record_by(
        db,
        admin,
        "user.reject",
        meta=meta,
        target_type="user",
        target_id=target.id,
        target_label=target.email,
        details={"has_reason": body.reason is not None, "notified": body.notify},
    )
    await db.commit()
    if body.notify:
        url = get_settings().app_url.rstrip("/")
        subject, html, text = emails.approval_rejected(target.locale, url, target.name, body.reason)
        await auth_service.send_quietly(sender, target.email, subject, html, text)
    return target
