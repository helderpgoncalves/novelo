import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.email import EmailSender, get_email_sender
from novelo.core.config import get_settings
from novelo.core.database import get_db
from novelo.core.deps import require_role
from novelo.core.ratelimit import (
    admin_approval_limiter,
    admin_delete_limiter,
    admin_impersonate_limiter,
    admin_invite_limiter,
    invite_email_limiter,
    invite_link_limiter,
    invite_resend_limiter,
)
from novelo.core.request_meta import Meta
from novelo.core.security import hash_token
from novelo.features.audit import service as audit_service
from novelo.features.audit.schemas import AuditPage
from novelo.features.auth import cookies
from novelo.features.users import accounts, approvals, impersonation, invitations, service
from novelo.features.users.models import ApprovalStatus, User
from novelo.features.users.schemas import (
    ApproveRequest,
    DeleteUserRequest,
    ImpersonateRequest,
    ImpersonationOut,
    ImpersonationStarted,
    InvitationCreate,
    InvitationLinkOut,
    InvitationOut,
    InvitationPage,
    InvitationStatus,
    RejectRequest,
    UserAdminOut,
    UserAdminUpdate,
    UsersSummary,
)

router = APIRouter()

Db = Annotated[AsyncSession, Depends(get_db)]
Sender = Annotated[EmailSender, Depends(get_email_sender)]
Admin = Annotated[User, Depends(require_role("admin"))]


def _decided(decision: approvals.Decision) -> UserAdminOut:
    return service.to_admin_out(decision.user, email_warning=service.warning_of(decision.delivery))


@router.get("", response_model=list[UserAdminOut])
async def list_users(
    _: Admin, db: Db, approval_status: Annotated[ApprovalStatus | None, Query()] = None
) -> list[UserAdminOut]:
    """Platform accounts (admins only). `approval_status=pending` is the «Pendentes» tab."""
    return await service.admin_outs(db, await service.list_users(db, approval_status))


@router.get("/summary", response_model=UsersSummary)
async def get_users_summary(_: Admin, db: Db, sender: Sender) -> UsersSummary:
    """Counters for the menu badge. Also (at most once a day) emails the admins a reminder if accounts have been
    waiting for approval for over 24 h."""
    await approvals.remind_if_overdue(db, sender)
    return UsersSummary(pending_approvals=await service.count_pending(db), total=len(await service.list_users(db)))


@router.post("/{user_id}/approve", response_model=UserAdminOut)
async def approve_user(
    user_id: uuid.UUID, body: ApproveRequest, admin: Admin, db: Db, sender: Sender, meta: Meta
) -> UserAdminOut:
    """Approve a pending (or rejected) account and set its role. `role=admin` needs `confirm_admin`. Emails the user
    unless `notify=false`. Audited."""
    admin_approval_limiter.check(f"admin-approval:{admin.id}")
    return _decided(await approvals.approve(db, sender, admin, user_id, body, meta))


@router.post("/{user_id}/reject", response_model=UserAdminOut)
async def reject_user(
    user_id: uuid.UUID, body: RejectRequest, admin: Admin, db: Db, sender: Sender, meta: Meta
) -> UserAdminOut:
    """Reject a pending account (optional reason shown to the person; optional neutral email). Audited."""
    admin_approval_limiter.check(f"admin-approval:{admin.id}")
    return _decided(await approvals.reject(db, sender, admin, user_id, body, meta))


@router.post("/{user_id}/resend-email", response_model=UserAdminOut)
async def resend_user_email(user_id: uuid.UUID, admin: Admin, db: Db, sender: Sender, meta: Meta) -> UserAdminOut:
    """Re-send the email that matches the account state («request received», approved or rejected). If it could
    not be sent, `email_warning` says so. Audited."""
    admin_approval_limiter.check(f"admin-approval:{admin.id}")
    return _decided(await approvals.resend_email(db, sender, admin, user_id, meta))


@router.patch("/{user_id}", response_model=UserAdminOut)
async def update_user(user_id: uuid.UUID, body: UserAdminUpdate, admin: Admin, db: Db, meta: Meta) -> UserAdminOut:
    """Change role or activate/deactivate an account. Admins cannot change themselves; the last active admin cannot
    be demoted or deactivated; granting `admin` needs `confirm_admin: true`. Audited."""
    return service.to_admin_out(await accounts.update_user(db, admin, user_id, body, meta))


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: uuid.UUID, body: DeleteUserRequest, admin: Admin, db: Db, meta: Meta) -> Response:
    """Permanently delete an account and its personal data (GDPR). The body repeats the target's email.
    Not allowed on yourself, on the last active admin, or on someone being impersonated. Audited."""
    admin_delete_limiter.check(f"admin-delete:{admin.id}")
    await accounts.delete_user(db, admin, user_id, body.confirm_email, meta)
    return Response(status_code=204)


@router.post("/{user_id}/impersonate", response_model=ImpersonationStarted)
async def start_impersonation(
    user_id: uuid.UUID, body: ImpersonateRequest, response: Response, admin: Admin, db: Db, meta: Meta
) -> ImpersonationStarted:
    """See the app as a non-admin user for a fixed, non-renewable period. A reason (10+ characters) is required.
    The access cookie becomes the impersonation session; `POST /auth/impersonation/stop` gives it back."""
    admin_impersonate_limiter.check(f"admin-impersonate:{admin.id}")
    token, info, target = await impersonation.start(db, admin, user_id, body.reason, meta)
    cookies.set_access(response, token, get_settings().impersonation_minutes * 60)
    return ImpersonationStarted(
        user=service.to_out(target),
        impersonation=ImpersonationOut(
            active=True, admin_id=info.admin_id, admin_name=info.admin_name, expires_at=info.expires_at
        ),
    )


@router.get("/audit", response_model=AuditPage)
async def list_audit(
    _: Admin,
    db: Db,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    action: Annotated[
        str | None, Query(max_length=60, description="Ação exata (`user.delete`) ou prefixo com ponto (`invitation.`)")
    ] = None,
    actor_id: uuid.UUID | None = None,
    target_id: Annotated[str | None, Query(max_length=64)] = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> AuditPage:
    """Registo de auditoria da administração (convites, eliminações, impersonação, papéis), do mais recente."""
    return await audit_service.list_audit(
        db,
        offset=offset,
        limit=limit,
        action=action,
        actor_id=actor_id,
        target_id=target_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/invitations", response_model=InvitationPage)
async def list_invitations(
    _: Admin,
    db: Db,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    status: InvitationStatus | None = None,
    q: Annotated[str | None, Query(max_length=100, description="Procura no email")] = None,
) -> InvitationPage:
    """Convites enviados (pendentes, aceites, expirados, revogados), do mais recente."""
    return await invitations.list_invitations(db, status=status, q=q, offset=offset, limit=limit)


@router.post("/invitations", response_model=InvitationOut, status_code=201)
async def create_invitation(body: InvitationCreate, admin: Admin, db: Db, sender: Sender, meta: Meta) -> InvitationOut:
    """Invite someone by email with a role. 409 if the email already has an account or a pending invitation.
    `role=admin` needs `confirm_admin: true`. The link is valid for 7 days and works once."""
    admin_invite_limiter.check(f"admin-invite:{admin.id}", get_settings().invitations_per_hour)
    invite_email_limiter.check(f"invite-email:{hash_token(body.email.lower())}")
    return await invitations.create(db, sender, admin, body, meta)


@router.post("/invitations/{invitation_id}/resend", response_model=InvitationOut)
async def resend_invitation(
    invitation_id: uuid.UUID, admin: Admin, db: Db, sender: Sender, meta: Meta
) -> InvitationOut:
    """New link and new deadline; the previous link stops working."""
    admin_invite_limiter.check(f"admin-invite:{admin.id}", get_settings().invitations_per_hour)
    invite_resend_limiter.check(f"invite-resend:{invitation_id}")
    return await invitations.resend(db, sender, admin, invitation_id, meta)


@router.post("/invitations/{invitation_id}/link", response_model=InvitationLinkOut)
async def create_invitation_link(
    invitation_id: uuid.UUID, response: Response, admin: Admin, db: Db, meta: Meta
) -> InvitationLinkOut:
    """New invitation link, returned ONCE, to send through another channel when the email fails. The previous
    link stops working; nothing is emailed and the token is not stored. Audited."""
    invite_link_limiter.check(f"invite-link:{admin.id}")
    response.headers["Cache-Control"] = "no-store"
    return await invitations.new_link(db, admin, invitation_id, meta)


@router.post("/invitations/{invitation_id}/revoke", response_model=InvitationOut)
async def revoke_invitation(invitation_id: uuid.UUID, admin: Admin, db: Db, meta: Meta) -> InvitationOut:
    """The link stops working. Accepted invitations cannot be revoked."""
    return await invitations.revoke(db, admin, invitation_id, meta)
