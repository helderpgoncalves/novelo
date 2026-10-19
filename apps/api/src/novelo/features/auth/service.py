"""Autenticação: sessões (access + refresh com rotação), recuperação de password e Google.

Sem imports de FastAPI. Levanta AppError; o router traduz para HTTP.
"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.email import EmailSender
from novelo.core.config import get_settings
from novelo.core.deps import UnauthorizedError
from novelo.core.errors import AppError, ConflictError
from novelo.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    needs_rehash,
    new_opaque_token,
    verify_password,
)
from novelo.features.auth import emails
from novelo.features.auth.models import PasswordResetToken, RefreshToken
from novelo.features.users import service as users
from novelo.features.users.models import User

log = logging.getLogger(__name__)

# Hash fictício para que o tempo de resposta não revele se o email existe.
_DUMMY_HASH = hash_password("novelo-dummy-password")


class RegistrationClosedError(AppError):
    status_code = 403
    code = "registration_closed"


async def _issue_session(db: AsyncSession, user: User) -> tuple[str, str]:
    settings = get_settings()
    refresh = create_refresh_token(user.id)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh),
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
        )
    )
    user.last_login_at = datetime.now(UTC)
    await db.commit()
    return create_access_token(user.id, user.role), refresh


async def revoke_all_sessions(db: AsyncSession, user_id: object) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False))
        .values(revoked=True)
    )


async def login(db: AsyncSession, email: str, password: str) -> tuple[User, str, str]:
    user = await users.get_by_email(db, email)
    stored = user.hashed_password if user and user.hashed_password else _DUMMY_HASH
    valid = verify_password(password, stored)
    if not (user and user.hashed_password and valid):
        raise UnauthorizedError("Email ou password incorretos")
    if not user.is_active:
        raise UnauthorizedError("Conta inativa")
    if needs_rehash(user.hashed_password):
        user.hashed_password = hash_password(password)
    access, refresh = await _issue_session(db, user)
    return user, access, refresh


async def register(
    db: AsyncSession, sender: EmailSender, email: str, password: str, name: str | None
) -> tuple[User, str, str]:
    settings = get_settings()
    if not settings.allow_registration:
        raise RegistrationClosedError("O registo está fechado. Pede acesso à equipa.")
    if await users.get_by_email(db, email):
        raise ConflictError("Já existe uma conta com este email")
    user = await users.create_user(db, email=email, password=password, name=name)
    access, refresh = await _issue_session(db, user)
    subject, html, text = emails.welcome(settings.app_url, name)
    await _send_quietly(sender, user.email, subject, html, text)
    return user, access, refresh


async def rotate_refresh(db: AsyncSession, token: str) -> tuple[str, str]:
    try:
        payload = decode_token(token, "refresh")
    except ValueError as exc:
        raise UnauthorizedError("Sessão expirada") from exc
    row = (
        await db.execute(select(RefreshToken).where(RefreshToken.token_hash == hash_token(token)))
    ).scalar_one_or_none()
    if row is None:
        raise UnauthorizedError("Sessão expirada")
    if row.revoked:
        # Reutilização de um token já rodado: possível roubo, termina todas as sessões.
        log.warning("refresh token reutilizado: sessões revogadas user=%s", row.user_id)
        await revoke_all_sessions(db, row.user_id)
        await db.commit()
        raise UnauthorizedError("Sessão expirada")
    user = await db.get(User, row.user_id)
    if row.expires_at < datetime.now(UTC) or user is None or not user.is_active or str(user.id) != payload["sub"]:
        raise UnauthorizedError("Sessão expirada")
    row.revoked = True
    return await _issue_session(db, user)


async def logout(db: AsyncSession, refresh_token: str | None) -> None:
    if not refresh_token:
        return
    await db.execute(
        update(RefreshToken).where(RefreshToken.token_hash == hash_token(refresh_token)).values(revoked=True)
    )
    await db.commit()


async def request_password_reset(db: AsyncSession, sender: EmailSender, email: str) -> None:
    """Responde sempre da mesma forma, exista ou não a conta (sem enumeração de emails)."""
    settings = get_settings()
    user = await users.get_by_email(db, email)
    if user is None or not user.is_active:
        return
    token = new_opaque_token()
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=datetime.now(UTC) + timedelta(minutes=settings.password_reset_minutes),
        )
    )
    await db.commit()
    url = f"{settings.app_url.rstrip('/')}/redefinir-password?token={token}"
    subject, html, text = emails.password_reset(url, settings.password_reset_minutes)
    await _send_quietly(sender, user.email, subject, html, text)


async def reset_password(db: AsyncSession, token: str, new_password: str) -> None:
    row = (
        await db.execute(select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(token)))
    ).scalar_one_or_none()
    now = datetime.now(UTC)
    if row is None or row.used_at is not None or row.expires_at < now:
        raise AppError("O link de recuperação é inválido ou expirou. Pede um novo.")
    user = await db.get(User, row.user_id)
    if user is None or not user.is_active:
        raise AppError("O link de recuperação é inválido ou expirou. Pede um novo.")
    user.hashed_password = hash_password(new_password)
    row.used_at = now
    await revoke_all_sessions(db, user.id)
    await db.commit()


async def change_password(db: AsyncSession, user: User, current: str | None, new: str) -> None:
    if user.hashed_password and not (current and verify_password(current, user.hashed_password)):
        raise UnauthorizedError("A password atual está incorreta")
    user.hashed_password = hash_password(new)
    await revoke_all_sessions(db, user.id)
    await db.commit()


async def login_with_google(db: AsyncSession, profile: dict[str, str]) -> tuple[User, str, str]:
    """Liga por `sub`; se não houver, liga a conta existente com o mesmo email; senão cria."""
    user = await users.get_by_google_sub(db, profile["sub"])
    if user is None:
        user = await users.get_by_email(db, profile["email"])
        if user is not None:
            user.google_sub = profile["sub"]
            user.email_verified = True
            user.avatar_url = user.avatar_url or profile.get("picture")
        elif get_settings().allow_registration:
            user = await users.create_user(
                db,
                email=profile["email"],
                name=profile.get("name"),
                google_sub=profile["sub"],
                avatar_url=profile.get("picture"),
                email_verified=True,
            )
        else:
            raise RegistrationClosedError("O registo está fechado. Pede acesso à equipa.")
    if not user.is_active:
        raise UnauthorizedError("Conta inativa")
    access, refresh = await _issue_session(db, user)
    return user, access, refresh


async def seed_admin(db: AsyncSession) -> None:
    """Cria o administrador inicial a partir de ADMIN_EMAIL/ADMIN_PASSWORD (idempotente)."""
    settings = get_settings()
    if not (settings.admin_email and settings.admin_password):
        return
    if await users.get_by_email(db, settings.admin_email) is None:
        await users.create_user(
            db,
            email=settings.admin_email,
            password=settings.admin_password,
            name="Administrador",
            role="admin",
            email_verified=True,
        )


async def _send_quietly(sender: EmailSender, to: str, subject: str, html: str, text: str) -> None:
    """Um email falhado não pode partir o registo nem revelar nada ao utilizador."""
    try:
        await sender.send(to=to, subject=subject, html=html, text=text)
    except AppError:
        log.exception("falha ao enviar email para %s", to)
