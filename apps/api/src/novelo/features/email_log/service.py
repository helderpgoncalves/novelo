"""Envio de emails com registo: `deliver()` é o ÚNICO ponto por onde a API envia emails.

Guarda só metadados em `email_deliveries` (nunca assunto, corpo, links nem tokens). Repete erros transitórios
(até 3 tentativas em ~12 s, backoff exponencial com jitter, respeita `Retry-After`), nunca repete os permanentes,
usa uma chave de idempotência (um reenvio de rede não duplica o email), respeita a lista de supressão e tem um
disjuntor em memória para não prender pedidos de utilizadores quando o fornecedor está em baixo.
Sem imports de FastAPI.
"""

import asyncio
import logging
import random
import time
import uuid
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.email import EmailSender, EmailSendError
from novelo.core.config import get_settings
from novelo.core.errors import AppError, EmailSuppressedError, EmailUnavailableError, FeatureDisabledError
from novelo.features.email_log.models import EmailDelivery, EmailSuppression

log = logging.getLogger(__name__)

MAX_ATTEMPTS = 3
BUDGET_S = 12.0
# Falhas do fornecedor (não do destinatário): são as que abrem o disjuntor.
PROVIDER_LEVEL = frozenset(
    {"timeout", "network", "rate_limited", "provider_down", "provider_auth", "domain_not_verified", "quota_exceeded"}
)
sleep = asyncio.sleep  # os testes trocam-no por uma função que não espera

# Ordem dos estados: um evento só avança, nunca regride (delivered nunca volta a sent).
RANK = {"queued": 0, "skipped": 0, "sent": 1, "delayed": 2, "delivered": 3, "bounced": 4, "failed": 4, "complained": 5}
EVENT_STATUS = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.delivery_delayed": "delayed",
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.failed": "failed",
}


def mask_email(address: str) -> str:
    """`lucas@x.pt` -> `l***@x.pt`: os logs nunca levam o endereço completo."""
    local, _, domain = address.lower().partition("@")
    return f"{local[:1]}***@{domain}" if domain else "***"


class CircuitBreaker:
    """Depois de `threshold` falhas seguidas do fornecedor, recusa durante `cooldown_s` e volta a experimentar."""

    def __init__(self, threshold: int = 5, cooldown_s: float = 30.0) -> None:
        self.threshold, self.cooldown_s = threshold, cooldown_s
        self.failures = 0
        self.opened_at: float | None = None

    def allow(self) -> bool:
        if self.opened_at is None:
            return True
        now = time.monotonic()
        if now - self.opened_at >= self.cooldown_s:
            self.opened_at = now  # meio aberto: deixa passar UMA tentativa por período
            return True
        return False

    def success(self) -> None:
        self.failures, self.opened_at = 0, None

    def failure(self) -> None:
        self.failures += 1
        if self.failures >= self.threshold:
            self.opened_at = time.monotonic()

    def reset(self) -> None:
        self.success()


breaker = CircuitBreaker()


def _now() -> datetime:
    return datetime.now(UTC)


async def advisory_lock(db: AsyncSession, key: str) -> None:
    """Bloqueio até ao fim da transação (commit/rollback): serializa decisões «já enviámos há pouco?» entre workers."""
    await db.execute(select(func.pg_advisory_xact_lock(func.hashtextextended(key, 0))))


async def count_recent(
    db: AsyncSession,
    templates: Iterable[str],
    since: datetime,
    *,
    to_email: str | None = None,
    invitation_id: uuid.UUID | None = None,
    include_failed: bool = True,
) -> int:
    """Envios (não os `skipped`) dos modelos indicados desde `since`. Os limites de reenvio passam
    `include_failed=False`: um envio que falhou não pode deixar ninguém bloqueado sem email."""
    query = (
        select(func.count())
        .select_from(EmailDelivery)
        .where(
            EmailDelivery.template.in_(list(templates)),
            EmailDelivery.created_at >= since,
            EmailDelivery.status != "skipped",
        )
    )
    if not include_failed:
        query = query.where(EmailDelivery.status != "failed")
    if to_email is not None:
        query = query.where(EmailDelivery.to_email == to_email.lower())
    if invitation_id is not None:
        query = query.where(EmailDelivery.invitation_id == invitation_id)
    return int(await db.scalar(query) or 0)


async def suppression_for(db: AsyncSession, to: str) -> EmailSuppression | None:
    return (
        await db.execute(select(EmailSuppression).where(EmailSuppression.to_email == to.lower()))
    ).scalar_one_or_none()


async def record_skipped(
    db: AsyncSession,
    template: str,
    to: str,
    reason: str,
    *,
    user_id: uuid.UUID | None = None,
    invitation_id: uuid.UUID | None = None,
) -> EmailDelivery:
    """Regista que NÃO se enviou (sem destinatários, destinatário suprimido...): nunca em silêncio."""
    row = EmailDelivery(
        to_email=to.lower()[:255],
        template=template,
        user_id=user_id,
        invitation_id=invitation_id,
        status="skipped",
        error_code=reason[:60],
    )
    db.add(row)
    await db.commit()
    return row


def _backoff(attempt: int, retry_after_s: float | None) -> float:
    base = get_settings().email_retry_backoff_s * (2 ** (attempt - 1))
    delay = base * random.uniform(0.5, 1.5)
    return float(max(delay, retry_after_s or 0.0))


async def deliver(
    db: AsyncSession,
    sender: EmailSender,
    template: str,
    to: str,
    subject: str,
    html: str,
    text: str,
    user_id: uuid.UUID | None = None,
    invitation_id: uuid.UUID | None = None,
    *,
    strict: bool = False,
) -> EmailDelivery:
    """Envia, regista e devolve o registo. Nunca deixa uma falha desaparecer: fica `failed` com `error_code`.

    Com `strict=True` (pedidos do próprio utilizador, que esperam pelo email) levanta `EmailUnavailableError`
    (falhou) ou `EmailSuppressedError` (o destinatário não recebe emails)."""
    suppressed = await suppression_for(db, to)
    if suppressed is not None:
        row = await record_skipped(
            db, template, to, f"suppressed_{suppressed.reason}", user_id=user_id, invitation_id=invitation_id
        )
        log.info("email skipped template=%s to=%s reason=%s", template, mask_email(to), row.error_code)
        if strict:
            raise EmailSuppressedError("This address does not receive emails")
        return row
    row = EmailDelivery(
        to_email=to.lower()[:255], template=template, user_id=user_id, invitation_id=invitation_id, status="queued"
    )
    db.add(row)
    await db.commit()
    if not breaker.allow():
        row.status, row.error_code = "failed", "circuit_open"
        await db.commit()
        log.warning("email not attempted template=%s to=%s reason=circuit_open", template, mask_email(to))
        if strict:
            raise EmailUnavailableError("Email delivery is temporarily unavailable")
        return row
    key = f"novelo-{template}-{row.id}"
    started = time.monotonic()
    for attempt in range(1, MAX_ATTEMPTS + 1):
        row.attempts = attempt
        result = await _try_send(sender, template, to, subject, html, text, key)
        if result.code is None:
            row.status, row.error_code, row.sent_at = "sent", None, _now()
            row.provider_message_id = result.provider_id[:100] if result.provider_id else None
            breaker.success()
            log.info("email sent template=%s to=%s attempt=%d", template, mask_email(to), attempt)
            break
        row.error_code = result.code
        _track_breaker(result.code)
        log.warning(
            "email attempt failed template=%s to=%s attempt=%d code=%s", template, mask_email(to), attempt, result.code
        )
        delay = _backoff(attempt, result.retry_after)
        if not result.transient or attempt == MAX_ATTEMPTS or time.monotonic() - started + delay >= BUDGET_S:
            row.status = "failed"
            break
        await sleep(delay)
    row.updated_at = _now()  # explícito: evita que o `onupdate` do servidor expire o objeto
    await db.commit()
    if strict and row.status == "failed":
        raise EmailUnavailableError("Could not send the email")
    return row


@dataclass
class _Attempt:
    provider_id: str | None = None
    code: str | None = None  # None = o fornecedor aceitou
    transient: bool = False
    retry_after: float | None = None


async def _try_send(
    sender: EmailSender, template: str, to: str, subject: str, html: str, text: str, key: str
) -> _Attempt:
    try:
        return _Attempt(
            provider_id=await sender.send(to=to, subject=subject, html=html, text=text, idempotency_key=key)
        )
    except EmailSendError as exc:
        return _Attempt(code=exc.error_code, transient=exc.transient, retry_after=exc.retry_after_s)
    except FeatureDisabledError:  # inclui EmailUnavailableError: sem fornecedor configurado
        return _Attempt(code="not_configured")
    except AppError:
        return _Attempt(code="provider_error")
    except Exception as exc:
        log.warning("email unexpected error template=%s type=%s", template, exc.__class__.__name__)
        return _Attempt(code="unexpected")


def _track_breaker(code: str) -> None:
    if code in PROVIDER_LEVEL or code == "unexpected":
        breaker.failure()
    elif code != "not_configured":
        breaker.success()  # o fornecedor respondeu: o problema é do pedido/destinatário


def warning_of(row: EmailDelivery | None) -> tuple[str, str | None] | None:
    """(`email_failed`|`email_skipped`, error_code) se o email não saiu; `None` se saiu (ou não havia email)."""
    if row is None or row.status not in {"failed", "skipped"}:
        return None
    return ("email_failed" if row.status == "failed" else "email_skipped"), row.error_code


async def apply_event(
    db: AsyncSession, provider_message_id: str, event_type: str, bounce_type: str | None = None
) -> bool:
    """Aplica um evento do webhook (ou da reconciliação) ao envio. Idempotente e só avança. `True` = mudou."""
    status = EVENT_STATUS.get(event_type, event_type)
    if status not in RANK:
        return False
    row = (
        await db.execute(
            select(EmailDelivery)
            .where(EmailDelivery.provider_message_id == provider_message_id)
            .order_by(EmailDelivery.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    now = _now()
    row.updated_at = now
    changed = RANK[status] > RANK.get(row.status, 0)
    if changed:
        row.status = status
        if status == "delivered":
            row.delivered_at = now
            row.error_code = None
        elif status == "sent" and row.sent_at is None:
            row.sent_at = now
        elif status in {"bounced", "failed", "complained"}:
            kind = "".join(c for c in (bounce_type or "").lower() if c.isalpha())[:20]
            row.error_code = f"{status}_{kind}" if kind else status
    # Só ressaltos PERMANENTES e queixas de spam suprimem; atrasos e ressaltos transitórios nunca.
    if (status == "bounced" and (bounce_type or "").lower() == "permanent") or status == "complained":
        await _suppress(db, row, "bounced" if status == "bounced" else "complained")
    await db.commit()
    return changed


async def _suppress(db: AsyncSession, row: EmailDelivery, reason: str) -> None:
    if await suppression_for(db, row.to_email) is None:
        db.add(EmailSuppression(to_email=row.to_email, reason=reason, source_delivery_id=row.id))
        log.warning("email suppressed to=%s reason=%s", mask_email(row.to_email), reason)


async def latest_by_invitation(db: AsyncSession, ids: list[uuid.UUID]) -> dict[uuid.UUID, EmailDelivery]:
    if not ids:
        return {}
    rows = (
        await db.execute(
            select(EmailDelivery)
            .where(EmailDelivery.invitation_id.in_(ids))
            .ext(distinct_on(EmailDelivery.invitation_id))
            .order_by(EmailDelivery.invitation_id, EmailDelivery.created_at.desc())
        )
    ).scalars()
    return {r.invitation_id: r for r in rows if r.invitation_id is not None}


async def latest_for_user(
    db: AsyncSession, user_ids: list[uuid.UUID], templates: tuple[str, ...]
) -> dict[uuid.UUID, EmailDelivery]:
    if not user_ids:
        return {}
    rows = (
        await db.execute(
            select(EmailDelivery)
            .where(EmailDelivery.user_id.in_(user_ids), EmailDelivery.template.in_(templates))
            .ext(distinct_on(EmailDelivery.user_id))
            .order_by(EmailDelivery.user_id, EmailDelivery.created_at.desc())
        )
    ).scalars()
    return {r.user_id: r for r in rows if r.user_id is not None}


def since(**kwargs: float) -> datetime:
    return _now() - timedelta(**kwargs)
