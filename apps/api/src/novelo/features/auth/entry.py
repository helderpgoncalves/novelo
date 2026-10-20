"""Pedido de entrada por email (magic link e recuperação de palavra-passe) para TODOS os estados do email.

A resposta HTTP é sempre a mesma (204), mas o que sai é diferente e há SEMPRE um email real (ou um registo de
que não saiu), por isso ninguém fica à espera:

- conta ativa (aprovada ou por aprovar): link de entrada (ou de recuperação);
- conta desativada ou recusada: email curto sem link («fala com o administrador»);
- sem conta, convite por aceitar (pendente ou expirado): o convite é reenviado com um token novo;
- sem conta e sem convite aberto: email neutro «não encontrámos uma conta», limitado por destinatário e globalmente.

Falha do fornecedor -> `EmailUnavailableError` (503): como em todos os casos há um envio real, não revela nada.
Sem imports de FastAPI.
"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.email import EmailSender
from novelo.core.config import get_settings
from novelo.core.request_meta import RequestMeta
from novelo.core.security import hash_token, new_opaque_token
from novelo.features.auth import emails, passwordless
from novelo.features.auth.models import PasswordResetToken
from novelo.features.email_log import service as email_log
from novelo.features.users import invitations
from novelo.features.users import service as users
from novelo.features.users.models import User

log = logging.getLogger(__name__)

NOT_FOUND_PER_RECIPIENT = timedelta(minutes=30)


def _base() -> str:
    return get_settings().app_url.rstrip("/")


async def _account_email(
    db: AsyncSession, sender: EmailSender, user: User, flow: str, next_path: str | None, ip: str | None,
    user_agent: str | None, purpose: passwordless.Purpose,
) -> None:  # fmt: skip
    if not user.is_active or user.approval_status == "rejected":
        subject, html, text = emails.account_unavailable(
            user.locale, _base(), rejected=user.approval_status == "rejected"
        )
        await email_log.deliver(
            db, sender, "account_unavailable", user.email, subject, html, text, user.id, strict=True
        )
        return
    s = get_settings()
    if flow == "password_reset":
        token = new_opaque_token()
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=hash_token(token),
                expires_at=datetime.now(UTC) + timedelta(minutes=s.password_reset_minutes),
            )
        )
        await db.commit()
        subject, html, text = emails.password_reset(
            user.locale, f"{_base()}/reset-password?token={token}", s.password_reset_minutes
        )
        await email_log.deliver(db, sender, "password_reset", user.email, subject, html, text, user.id, strict=True)
        return
    token = await passwordless.create_token(db, user, purpose, passwordless.safe_next(next_path), ip, user_agent)
    subject, html, text = emails.magic_link(
        user.locale,
        f"{_base()}/magic-link?token={token}",
        s.magic_link_minutes,
        ip=ip,
        device=passwordless.device_of(user_agent),
    )
    await email_log.deliver(db, sender, "magic_link", user.email, subject, html, text, user.id, strict=True)


async def _not_found_email(db: AsyncSession, sender: EmailSender, email: str, locale: str) -> None:
    """Neutro: 1 por destinatário a cada 30 min e um teto global por hora (nunca spam a terceiros)."""
    s = get_settings()
    address = email.lower()
    await email_log.advisory_lock(db, f"not-found:{address}")
    now = datetime.now(UTC)
    if await email_log.count_recent(
        db, ["account_not_found"], now - NOT_FOUND_PER_RECIPIENT, to_email=address, include_failed=False
    ):
        await db.commit()
        return
    cap = s.email_not_found_per_hour
    if (
        cap
        and await email_log.count_recent(db, ["account_not_found"], now - timedelta(hours=1), include_failed=False)
        >= cap
    ):
        log.warning("not-found email cap reached (%d/hour): not sent", cap)
        await db.commit()
        return
    url = f"{_base()}/register" if s.allow_registration else _base()
    subject, html, text = emails.account_not_found(locale, url, registration_open=s.allow_registration)
    await email_log.deliver(db, sender, "account_not_found", address, subject, html, text, strict=True)


async def request_entry(
    db: AsyncSession,
    sender: EmailSender,
    email: str,
    *,
    flow: str,
    locale: str,
    next_path: str | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
    meta: RequestMeta | None = None,
    purpose: passwordless.Purpose = "magic_link",
) -> None:
    """Faz o trabalho de TODOS os estados e devolve `None`; o chamador responde 204 sempre."""
    user = await users.get_by_email(db, email)
    if user is not None:
        await _account_email(db, sender, user, flow, next_path, ip, user_agent, purpose)
        return
    if await invitations.self_resend(db, sender, email, meta):
        return
    await _not_found_email(db, sender, email, locale)
