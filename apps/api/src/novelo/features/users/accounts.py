"""Gestão de contas por administradores: papel, ativação e eliminação (RGPD). Sem imports de FastAPI.

Eliminar apaga a pessoa de verdade: o `DELETE` em `users` faz cascata (CASCADE) nas sessões, tokens, conversas,
memória, anexos, artefactos e ações do copiloto, e anula (SET NULL) as referências dos registos operacionais que
têm de sobreviver (cenários, relatórios, lotes e eventos, alertas resolvidos, parâmetros, utilização de IA).
A auditoria mantém o facto mas perde o email e o IP/dispositivo da pessoa.
"""

import hmac
import logging
import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.errors import (
    AdminConfirmationRequiredError,
    CannotModifySelfError,
    ConfirmationMismatchError,
    ImpersonationActiveError,
    LastAdminError,
    UserNotFoundError,
)
from novelo.core.request_meta import RequestMeta
from novelo.features.audit import service as audit
from novelo.features.auth import service as auth_service
from novelo.features.users import impersonation
from novelo.features.users.models import ImpersonationSession, Invitation, User
from novelo.features.users.schemas import UserAdminUpdate

log = logging.getLogger(__name__)


async def _require_other_active_admin(db: AsyncSession, exclude: uuid.UUID) -> None:
    """Garante que sobra pelo menos um administrador ativo. Bloqueia essas linhas até ao commit (anti-corrida)."""
    others = (
        await db.execute(
            select(User.id).where(User.role == "admin", User.is_active.is_(True), User.id != exclude).with_for_update()
        )
    ).first()
    if others is None:
        raise LastAdminError("There must be at least one active administrator")


async def change_role(
    db: AsyncSession, actor: User, target: User, role: str, *, confirm_admin: bool, meta: RequestMeta | None
) -> None:
    if target.role == role:
        return
    if role == "admin" and not confirm_admin:
        raise AdminConfirmationRequiredError("Granting the administrator role needs confirm_admin")
    if target.role == "admin" and target.is_active:
        await _require_other_active_admin(db, target.id)
    previous = target.role
    target.role = role
    await impersonation.end_for_target(db, target.id)  # um alvo promovido a admin deixa de poder ser impersonado
    await audit.record_by(
        db,
        actor,
        "user.role_change",
        meta=meta,
        target_type="user",
        target_id=target.id,
        target_label=target.email,
        details={"from": previous, "to": role},
    )


async def set_active(db: AsyncSession, actor: User, target: User, active: bool, meta: RequestMeta | None) -> None:
    if target.is_active == active:
        return
    if not active and target.role == "admin":
        await _require_other_active_admin(db, target.id)
    target.is_active = active
    if not active:
        await auth_service.revoke_all_sessions(db, target.id)
        await impersonation.end_for_target(db, target.id)
    await audit.record_by(
        db,
        actor,
        "user.activate" if active else "user.deactivate",
        meta=meta,
        target_type="user",
        target_id=target.id,
        target_label=target.email,
    )


async def update_user(
    db: AsyncSession, admin: User, user_id: uuid.UUID, body: UserAdminUpdate, meta: RequestMeta
) -> User:
    if user_id == admin.id:
        raise CannotModifySelfError("You cannot change your own role or status")
    target = await db.get(User, user_id)
    if target is None:
        raise UserNotFoundError("User not found")
    if body.role is not None:
        await change_role(db, admin, target, body.role, confirm_admin=body.confirm_admin, meta=meta)
    if body.is_active is not None:
        await set_active(db, admin, target, body.is_active, meta)
    await db.commit()
    return target


async def delete_user(db: AsyncSession, admin: User, user_id: uuid.UUID, confirm_email: str, meta: RequestMeta) -> None:
    if user_id == admin.id:
        raise CannotModifySelfError("You cannot delete your own account")
    target = await db.get(User, user_id)
    if target is None:
        raise UserNotFoundError("User not found")
    if not hmac.compare_digest(" ".join(confirm_email.split()).lower().encode(), target.email.lower().encode()):
        raise ConfirmationMismatchError("The confirmation email does not match the account")
    if await impersonation.has_active_for_target(db, target.id):
        raise ImpersonationActiveError("The user is being impersonated right now")
    if target.role == "admin" and target.is_active:
        await _require_other_active_admin(db, target.id)
    facts = {
        "role": target.role,
        "joined_via": target.joined_via,
        "was_active": target.is_active,
        "had_password": target.hashed_password is not None,
        "google_linked": target.google_sub is not None,
    }
    email, target_id = target.email, target.id
    # A pessoa deixa de ser identificável na auditoria e nos convites; depois o DELETE faz o resto em cascata.
    await audit.scrub_user(db, target_id, email)
    await db.execute(delete(Invitation).where(Invitation.email == email))
    await db.execute(
        delete(ImpersonationSession).where(
            (ImpersonationSession.target_id == target_id) | (ImpersonationSession.admin_id == target_id)
        )
    )
    await audit.record_by(db, admin, "user.delete", meta=meta, target_type="user", target_id=target_id, details=facts)
    await db.delete(target)
    await db.commit()
    log.info("user deleted id=%s by=%s", target_id, admin.id)
