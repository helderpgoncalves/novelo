"""Visão do administrador sobre os emails: listas, resumo, alertas, reconciliação com o Resend e supressões.

Sem imports de FastAPI. Nada aqui guarda nem devolve corpos, assuntos, links ou tokens.
"""

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import cast

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.email import EmailSender, EmailStatusReader
from novelo.core.config import get_settings
from novelo.core.errors import ConflictError, NotFoundError
from novelo.features.auth import emails
from novelo.features.email_log import service
from novelo.features.email_log.models import EmailDelivery, EmailSuppression
from novelo.features.email_log.schemas import (
    DeliveryTracking,
    EmailAlertKind,
    EmailDeliveryOut,
    EmailDeliveryPage,
    EmailHealth,
    EmailSummary,
    FailureCount,
    StatusCounts,
    SuppressionOut,
    SuppressionPage,
    SuppressionReasonOut,
)
from novelo.features.users.models import User

log = logging.getLogger(__name__)

FAILED_STATES = ("failed", "bounced", "complained")
RECONCILE_TTL_S = 60.0
RECONCILE_MAX = 20
RECONCILE_CONCURRENCY = 3
RECONCILE_TIMEOUT_S = 8.0
RECONCILE_WINDOW_H = 72
UNCONFIRMED_MIN = 15
ALERTS_TTL_S = 60.0
ALERT_EMAIL_EVERY_H = 6
LAST_EVENT_STATUS = {
    "sent": "sent",
    "delivered": "delivered",
    "opened": "delivered",
    "clicked": "delivered",
    "delivery_delayed": "delayed",
    "bounced": "bounced",
    "complained": "complained",
    "failed": "failed",
}
_last_reconcile: float | None = None
_alerts_cache: tuple[float, list[EmailAlertKind]] | None = None


def reset_caches() -> None:
    global _last_reconcile, _alerts_cache  # noqa: PLW0603
    _last_reconcile = _alerts_cache = None


def tracking_mode(reader: EmailStatusReader | None = None) -> DeliveryTracking:
    s = get_settings()
    api = bool(s.resend_read_api_key) if reader is None else reader.configured
    if api and s.webhook_configured:
        return "api+webhook"
    if s.webhook_configured:
        return "webhook"
    return "api" if api else "provider_accepted_only"


def to_out(row: EmailDelivery) -> EmailDeliveryOut:
    return EmailDeliveryOut.model_validate(row, from_attributes=True)


async def list_deliveries(
    db: AsyncSession, *, offset: int, limit: int, status: str | None, template: str | None, q: str | None
) -> EmailDeliveryPage:
    where = []
    if status:
        where.append(EmailDelivery.status == status)
    if template:
        where.append(EmailDelivery.template == template)
    if q and q.strip():
        where.append(EmailDelivery.to_email.like(f"%{q.strip().lower()}%"))
    total = await db.scalar(select(func.count()).select_from(EmailDelivery).where(*where)) or 0
    rows = (
        (
            await db.execute(
                select(EmailDelivery)
                .where(*where)
                .order_by(EmailDelivery.created_at.desc(), EmailDelivery.id)
                .offset(offset)
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return EmailDeliveryPage(items=[to_out(r) for r in rows], total=int(total), offset=offset, limit=limit)


async def get_delivery(db: AsyncSession, delivery_id: uuid.UUID) -> EmailDeliveryOut:
    row = await db.get(EmailDelivery, delivery_id)
    if row is None:
        raise NotFoundError("Email not found")
    return to_out(row)


# --- reconciliação com a API do Resend (opcional, precisa de RESEND_READ_API_KEY) ---------------------------------


@dataclass(frozen=True)
class Reconciled:
    checked: int
    updated: int


async def reconcile(
    db: AsyncSession, reader: EmailStatusReader, *, force: bool = False, limit: int = RECONCILE_MAX
) -> Reconciled:
    """Consulta o Resend sobre os envios em `sent`/`delayed` com menos de 72 h. Erros são ignorados (só log)."""
    global _last_reconcile  # noqa: PLW0603
    if not reader.configured:
        return Reconciled(0, 0)
    now = time.monotonic()
    if not force and _last_reconcile is not None and now - _last_reconcile < RECONCILE_TTL_S:
        return Reconciled(0, 0)
    _last_reconcile = now
    rows = (
        (
            await db.execute(
                select(EmailDelivery)
                .where(
                    EmailDelivery.status.in_(("sent", "delayed")),
                    EmailDelivery.provider_message_id.is_not(None),
                    EmailDelivery.provider_message_id.not_like("dev-%"),
                    EmailDelivery.created_at >= service.since(hours=RECONCILE_WINDOW_H),
                )
                .order_by(EmailDelivery.updated_at.asc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    sem = asyncio.Semaphore(RECONCILE_CONCURRENCY)

    async def look(provider_id: str) -> str | None:
        async with sem:
            try:
                return await reader.last_event(provider_id)
            except Exception as exc:
                log.warning("reconcile lookup failed: %s", exc.__class__.__name__)
                return None

    ids = [(r.id, r.provider_message_id) for r in rows if r.provider_message_id]
    try:
        events = await asyncio.wait_for(asyncio.gather(*(look(p) for _, p in ids)), RECONCILE_TIMEOUT_S)
    except TimeoutError:
        log.warning("reconcile timed out")
        events = [None] * len(ids)
    updated = 0
    for (_, provider_id), event in zip(ids, events, strict=True):
        status = LAST_EVENT_STATUS.get(event or "")
        if status is None:
            continue
        # Só o evento: o tipo de ressalto não vem de `last_event`, por isso a reconciliação não suprime.
        if await service.apply_event(db, provider_id, status):
            updated += 1
    return Reconciled(len(ids), updated)


# --- resumo e alertas --------------------------------------------------------------------------------------------


async def _counts(db: AsyncSession, since: datetime) -> StatusCounts:
    rows = (
        await db.execute(
            select(EmailDelivery.status, func.count())
            .where(EmailDelivery.created_at >= since)
            .group_by(EmailDelivery.status)
        )
    ).all()
    data = {status: int(n) for status, n in rows}
    return StatusCounts(**data, total=sum(data.values()))


async def _failures_last_hour(db: AsyncSession) -> tuple[int, int]:
    """(envios tentados, falhados) na última hora, sem contar os avisos de alerta."""
    attempted, failed = (
        await db.execute(
            select(
                func.count(),
                func.count(case((EmailDelivery.status.in_(FAILED_STATES), 1))),
            ).where(
                EmailDelivery.created_at >= service.since(hours=1),
                EmailDelivery.status.not_in(("skipped", "queued")),
                EmailDelivery.template != "email_alert",
            )
        )
    ).one()
    return int(attempted), int(failed)


async def compute_alerts(db: AsyncSession) -> list[EmailAlertKind]:
    s = get_settings()
    alerts: list[EmailAlertKind] = []
    if s.environment == "production" and not s.email_provider_configured:
        alerts.append("provider_not_configured")
    attempted, failed = await _failures_last_hour(db)
    if failed >= 3:
        alerts.append("failures_last_hour")
    if attempted >= 5 and failed / attempted > 0.2:
        alerts.append("high_failure_rate")
    last_code = await db.scalar(
        select(EmailDelivery.error_code)
        .where(EmailDelivery.status != "skipped", EmailDelivery.template != "email_alert")
        .order_by(EmailDelivery.created_at.desc())
        .limit(1)
    )
    if last_code == "provider_auth":
        alerts.append("provider_auth_invalid")
    elif last_code == "domain_not_verified":
        alerts.append("domain_not_verified")
    no_recipients = await db.scalar(
        select(func.count())
        .select_from(EmailDelivery)
        .where(
            EmailDelivery.status == "skipped",
            EmailDelivery.error_code == "no_recipients",
            EmailDelivery.created_at >= service.since(hours=24),
        )
    )
    if no_recipients:
        alerts.append("no_admin_recipients")
    if s.webhook_configured:
        recent_sent = await db.scalar(
            select(func.count())
            .select_from(EmailDelivery)
            .where(
                EmailDelivery.provider_message_id.is_not(None),
                EmailDelivery.provider_message_id.not_like("dev-%"),
                EmailDelivery.sent_at >= service.since(hours=24),
                EmailDelivery.sent_at <= service.since(hours=1),
            )
        )
        confirmed = await db.scalar(
            select(func.count())
            .select_from(EmailDelivery)
            .where(
                EmailDelivery.status.in_(("delivered", "delayed", "bounced", "complained")),
                EmailDelivery.updated_at >= service.since(hours=24),
            )
        )
        if recent_sent and not confirmed:
            alerts.append("webhook_silent")
    return alerts


async def alerts_cached(db: AsyncSession, *, force: bool = False) -> list[EmailAlertKind]:
    global _alerts_cache  # noqa: PLW0603
    now = time.monotonic()
    if not force and _alerts_cache is not None and now - _alerts_cache[0] < ALERTS_TTL_S:
        return _alerts_cache[1]
    result = await compute_alerts(db)
    _alerts_cache = (now, result)
    return result


async def summary(db: AsyncSession) -> EmailSummary:
    s = get_settings()
    day, week = service.since(hours=24), service.since(days=7)
    c24, c7 = await _counts(db, day), await _counts(db, week)
    _, failed_hour = await _failures_last_hour(db)
    accepted = c24.sent + c24.delivered + c24.delayed
    attempted = accepted + c24.bounced + c24.complained + c24.failed
    by_code = (
        await db.execute(
            select(EmailDelivery.error_code, func.count())
            .where(
                EmailDelivery.created_at >= day,
                EmailDelivery.status.in_(FAILED_STATES),
                EmailDelivery.error_code.is_not(None),
            )
            .group_by(EmailDelivery.error_code)
            .order_by(func.count().desc())
            .limit(10)
        )
    ).all()
    delay = await db.scalar(
        select(func.avg(func.extract("epoch", EmailDelivery.delivered_at - EmailDelivery.sent_at))).where(
            EmailDelivery.delivered_at.is_not(None), EmailDelivery.delivered_at >= day
        )
    )
    tracking = tracking_mode()
    unconfirmed = 0
    if tracking != "provider_accepted_only":
        unconfirmed = int(
            await db.scalar(
                select(func.count())
                .select_from(EmailDelivery)
                .where(
                    EmailDelivery.status == "sent",
                    EmailDelivery.provider_message_id.is_not(None),
                    EmailDelivery.provider_message_id.not_like("dev-%"),
                    EmailDelivery.sent_at <= service.since(minutes=UNCONFIRMED_MIN),
                    EmailDelivery.sent_at >= service.since(hours=RECONCILE_WINDOW_H),
                )
            )
            or 0
        )
    last_failure = await db.scalar(
        select(func.max(EmailDelivery.updated_at)).where(EmailDelivery.status.in_(FAILED_STATES))
    )
    return EmailSummary(
        provider_configured=s.email_provider_configured,
        webhook_configured=s.webhook_configured,
        read_key_configured=bool(s.resend_read_api_key),
        delivery_tracking=tracking,
        last_24h=c24,
        last_7d=c7,
        last_failure_at=last_failure,
        failures_last_hour=failed_hour,
        success_rate_24h_pct=round(100 * accepted / attempted, 1) if attempted else None,
        failures_by_error_code=[FailureCount(error_code=str(code), count=int(n)) for code, n in by_code],
        avg_delivery_delay_s=round(float(delay), 1) if delay is not None else None,
        unconfirmed=unconfirmed,
        alerts=await alerts_cached(db, force=True),
    )


async def email_health(db: AsyncSession) -> EmailHealth:
    """Para `/ready`: o email está bem, sem fornecedor em produção ou a falhar (≥ 3 falhas na última hora)."""
    if get_settings().environment == "production" and not get_settings().email_provider_configured:
        return "not_configured"
    _, failed = await _failures_last_hour(db)
    return "failing" if failed >= 3 else "ok"


async def oldest_admin(db: AsyncSession) -> User | None:
    return (
        await db.execute(
            select(User)
            .where(User.role == "admin", User.is_active.is_(True), User.approval_status == "approved")
            .order_by(User.created_at, User.id)
            .limit(1)
        )
    ).scalar_one_or_none()


async def notify_alerts(db: AsyncSession, sender: EmailSender, kinds: list[EmailAlertKind]) -> None:
    """No máximo um email de alerta a cada 6 h, ao administrador mais antigo (bloqueio na BD: vale entre workers)."""
    await service.advisory_lock(db, "email-alert")
    if await service.count_recent(db, ["email_alert"], service.since(hours=ALERT_EMAIL_EVERY_H)):
        await db.commit()
        return
    admin = await oldest_admin(db)
    if admin is None:
        await db.commit()
        return
    url = f"{get_settings().app_url.rstrip('/')}/users?tab=emails"
    subject, html, text = emails.email_alert(admin.locale, url, list(kinds))
    await service.deliver(db, sender, "email_alert", admin.email, subject, html, text, user_id=admin.id)


async def admin_tick(db: AsyncSession, sender: EmailSender) -> list[EmailAlertKind]:
    """Corre em pedidos de administradores (sem scheduler): atualiza os alertas e avisa, no máximo, de 6 em 6 h."""
    try:
        kinds = await alerts_cached(db)
        if kinds:
            await notify_alerts(db, sender, kinds)
        return kinds
    except Exception as exc:
        log.warning("email monitoring failed: %s", exc.__class__.__name__)
        await db.rollback()
        return []


async def send_test(db: AsyncSession, sender: EmailSender, admin: User) -> EmailDeliveryOut:
    subject, html, text = emails.test_email(admin.locale, admin.name)
    row = await service.deliver(db, sender, "test_email", admin.email, subject, html, text, user_id=admin.id)
    return to_out(row)


# --- supressões ---------------------------------------------------------------------------------------------------


def suppression_out(row: EmailSuppression) -> SuppressionOut:
    return SuppressionOut(
        id=row.id,
        to_email=row.to_email,
        reason=cast(SuppressionReasonOut, row.reason),
        source_delivery_id=row.source_delivery_id,
        created_at=row.created_at,
    )


async def list_suppressions(db: AsyncSession, q: str | None) -> SuppressionPage:
    where = [EmailSuppression.to_email.like(f"%{q.strip().lower()}%")] if q and q.strip() else []
    rows = (
        (
            await db.execute(
                select(EmailSuppression).where(*where).order_by(EmailSuppression.created_at.desc()).limit(500)
            )
        )
        .scalars()
        .all()
    )
    return SuppressionPage(items=[suppression_out(r) for r in rows], total=len(rows))


async def add_suppression(db: AsyncSession, email: str) -> EmailSuppression:
    address = email.strip().lower()
    if "@" not in address:
        raise ConflictError("Not a valid email address")
    if await service.suppression_for(db, address) is not None:
        raise ConflictError("This address is already suppressed")
    row = EmailSuppression(to_email=address, reason="manual")
    db.add(row)
    await db.flush()
    return row


async def remove_suppression(db: AsyncSession, suppression_id: uuid.UUID) -> EmailSuppression:
    row = await db.get(EmailSuppression, suppression_id)
    if row is None:
        raise NotFoundError("Suppression not found")
    await db.delete(row)
    return row
