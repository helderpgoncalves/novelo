"""Auditoria de administração. Nunca regista tokens nem passwords (ver `sanitize`).

`record` acrescenta a linha à transação em curso (quem chama faz o commit, para a auditoria e a ação serem atómicas).
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from novelo.core.avatar import safe_avatar_url
from novelo.core.request_meta import RequestMeta
from novelo.features.audit.models import AuditLog
from novelo.features.audit.schemas import AuditEntryOut, AuditPage
from novelo.features.users.models import User

_SECRET_HINTS = ("token", "password", "passwd", "secret", "hash", "cookie", "authorization", "api_key", "apikey")
MAX_VALUE_CHARS = 300


def sanitize(value: Any) -> Any:
    """Remove chaves que pareçam segredos (a qualquer profundidade) e limita o tamanho dos textos."""
    if isinstance(value, dict):
        return {str(k): sanitize(v) for k, v in value.items() if not any(h in str(k).lower() for h in _SECRET_HINTS)}
    if isinstance(value, list | tuple):
        return [sanitize(v) for v in value][:50]
    if isinstance(value, str):
        return value[:MAX_VALUE_CHARS]
    if isinstance(value, uuid.UUID | datetime):
        return str(value)
    return value


def actors_of(user: User) -> tuple[uuid.UUID, uuid.UUID]:
    """(pessoa real, conta efetiva). Dentro de uma impersonação o ator é o administrador, nunca o impersonado."""
    if user.impersonation is not None:
        return user.impersonation.admin_id, user.id
    return user.id, user.id


async def record(
    db: AsyncSession,
    action: str,
    *,
    actor_id: uuid.UUID | None,
    effective_actor_id: uuid.UUID | None = None,
    target_type: str | None = None,
    target_id: object = None,
    target_label: str | None = None,
    meta: RequestMeta | None = None,
    details: dict[str, Any] | None = None,
) -> AuditLog:
    row = AuditLog(
        actor_id=actor_id,
        effective_actor_id=effective_actor_id or actor_id,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        target_label=target_label[:255] if target_label else None,
        ip=meta.ip if meta else None,
        user_agent=meta.user_agent if meta else None,
        details=sanitize(details or {}),
    )
    db.add(row)
    await db.flush()
    return row


async def record_by(
    db: AsyncSession,
    user: User,
    action: str,
    *,
    meta: RequestMeta | None = None,
    target_type: str | None = None,
    target_id: object = None,
    target_label: str | None = None,
    details: dict[str, Any] | None = None,
) -> AuditLog:
    actor, effective = actors_of(user)
    return await record(
        db,
        action,
        actor_id=actor,
        effective_actor_id=effective,
        target_type=target_type,
        target_id=target_id,
        target_label=target_label,
        meta=meta,
        details=details,
    )


async def scrub_user(db: AsyncSession, user_id: uuid.UUID, email: str) -> None:
    """RGPD: depois de eliminar uma conta, a auditoria deixa de identificar a pessoa.

    Mantém-se o facto (quem eliminou, quando, o quê) mas sem email do alvo nem IP/dispositivo do próprio.
    """
    await db.execute(update(AuditLog).where(AuditLog.target_id == str(user_id)).values(target_label=None))
    await db.execute(
        update(AuditLog)
        .where(AuditLog.target_type == "invitation", AuditLog.target_label == email)
        .values(target_label=None)
    )
    await db.execute(update(AuditLog).where(AuditLog.actor_id == user_id).values(ip=None, user_agent=None))


async def list_audit(
    db: AsyncSession,
    *,
    offset: int,
    limit: int,
    action: str | None = None,
    actor_id: uuid.UUID | None = None,
    target_id: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> AuditPage:
    actor, effective = aliased(User), aliased(User)
    where = []
    if action:
        where.append(AuditLog.action.startswith(action) if action.endswith(".") else AuditLog.action == action)
    if actor_id:
        where.append(AuditLog.actor_id == actor_id)
    if target_id:
        where.append(AuditLog.target_id == target_id)
    if date_from:
        where.append(AuditLog.created_at >= date_from)
    if date_to:
        where.append(AuditLog.created_at <= date_to)
    total = await db.scalar(select(func.count()).select_from(AuditLog).where(*where)) or 0
    rows = (
        await db.execute(
            select(AuditLog, actor.email, actor.name, actor.avatar_url, effective.email, effective.name)
            .outerjoin(actor, actor.id == AuditLog.actor_id)
            .outerjoin(effective, effective.id == AuditLog.effective_actor_id)
            .where(*where)
            .order_by(AuditLog.created_at.desc(), AuditLog.id)
            .offset(offset)
            .limit(limit)
        )
    ).all()
    target_ids: set[uuid.UUID] = set()
    for r, *_rest in rows:
        if r.target_type == "user" and r.target_id:
            try:
                target_ids.add(uuid.UUID(r.target_id))
            except ValueError:
                continue
    avatars: dict[str, str | None] = {}
    if target_ids:  # um só SELECT para todos os alvos da página
        found = await db.execute(select(User.id, User.avatar_url).where(User.id.in_(target_ids)))
        avatars = {str(uid): safe_avatar_url(url) for uid, url in found.all()}
    items = [
        AuditEntryOut(
            id=r.id,
            created_at=r.created_at,
            action=r.action,
            actor_id=r.actor_id,
            actor_name=a_name,
            actor_email=a_email,
            actor_avatar_url=safe_avatar_url(a_avatar),
            effective_actor_id=r.effective_actor_id,
            effective_actor_name=e_name,
            effective_actor_email=e_email,
            target_type=r.target_type,
            target_id=r.target_id,
            target_label=r.target_label,
            target_avatar_url=avatars.get(r.target_id) if r.target_type == "user" and r.target_id else None,
            ip=r.ip,
            user_agent=r.user_agent,
            details=r.details,
        )
        for r, a_email, a_name, a_avatar, e_email, e_name in rows
    ]
    return AuditPage(items=items, total=int(total), offset=offset, limit=limit)
