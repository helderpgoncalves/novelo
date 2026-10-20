"""Impersonação: um administrador vê a app como um utilizador não-administrador, com prazo curto e tudo auditado.

Regras (todas no servidor): só admin→não-admin, sem aninhamento, motivo obrigatório, 30 min fixos sem renovação, uma
sessão ativa por administrador, e o token só vale enquanto a linha em `impersonation_sessions` estiver ativa.
Sem imports de FastAPI.
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.config import get_settings
from novelo.core.errors import (
    CannotModifySelfError,
    ConflictError,
    ImpersonationBlockedError,
    ImpersonationForbiddenError,
    SessionExpiredError,
    UserNotFoundError,
)
from novelo.core.request_meta import RequestMeta
from novelo.core.security import create_impersonation_token, decode_token
from novelo.features.audit import service as audit
from novelo.features.users.models import ImpersonationInfo, ImpersonationSession, User


def _active(now: datetime) -> list[Any]:
    return [ImpersonationSession.ended_at.is_(None), ImpersonationSession.expires_at > now]


async def start(
    db: AsyncSession, admin: User, target_id: uuid.UUID, reason: str, meta: RequestMeta
) -> tuple[str, ImpersonationInfo, User]:
    if admin.impersonation is not None:
        raise ImpersonationBlockedError("Impersonation cannot be nested")
    if target_id == admin.id:
        raise CannotModifySelfError("You cannot impersonate yourself")
    target = await db.get(User, target_id)
    if target is None:
        raise UserNotFoundError("User not found")
    if target.role == "admin":
        raise ImpersonationForbiddenError("Administrators cannot be impersonated")
    if not target.is_active or target.approval_status != "approved":
        raise ConflictError("Cannot impersonate an inactive or unapproved account")
    now = datetime.now(UTC)
    # Uma sessão ativa por administrador: uma nova termina as anteriores.
    await db.execute(
        update(ImpersonationSession)
        .where(ImpersonationSession.admin_id == admin.id, *_active(now))
        .values(ended_at=now)
    )
    expires = now + timedelta(minutes=get_settings().impersonation_minutes)
    session = ImpersonationSession(admin_id=admin.id, target_id=target.id, started_at=now, expires_at=expires)
    db.add(session)
    await db.flush()
    await audit.record(
        db,
        "impersonation.start",
        actor_id=admin.id,
        effective_actor_id=target.id,
        target_type="user",
        target_id=target.id,
        target_label=target.email,
        meta=meta,
        details={"reason": reason, "session_id": session.id, "target_role": target.role, "expires_at": expires},
    )
    await db.commit()
    token = create_impersonation_token(
        target.id, target.role, admin.id, session.id, get_settings().impersonation_minutes
    )
    return token, ImpersonationInfo(session.id, admin.id, admin.name or admin.email, expires), target


async def resolve(db: AsyncSession, payload: dict[str, Any], target: User) -> ImpersonationInfo:
    """Valida a impersonação de um token de acesso. Qualquer falha termina a sessão (401 `session_expired`)."""
    try:
        admin_id = uuid.UUID(str(payload["imp"]))
        session_id = uuid.UUID(str(payload["sid"]))
    except (KeyError, ValueError) as exc:
        raise SessionExpiredError("Invalid impersonation session") from exc
    now = datetime.now(UTC)
    session = (
        await db.execute(
            select(ImpersonationSession).where(
                ImpersonationSession.id == session_id,
                ImpersonationSession.admin_id == admin_id,
                ImpersonationSession.target_id == target.id,
                *_active(now),
            )
        )
    ).scalar_one_or_none()
    admin = await db.get(User, admin_id)
    if session is None or admin is None or not admin.is_active or admin.role != "admin" or target.role == "admin":
        raise SessionExpiredError("Impersonation session ended")
    return ImpersonationInfo(session.id, admin.id, admin.name or admin.email, session.expires_at)


async def stop(db: AsyncSession, user: User, meta: RequestMeta) -> User:
    """Termina a sessão do pedido atual e devolve o administrador real."""
    info = user.impersonation
    if info is None:
        raise ConflictError("No impersonation in progress")
    admin = await db.get(User, info.admin_id)
    if admin is None:
        raise SessionExpiredError("Impersonation session ended")
    now = datetime.now(UTC)
    await db.execute(
        update(ImpersonationSession)
        .where(ImpersonationSession.id == info.session_id, ImpersonationSession.ended_at.is_(None))
        .values(ended_at=now)
    )
    await audit.record(
        db,
        "impersonation.stop",
        actor_id=admin.id,
        effective_actor_id=user.id,
        target_type="user",
        target_id=user.id,
        target_label=user.email,
        meta=meta,
        details={"session_id": info.session_id},
    )
    await db.commit()
    return admin


async def has_active_for_target(db: AsyncSession, target_id: uuid.UUID) -> bool:
    row = await db.scalar(
        select(ImpersonationSession.id)
        .where(ImpersonationSession.target_id == target_id, *_active(datetime.now(UTC)))
        .limit(1)
    )
    return row is not None


async def end_for_target(db: AsyncSession, target_id: uuid.UUID) -> None:
    """Desativar/despromover a conta termina qualquer impersonação em curso sobre ela."""
    await db.execute(
        update(ImpersonationSession)
        .where(ImpersonationSession.target_id == target_id, ImpersonationSession.ended_at.is_(None))
        .values(ended_at=datetime.now(UTC))
    )


async def end_by_token(db: AsyncSession, access_token: str | None) -> None:
    """Terminar sessão com um token de impersonação termina também a sessão no servidor."""
    if not access_token:
        return
    try:
        payload = decode_token(access_token, "access")
        session_id = uuid.UUID(str(payload["sid"]))
    except (ValueError, KeyError):
        return
    await db.execute(
        update(ImpersonationSession)
        .where(ImpersonationSession.id == session_id, ImpersonationSession.ended_at.is_(None))
        .values(ended_at=datetime.now(UTC))
    )
    await db.commit()
