"""Autenticação: sessões (access + refresh com rotação), recuperação de password e Google.

Sem imports de FastAPI. Levanta AppError; o router traduz para HTTP.
"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.email import EmailSender
from novelo.core.config import get_settings
from novelo.core.errors import (
    AccountInactiveError,
    CurrentPasswordIncorrectError,
    EmailTakenError,
    EmailUnavailableError,
    InvalidCredentialsError,
    InvalidTokenError,
    RegistrationClosedError,
    SessionExpiredError,
)
from novelo.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_password_async,
    hash_token,
    needs_rehash,
    new_opaque_token,
    verify_password_async,
)
from novelo.features.auth import emails
from novelo.features.auth.models import EmailVerificationToken, PasswordResetToken, RefreshToken
from novelo.features.auth.schemas import password_problem
from novelo.features.email_log import service as email_log
from novelo.features.email_log.models import EmailDelivery
from novelo.features.users import open_registration
from novelo.features.users import service as users
from novelo.features.users.models import User

log = logging.getLogger(__name__)

# Hash fictício para que o tempo de resposta não revele se o email existe.
_DUMMY_HASH = hash_password("novelo-dummy-password")


async def issue_session(db: AsyncSession, user: User, remember: bool = True) -> tuple[str, str]:
    settings = get_settings()
    refresh = create_refresh_token(user.id, remember)
    lifetime = (
        timedelta(days=settings.refresh_token_days) if remember else timedelta(hours=settings.session_token_hours)
    )
    db.add(RefreshToken(user_id=user.id, token_hash=hash_token(refresh), expires_at=datetime.now(UTC) + lifetime))
    user.last_login_at = datetime.now(UTC)
    await db.commit()
    return create_access_token(user.id, user.role), refresh


async def revoke_all_sessions(db: AsyncSession, user_id: object) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False))
        .values(revoked=True)
    )


async def claim_unverified_account(db: AsyncSession, user: User) -> None:
    """Defesa contra pré-sequestro: quem prova a posse do email por outro meio (Google, link por email) numa conta
    cujo email NUNCA foi verificado recebe-a sem a password nem as sessões que alguém lhe pôs antes."""
    if user.email_verified:
        return
    user.hashed_password = None
    await revoke_all_sessions(db, user.id)


async def login(db: AsyncSession, email: str, password: str, remember: bool = True) -> tuple[User, str, str]:
    user = await users.get_by_email(db, email)
    stored = user.hashed_password if user and user.hashed_password else _DUMMY_HASH
    valid = await verify_password_async(password, stored)
    if not (user and user.hashed_password and valid):
        raise InvalidCredentialsError("Wrong email or password")
    if not user.is_active:
        raise AccountInactiveError("Account is inactive")
    if needs_rehash(user.hashed_password):
        user.hashed_password = await hash_password_async(password)
    await open_registration.auto_approve_if_open(db, user, "password")
    access, refresh = await issue_session(db, user, remember)
    return user, access, refresh


async def register(
    db: AsyncSession,
    sender: EmailSender,
    email: str,
    password: str,
    name: str | None,
    remember: bool = True,
    locale: str = "pt-PT",
) -> tuple[User, str, str]:
    settings = get_settings()
    if not settings.allow_registration:
        raise RegistrationClosedError("Registration is closed")
    if await users.get_by_email(db, email):
        raise EmailTakenError("An account with this email already exists")
    if not settings.magic_link_enabled:
        # Sem como avisar a pessoa (nem os administradores) o registo ficaria à espera para sempre: recusa já.
        raise EmailUnavailableError("Email delivery is not configured")
    user = await users.create_user(
        db, email=email, password=password, name=name, locale=locale, approval_status="pending"
    )
    approved = await open_registration.auto_approve_if_open(db, user, "password")
    access, refresh = await issue_session(db, user, remember)
    if not approved:
        await announce_registration(db, sender, user)
    await send_verification(db, sender, user)
    return user, access, refresh


async def announce_registration(db: AsyncSession, sender: EmailSender, user: User, *, strict: bool = False) -> None:
    """Conta nova por aprovar: a pessoa recebe «recebemos o teu pedido» e os administradores o aviso."""
    from novelo.features.users import approvals  # noqa: PLC0415

    await send_registration_received(db, sender, user, strict=strict)
    await approvals.notify_admins(db, sender, user)


async def send_registration_received(
    db: AsyncSession, sender: EmailSender, user: User, *, strict: bool = False
) -> EmailDelivery:
    url = f"{get_settings().app_url.rstrip('/')}/pending-approval"
    subject, html, text = emails.registration_received(user.locale, user.name, url)
    return await email_log.deliver(
        db, sender, "registration_received", user.email, subject, html, text, user.id, strict=strict
    )


async def rotate_refresh(db: AsyncSession, token: str) -> tuple[str, str]:
    try:
        payload = decode_token(token, "refresh")
    except ValueError as exc:
        raise SessionExpiredError("Session expired") from exc
    token_hash = hash_token(token)
    # Consumo atómico: dois pedidos com o mesmo token não conseguem ambos rodar a sessão.
    consumed = (
        await db.execute(
            update(RefreshToken)
            .where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked.is_(False),
                RefreshToken.expires_at > datetime.now(UTC),
            )
            .values(revoked=True)
            .returning(RefreshToken.user_id)
        )
    ).first()
    if consumed is None:
        row = (await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))).scalar_one_or_none()
        if row is not None and row.revoked:
            # Reutilização de um token já rodado: possível roubo, termina todas as sessões.
            log.warning("refresh token reutilizado: sessões revogadas user=%s", row.user_id)
            await revoke_all_sessions(db, row.user_id)
            await db.commit()
        else:
            await db.rollback()
        raise SessionExpiredError("Session expired")
    user = await db.get(User, consumed.user_id)
    if user is None or not user.is_active or str(user.id) != payload["sub"]:
        await db.rollback()
        raise SessionExpiredError("Session expired")
    return await issue_session(db, user, bool(payload.get("remember", True)))


async def logout(db: AsyncSession, refresh_token: str | None) -> None:
    if not refresh_token:
        return
    await db.execute(
        update(RefreshToken).where(RefreshToken.token_hash == hash_token(refresh_token)).values(revoked=True)
    )
    await db.commit()


async def reset_password(db: AsyncSession, token: str, new_password: str) -> None:
    new_hash = await hash_password_async(new_password)  # fora da transação e sempre, mesmo com token inválido
    now = datetime.now(UTC)
    consumed = (
        await db.execute(
            update(PasswordResetToken)
            .where(
                PasswordResetToken.token_hash == hash_token(token),
                PasswordResetToken.used_at.is_(None),
                PasswordResetToken.expires_at > now,
            )
            .values(used_at=now)
            .returning(PasswordResetToken.user_id)
        )
    ).first()
    if consumed is None:
        await db.rollback()
        raise InvalidTokenError("Invalid or expired password reset link")
    user = await db.get(User, consumed.user_id)
    if user is None or not user.is_active:
        await db.commit()  # o token fica gasto na mesma
        raise InvalidTokenError("Invalid or expired password reset link")
    user.hashed_password = new_hash
    await revoke_all_sessions(db, user.id)
    await db.commit()


async def change_password(db: AsyncSession, user: User, current: str | None, new: str) -> None:
    if user.hashed_password and not (current and await verify_password_async(current, user.hashed_password)):
        raise CurrentPasswordIncorrectError("Current password is incorrect")
    user.hashed_password = await hash_password_async(new)
    await revoke_all_sessions(db, user.id)
    await db.commit()


async def login_with_google(
    db: AsyncSession, profile: dict[str, str], locale: str = "pt-PT", sender: EmailSender | None = None
) -> tuple[User, str, str]:
    """Liga por `sub`; se não houver, liga a conta existente com o mesmo email; senão cria."""
    created = False
    user = await users.get_by_google_sub(db, profile["sub"])
    if user is None:
        user = await users.get_by_email(db, profile["email"])
        if user is not None:
            await claim_unverified_account(db, user)
            user.google_sub = profile["sub"]
            user.email_verified = True
            user.avatar_url = user.avatar_url or profile.get("picture")
        elif get_settings().allow_registration:
            user = await users.create_user(
                db,
                joined_via="google",
                email=profile["email"],
                name=profile.get("name"),
                google_sub=profile["sub"],
                avatar_url=profile.get("picture"),
                email_verified=True,
                locale=locale,
                approval_status="pending",
            )
            created = True
        else:
            raise RegistrationClosedError("Registration is closed")
    if not user.is_active:
        raise AccountInactiveError("Account is inactive")
    approved = await open_registration.auto_approve_if_open(db, user, "google")
    access, refresh = await issue_session(db, user)
    if created and not approved and sender is not None:
        await announce_registration(db, sender, user)
    return user, access, refresh


async def seed_admin(db: AsyncSession) -> None:
    """Cria o administrador inicial a partir de ADMIN_EMAIL/ADMIN_PASSWORD (idempotente)."""
    settings = get_settings()
    if not (settings.admin_email and settings.admin_password):
        return
    if await users.get_by_email(db, settings.admin_email) is None:
        weak = password_problem(settings.admin_password)
        if weak:
            log.error("ADMIN_PASSWORD recusada (%s): o administrador inicial NÃO foi criado", weak)
            return
        await users.create_user(
            db,
            email=settings.admin_email,
            password=settings.admin_password,
            name="Administrador",
            role="admin",
            email_verified=True,
        )


async def send_verification(db: AsyncSession, sender: EmailSender, user: User, *, strict: bool = False) -> None:
    """Gera um link de confirmação de email e envia-o. Não faz nada se o email já está confirmado."""
    if user.email_verified:
        return
    settings = get_settings()
    token = new_opaque_token()
    db.add(
        EmailVerificationToken(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=datetime.now(UTC) + timedelta(hours=settings.email_verify_hours),
        )
    )
    await db.commit()
    url = f"{settings.app_url.rstrip('/')}/verify-email?token={token}"
    subject, html, text = emails.verify_email(user.locale, url, user.name, settings.email_verify_hours)
    await email_log.deliver(db, sender, "verify_email", user.email, subject, html, text, user.id, strict=strict)


async def verify_email(db: AsyncSession, token: str) -> None:
    now = datetime.now(UTC)
    consumed = (
        await db.execute(
            update(EmailVerificationToken)
            .where(
                EmailVerificationToken.token_hash == hash_token(token),
                EmailVerificationToken.used_at.is_(None),
                EmailVerificationToken.expires_at > now,
            )
            .values(used_at=now)
            .returning(EmailVerificationToken.user_id)
        )
    ).first()
    if consumed is None:
        await db.rollback()
        raise InvalidTokenError("Invalid or expired email verification link")
    user = await db.get(User, consumed.user_id)
    if user is None:
        await db.commit()
        raise InvalidTokenError("Invalid or expired email verification link")
    user.email_verified = True
    await db.commit()


async def update_profile(db: AsyncSession, user: User, name: str | None, locale: str | None) -> User:
    user.name = name.strip() if name and name.strip() else None
    if locale:
        user.locale = locale
    await db.commit()
    return user
