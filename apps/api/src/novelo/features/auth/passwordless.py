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

from novelo.core.config import get_settings
from novelo.core.errors import FeatureDisabledError, InvalidEventCodeError, InvalidTokenError
from novelo.core.security import hash_token, new_opaque_token
from novelo.features.auth import emails, service
from novelo.features.auth.models import LoginToken
from novelo.features.auth.schemas import GuestOut, GuestPage
from novelo.features.copilot.models import CopilotAction, CopilotMessage, CopilotThread
from novelo.features.users import service as users
from novelo.features.users.models import User

log = logging.getLogger(__name__)

Purpose = Literal["magic_link", "quick_join"]


@dataclass(frozen=True)
class Outgoing:
    """Email já composto, para enviar depois de responder (o tempo de resposta não revela se a conta existe)."""

    to: str
    subject: str
    html: str
    text: str


def safe_next(value: str | None) -> str:
    """Só caminhos relativos do próprio site (anti open-redirect); o resto vira `/`."""
    if not value or len(value) > 255 or not value.startswith("/") or value.startswith(("//", "/\\")):
        return "/"
    if "\\" in value or any(ord(c) < 32 or ord(c) == 127 for c in value):
        return "/"
    return value


def _device(user_agent: str | None) -> str | None:
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


async def _create_token(
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


def _magic_email(user: User, token: str, ip: str | None, user_agent: str | None) -> Outgoing:
    s = get_settings()
    url = f"{s.app_url.rstrip('/')}/magic-link?token={token}"
    subject, html, text = emails.magic_link(user.locale, url, s.magic_link_minutes, ip=ip, device=_device(user_agent))
    return Outgoing(user.email, subject, html, text)


async def request_magic_link(
    db: AsyncSession,
    email: str,
    next_path: str | None,
    *,
    ip: str | None,
    user_agent: str | None,
    purpose: Purpose = "magic_link",
) -> Outgoing | None:
    """Cria o token e compõe o email. Devolve `None` (sem erro) se não há conta ativa: o chamador responde igual."""
    user = await users.get_by_email(db, email)
    if user is None or not user.is_active:
        return None
    token = await _create_token(db, user, purpose, safe_next(next_path), ip, user_agent)
    return _magic_email(user, token, ip, user_agent)


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
    user.email_verified = True  # o link chegou à caixa de correio: provou a posse do email
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
    emails: list[Outgoing]


async def quick_join(
    db: AsyncSession, *, name: str, email: str, locale: str, ip: str | None, user_agent: str | None
) -> QuickJoinOutcome:
    """Email novo: cria um convidado e inicia sessão. Email com conta: NUNCA inicia sessão (anti-tomada de conta),
    só envia um link de entrada para a caixa de correio do dono. O código do evento já foi validado."""
    s = get_settings()
    existing = await users.get_by_email(db, email)
    if existing is None:
        try:
            user = await users.create_user(
                db,
                email=email,
                name=name,
                role="guest",
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
            return QuickJoinOutcome(user, access, refresh, [Outgoing(user.email, subject, html, text)])
    mail = await request_magic_link(db, email, "/", ip=ip, user_agent=user_agent, purpose="quick_join")
    return QuickJoinOutcome(None, None, None, [mail] if mail else [])


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
