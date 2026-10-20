from datetime import datetime
from typing import Literal, cast

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.security import hash_password_async
from novelo.features.email_log import service as email_log
from novelo.features.email_log.models import DeliveryStatus, EmailDelivery, EmailTemplate
from novelo.features.email_log.schemas import ApprovalEmailOut, EmailWarning
from novelo.features.users.models import ApprovalStatus, User
from novelo.features.users.schemas import UserAdminOut, UserOut


def to_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        role=user.role,
        joined_via=user.joined_via,
        has_password=user.hashed_password is not None,
        google_linked=user.google_sub is not None,
        email_verified=user.email_verified,
        locale=user.locale,
        approval_status=cast(ApprovalStatus, user.approval_status),
    )


async def get_by_email(db: AsyncSession, email: str) -> User | None:
    return (await db.execute(select(User).where(User.email == email.lower()))).scalar_one_or_none()


async def get_by_google_sub(db: AsyncSession, sub: str) -> User | None:
    return (await db.execute(select(User).where(User.google_sub == sub))).scalar_one_or_none()


async def create_user(
    db: AsyncSession,
    *,
    email: str,
    password: str | None = None,
    name: str | None = None,
    role: str = "operator",
    google_sub: str | None = None,
    avatar_url: str | None = None,
    email_verified: bool = False,
    locale: str = "pt-PT",
    joined_via: str = "password",
    consent_at: datetime | None = None,
    consent_version: str | None = None,
    approval_status: str = "approved",
) -> User:
    user = User(
        email=email.lower(),
        name=name,
        hashed_password=await hash_password_async(password) if password else None,
        role=role,
        google_sub=google_sub,
        avatar_url=avatar_url,
        email_verified=email_verified,
        locale=locale,
        joined_via=joined_via,
        consent_at=consent_at,
        consent_version=consent_version,
        approval_status=approval_status,
    )
    db.add(user)
    await db.commit()
    return user


def to_admin_out(
    user: User, approval_email: ApprovalEmailOut | None = None, email_warning: EmailWarning | None = None
) -> UserAdminOut:
    return UserAdminOut(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        joined_via=user.joined_via,
        is_active=user.is_active,
        email_verified=user.email_verified,
        google_linked=user.google_sub is not None,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        approval_status=cast(ApprovalStatus, user.approval_status),
        approved_at=user.approved_at,
        rejected_reason=user.rejected_reason,
        approval_email=approval_email,
        email_warning=email_warning,
    )


DECISION_TEMPLATES = ("approval_granted", "approval_rejected")


def approval_email_of(user: User, row: EmailDelivery | None) -> ApprovalEmailOut:
    """O email que interessa ao estado da conta: pedido recebido (pendente) ou decisão (aprovada/recusada)."""
    wanted = ("registration_received",) if user.approval_status == "pending" else DECISION_TEMPLATES
    if row is None or row.template not in wanted:
        return ApprovalEmailOut(status="none", template=None, at=None, error_code=None)
    return ApprovalEmailOut(
        status=cast(DeliveryStatus, row.status),
        template=cast(EmailTemplate, row.template),
        at=row.created_at,
        error_code=row.error_code,
    )


def warning_of(row: EmailDelivery | None) -> EmailWarning | None:
    found = email_log.warning_of(row)
    if row is None or found is None:
        return None
    return EmailWarning(
        code=cast(Literal["email_failed", "email_skipped"], found[0]),
        template=cast(EmailTemplate, row.template),
        error_code=found[1],
    )


async def admin_outs(db: AsyncSession, users: list[User]) -> list[UserAdminOut]:
    latest = await email_log.latest_for_user(db, [u.id for u in users], ("registration_received", *DECISION_TEMPLATES))
    return [to_admin_out(u, approval_email_of(u, latest.get(u.id))) for u in users]


async def list_users(db: AsyncSession, approval_status: str | None = None) -> list[User]:
    query = select(User).order_by(User.created_at)
    if approval_status:
        query = query.where(User.approval_status == approval_status)
    return list((await db.execute(query)).scalars())


async def count_pending(db: AsyncSession) -> int:
    return int(await db.scalar(select(func.count()).select_from(User).where(User.approval_status == "pending")) or 0)
