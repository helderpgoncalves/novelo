"""Aprovação de contas: quem se regista por password ou Google fica `pending` até um administrador aprovar.

Convites, QR do evento, contas criadas por administradores e contas anteriores já são `approved`.
Sem imports de FastAPI.
"""

import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
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
from novelo.features.email_log import service as email_log
from novelo.features.email_log.models import EmailDelivery
from novelo.features.users import open_registration
from novelo.features.users import service as users
from novelo.features.users.models import User
from novelo.features.users.schemas import ApproveRequest, RejectRequest

log = logging.getLogger(__name__)

NOTICE_WINDOW = timedelta(minutes=10)  # no máximo um aviso aos administradores a cada 10 minutos
REMINDER_AFTER = timedelta(hours=24)  # contas pendentes há mais tempo entram no lembrete diário
REMINDER_EVERY = timedelta(hours=24)


@dataclass(frozen=True)
class Decision:
    """Resultado de aprovar/recusar: a conta e o email da decisão (`None` se `notify=false`)."""

    user: User
    delivery: EmailDelivery | None


async def _active_admins(db: AsyncSession) -> list[User]:
    return list(
        (
            await db.execute(
                select(User)
                .where(User.role == "admin", User.is_active.is_(True), User.approval_status == "approved")
                .order_by(User.created_at, User.id)
            )
        )
        .scalars()
        .all()
    )


async def notify_admins(db: AsyncSession, sender: EmailSender, newcomer: User) -> None:
    """Avisa os administradores de que há contas por aprovar (agregado: o email traz o total à espera).

    O limite de 10 minutos conta-se na base de dados (vale entre processos). Sem administradores com email fica
    registado um `skipped` (`no_recipients`) que o resumo de emails mostra como alerta."""
    await email_log.advisory_lock(db, "approval-requested")
    if await email_log.count_recent(
        db, ["approval_requested"], datetime.now(UTC) - NOTICE_WINDOW, include_failed=False
    ):
        await db.commit()
        return
    admins = await _active_admins(db)
    if not admins:
        await email_log.record_skipped(db, "approval_requested", "no-recipient", "no_recipients", user_id=newcomer.id)
        return
    count = await users.count_pending(db)
    url = f"{get_settings().app_url.rstrip('/')}/users?tab=pending"
    for admin in admins:
        subject, html, text = emails.approval_requested(admin.locale, url, count, newcomer.name or newcomer.email)
        await email_log.deliver(db, sender, "approval_requested", admin.email, subject, html, text, admin.id)


async def remind_if_overdue(db: AsyncSession, sender: EmailSender) -> None:
    """Lembrete diário aos administradores se há contas pendentes há mais de 24 h. Corre em pedidos de administrador
    (sem scheduler); o bloqueio na BD impede duplicados entre processos. Nunca parte o pedido."""
    try:
        overdue = int(
            await db.scalar(
                select(func.count())
                .select_from(User)
                .where(User.approval_status == "pending", User.created_at <= datetime.now(UTC) - REMINDER_AFTER)
            )
            or 0
        )
        if not overdue:
            return
        await email_log.advisory_lock(db, "pending-reminder")
        if await email_log.count_recent(db, ["pending_reminder"], datetime.now(UTC) - REMINDER_EVERY):
            await db.commit()
            return
        admins = await _active_admins(db)
        if not admins:
            await email_log.record_skipped(db, "pending_reminder", "no-recipient", "no_recipients")
            return
        url = f"{get_settings().app_url.rstrip('/')}/users?tab=pending"
        for admin in admins:
            subject, html, text = emails.pending_reminder(admin.locale, url, overdue)
            await email_log.deliver(db, sender, "pending_reminder", admin.email, subject, html, text, admin.id)
    except Exception as exc:
        log.warning("pending reminder failed: %s", exc.__class__.__name__)
        await db.rollback()


async def _target(db: AsyncSession, admin: User, user_id: uuid.UUID) -> User:
    if user_id == admin.id:
        raise CannotModifySelfError("You cannot approve or reject your own account")
    target = await db.get(User, user_id)
    if target is None:
        raise UserNotFoundError("User not found")
    return target


async def approve(
    db: AsyncSession, sender: EmailSender, admin: User, user_id: uuid.UUID, body: ApproveRequest, meta: RequestMeta
) -> Decision:
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
    delivery = await _send_granted(db, sender, target) if body.notify else None
    return Decision(target, delivery)


async def _send_granted(db: AsyncSession, sender: EmailSender, target: User) -> EmailDelivery:
    url = f"{get_settings().app_url.rstrip('/')}/login"
    subject, html, text = emails.approval_granted(target.locale, url, target.name, target.role)
    return await email_log.deliver(db, sender, "approval_granted", target.email, subject, html, text, target.id)


async def _send_rejected(db: AsyncSession, sender: EmailSender, target: User) -> EmailDelivery:
    url = get_settings().app_url.rstrip("/")
    subject, html, text = emails.approval_rejected(target.locale, url, target.name, target.rejected_reason)
    return await email_log.deliver(db, sender, "approval_rejected", target.email, subject, html, text, target.id)


async def reject(
    db: AsyncSession, sender: EmailSender, admin: User, user_id: uuid.UUID, body: RejectRequest, meta: RequestMeta
) -> Decision:
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
        # O SHA-256 do email sobrevive à eliminação da conta: o registo aberto nunca aprova um email já recusado.
        details={
            "has_reason": body.reason is not None,
            "notified": body.notify,
            "email_sha256": open_registration.email_digest(target.email),
        },
    )
    await db.commit()
    delivery = await _send_rejected(db, sender, target) if body.notify else None
    return Decision(target, delivery)


async def resend_email(
    db: AsyncSession, sender: EmailSender, admin: User, user_id: uuid.UUID, meta: RequestMeta
) -> Decision:
    """Reenvia o email que corresponde ao estado da conta (pedido recebido / aprovada / recusada)."""
    target = await _target(db, admin, user_id)
    if target.approval_status == "approved":
        delivery = await _send_granted(db, sender, target)
    elif target.approval_status == "rejected":
        delivery = await _send_rejected(db, sender, target)
    else:
        delivery = await auth_service.send_registration_received(db, sender, target)
    await audit.record_by(
        db,
        admin,
        "user.resend_email",
        meta=meta,
        target_type="user",
        target_id=target.id,
        target_label=target.email,
        details={"template": delivery.template, "status": delivery.status},
    )
    await db.commit()
    return Decision(target, delivery)
