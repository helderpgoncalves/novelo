"""Entrada sem password: magic link (principal) e entrada por QR do evento (convidados).

Sem imports de FastAPI. Só o SHA-256 dos tokens fica na base de dados; uso único e atómico.
Não revela se um email tem conta: quem chama responde sempre da mesma forma.
"""

import hmac
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal
from urllib.parse import quote

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.email import EmailSender
from novelo.core.avatar import safe_avatar_url
from novelo.core.config import get_settings
from novelo.core.errors import FeatureDisabledError, InvalidEventCodeError, InvalidTokenError, RateLimitError
from novelo.core.request_meta import RequestMeta
from novelo.core.security import hash_token, new_opaque_token
from novelo.features.auth import emails, service
from novelo.features.auth.models import LoginToken
from novelo.features.auth.schemas import GuestOut, GuestPage
from novelo.features.copilot.models import CopilotAction, CopilotMessage, CopilotThread
from novelo.features.email_log import service as email_log
from novelo.features.users import open_registration
from novelo.features.users import service as users
from novelo.features.users.models import User

log = logging.getLogger(__name__)

Purpose = Literal["magic_link", "quick_join"]


def safe_next(value: str | None) -> str:
    """Só caminhos relativos do próprio site (anti open-redirect); o resto vira `/`."""
    if not value or len(value) > 255 or not value.startswith("/") or value.startswith(("//", "/\\")):
        return "/"
    if "\\" in value or any(ord(c) < 32 or ord(c) == 127 for c in value):
        return "/"
    return value


def device_of(user_agent: str | None) -> str | None:
    if not user_agent:
        return None
    ua = user_agent.lower()
    browser = next(
        (
            n
            for k, n in (("edg/", "Edge"), ("firefox", "Firefox"), ("chrome", "Chrome"), ("safari", "Safari"))
            if k in ua
        ),
        None,
    )
    system = next(
        (
            n
            for k, n in (
                ("iphone", "iPhone"),
                ("ipad", "iPad"),
                ("android", "Android"),
                ("windows", "Windows"),
                ("mac os", "Mac"),
                ("linux", "Linux"),
            )
            if k in ua
        ),
        None,
    )
    if browser and system:
        return f"{browser} · {system}"
    return browser or system


async def create_token(
    db: AsyncSession, user: User, purpose: Purpose, next_path: str, ip: str | None, user_agent: str | None
) -> str:
    token = new_opaque_token()
    db.add(
        LoginToken(
            user_id=user.id,
            token_hash=hash_token(token),
            purpose=purpose,
            next_path=next_path,
            expires_at=datetime.now(UTC) + timedelta(minutes=get_settings().magic_link_minutes),
            ip=ip[:45] if ip else None,
            user_agent=user_agent[:255] if user_agent else None,
        )
    )
    await db.commit()
    return token


async def verify_magic_link(db: AsyncSession, token: str) -> tuple[User, str, str, str]:
    """Consome o token (uma só vez, atomicamente) e inicia uma sessão longa. Devolve (user, access, refresh, next)."""
    now = datetime.now(UTC)
    consumed = (
        await db.execute(
            update(LoginToken)
            .where(
                LoginToken.token_hash == hash_token(token), LoginToken.used_at.is_(None), LoginToken.expires_at > now
            )
            .values(used_at=now)
            .returning(LoginToken.user_id, LoginToken.next_path)
        )
    ).first()
    if consumed is None:
        await db.rollback()
        raise InvalidTokenError("Invalid or expired sign-in link")
    user = await db.get(User, consumed.user_id)
    if user is None or not user.is_active:
        await db.commit()  # o token fica gasto na mesma
        raise InvalidTokenError("Invalid or expired sign-in link")
    await service.claim_unverified_account(db, user)
    user.email_verified = True  # o link chegou à caixa de correio: provou a posse do email
    await open_registration.auto_approve_if_open(db, user, "magic_link")
    access, refresh = await service.issue_session(db, user, remember=True)
    return user, access, refresh, safe_next(consumed.next_path)


def _codes_match(given: str) -> bool:
    expected = get_settings().quick_join_secret.encode()
    return hmac.compare_digest(given.strip().encode(), expected)


def require_quick_join_enabled() -> None:
    if not get_settings().quick_join_active:
        raise FeatureDisabledError("Quick join is not enabled")


def check_event_code(code: str) -> None:
    require_quick_join_enabled()
    if not _codes_match(code):
        raise InvalidEventCodeError("Invalid event code")


@dataclass(frozen=True)
class QuickJoinOutcome:
    user: User | None  # só se a sessão foi iniciada
    access: str | None
    refresh: str | None


async def _enforce_signup_cap(db: AsyncSession) -> None:
    """Teto GLOBAL de entradas por QR na última hora, sem depender do IP (wifi do evento, IPs rotativos, botnet).
    Aplica-se a emails novos e existentes, para o teto não servir de oráculo de contas."""
    cap = get_settings().guest_signups_per_hour
    if not cap:
        return
    since = datetime.now(UTC) - timedelta(hours=1)
    joined = await db.scalar(
        select(func.count()).select_from(User).where(User.joined_via == "quick_join", User.created_at >= since)
    )
    if (joined or 0) >= cap:
        raise RateLimitError("The event is receiving too many new guests right now. Try again in a few minutes.")


async def quick_join(
    db: AsyncSession,
    sender: EmailSender,
    *,
    name: str,
    email: str,
    locale: str,
    ip: str | None,
    user_agent: str | None,
    meta: RequestMeta | None = None,
) -> QuickJoinOutcome:
    """Email novo: cria um convidado e inicia sessão. Email com conta: NUNCA inicia sessão (anti-tomada de conta),
    só envia um link de entrada para a caixa de correio do dono. O código do evento já foi validado."""
    s = get_settings()
    await _enforce_signup_cap(db)
    existing = await users.get_by_email(db, email)
    if existing is None:
        try:
            user = await users.create_user(
                db,
                email=email,
                name=name,
                role="guest",
                email_verified=False,  # ninguém provou a posse do email: ver `claim_unverified_account`
                locale=locale,
                joined_via="quick_join",
                consent_at=datetime.now(UTC),
                consent_version=s.quick_join_consent_version,
            )
        except IntegrityError:  # corrida: alguém criou o mesmo email entre a leitura e a escrita
            await db.rollback()
            existing = await users.get_by_email(db, email)
        else:
            access, refresh = await service.issue_session(db, user, remember=True)
            subject, html, text = emails.guest_welcome(locale, name, f"{s.app_url.rstrip('/')}/login")
            # O convidado já tem sessão: se o email falhar fica registado, mas não o impede de entrar.
            await email_log.deliver(db, sender, "guest_welcome", user.email, subject, html, text, user.id)
            return QuickJoinOutcome(user, access, refresh)
    from novelo.features.auth import entry  # noqa: PLC0415  (entry importa este módulo)

    await entry.request_entry(
        db, sender, email, flow="magic_link", locale=locale, next_path="/", ip=ip, user_agent=user_agent,
        meta=meta, purpose="quick_join",
    )  # fmt: skip
    return QuickJoinOutcome(None, None, None)


async def list_guests(db: AsyncSession, offset: int, limit: int, q: str | None) -> GuestPage:
    messages = (
        select(func.count())
        .select_from(CopilotMessage)
        .join(CopilotThread, CopilotThread.id == CopilotMessage.thread_id)
        .where(CopilotThread.user_id == User.id, CopilotMessage.role == "user")
        .scalar_subquery()
    )
    actions = select(func.count()).select_from(CopilotAction).where(CopilotAction.user_id == User.id).scalar_subquery()
    where = [User.joined_via == "quick_join"]
    if q and q.strip():
        like = f"%{q.strip().lower()}%"
        where.append(func.lower(func.coalesce(User.name, "") + " " + User.email).like(like))
    total = await db.scalar(select(func.count()).select_from(User).where(*where)) or 0
    rows = (
        await db.execute(
            select(User, (messages + actions).label("n"))
            .where(*where)
            .order_by(User.created_at.desc(), User.id)
            .offset(offset)
            .limit(limit)
        )
    ).all()
    items = [
        GuestOut(
            id=u.id,
            name=u.name,
            avatar_url=safe_avatar_url(u.avatar_url),
            email=u.email,
            email_verified=u.email_verified,
            is_active=u.is_active,
            joined_at=u.created_at,
            last_login_at=u.last_login_at,
            actions_count=int(n or 0),
            consent_at=u.consent_at,
            consent_version=u.consent_version,
        )
        for u, n in rows
    ]
    return GuestPage(items=items, total=int(total), offset=offset, limit=limit)


def event_url() -> str:
    s = get_settings()
    return f"{s.app_url.rstrip('/')}/join?c={quote(s.quick_join_secret, safe='')}"
