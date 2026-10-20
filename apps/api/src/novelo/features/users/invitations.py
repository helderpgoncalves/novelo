"""Convites por email. Sem imports de FastAPI.

O token (`secrets.token_urlsafe(32)`) só existe no email; na base de dados fica o SHA-256. Aceitar consome o convite
com um `UPDATE ... WHERE accepted_at IS NULL ... RETURNING` (uso único, atómico). Respostas a quem aceita são
neutras (`invalid_token`) para convite inexistente, expirado, revogado, já usado ou de quem entretanto perdeu o papel.
"""

import hmac
import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import cast

from sqlalchemy import ColumnElement, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from novelo.adapters.email import EmailSender
from novelo.core.avatar import safe_avatar_url
from novelo.core.config import get_settings
from novelo.core.errors import (
    AdminConfirmationRequiredError,
    AppError,
    ConflictError,
    EmailTakenError,
    FeatureDisabledError,
    InvalidTokenError,
    InvitationPendingError,
    NotFoundError,
)
from novelo.core.request_meta import RequestMeta
from novelo.core.security import hash_password_async, hash_token, new_opaque_token
from novelo.features.audit import service as audit
from novelo.features.auth import emails
from novelo.features.auth import service as auth_service
from novelo.features.email_log import service as email_log
from novelo.features.email_log.models import EmailDelivery
from novelo.features.email_log.schemas import DeliveryStatusOrNone
from novelo.features.users import service as users
from novelo.features.users.models import Invitation, Role, User
from novelo.features.users.schemas import (
    InvitationCreate,
    InvitationLinkOut,
    InvitationOut,
    InvitationPage,
    InvitationPreview,
    InvitationStatus,
    Locale,
)

log = logging.getLogger(__name__)


def status_of(inv: Invitation, now: datetime | None = None) -> InvitationStatus:
    now = now or datetime.now(UTC)
    if inv.accepted_at is not None:
        return "accepted"
    if inv.revoked_at is not None:
        return "revoked"
    return "expired" if inv.expires_at <= now else "pending"


def to_out(inv: Invitation, inviter: User | None, delivery: EmailDelivery | None = None) -> InvitationOut:
    return InvitationOut(
        id=inv.id,
        email=inv.email,
        name=inv.name,
        role=cast(Role, inv.role),
        locale=cast(Locale, inv.locale),
        message=inv.message,
        status=status_of(inv),
        invited_by_id=inv.invited_by_id,
        invited_by_name=(inviter.name or inviter.email) if inviter else None,
        invited_by_email=inviter.email if inviter else None,
        invited_by_avatar_url=safe_avatar_url(inviter.avatar_url) if inviter else None,
        created_at=inv.created_at,
        expires_at=inv.expires_at,
        accepted_at=inv.accepted_at,
        revoked_at=inv.revoked_at,
        last_sent_at=inv.last_sent_at,
        send_count=inv.send_count,
        email_delivered=inv.last_sent_at is not None,
        delivery_status=cast(DeliveryStatusOrNone, delivery.status) if delivery else "none",
        last_email_at=delivery.created_at if delivery else None,
        delivery_error=delivery.error_code if delivery and delivery.status in {"failed", "skipped"} else None,
    )


async def _out(db: AsyncSession, inv: Invitation, inviter: User | None) -> InvitationOut:
    latest = (await email_log.latest_by_invitation(db, [inv.id])).get(inv.id)
    return to_out(inv, inviter, latest)


async def _inviter(db: AsyncSession, inv: Invitation) -> User | None:
    return await db.get(User, inv.invited_by_id) if inv.invited_by_id is not None else None


async def _inviter_name(db: AsyncSession, inv: Invitation) -> str | None:
    inviter = await _inviter(db, inv)
    return (inviter.name or inviter.email) if inviter else None


def _accept_url(token: str) -> str:
    return f"{get_settings().app_url.rstrip('/')}/accept-invite?token={token}"


async def _send(
    db: AsyncSession, sender: EmailSender, inv: Invitation, inviter: User, token: str, *, strict: bool = False
) -> EmailDelivery:
    """Envia e regista. Se o fornecedor falhar, o convite fica (sem `last_sent_at`) e o admin vê o estado, reenvia
    ou copia o link. Com `strict` levanta 503/409 (pedidos do próprio convidado)."""
    subject, html, text = emails.invitation(
        inv.locale,
        _accept_url(token),
        inviter=inviter.name or inviter.email,
        role=inv.role,
        days=get_settings().invitation_days,
        invitee_name=inv.name,
        message=inv.message,
    )
    delivery = await email_log.deliver(
        db, sender, "invitation", inv.email, subject, html, text, invitation_id=inv.id, strict=strict
    )
    if delivery.status == "sent":
        inv.last_sent_at = datetime.now(UTC)
        inv.send_count += 1
        await db.commit()
    return delivery


async def create(
    db: AsyncSession, sender: EmailSender, admin: User, body: InvitationCreate, meta: RequestMeta
) -> InvitationOut:
    if not get_settings().magic_link_enabled:
        raise FeatureDisabledError("Email delivery is not configured")
    if body.role == "admin" and not body.confirm_admin:
        raise AdminConfirmationRequiredError("Inviting an administrator needs confirm_admin")
    email = body.email.lower()
    if await users.get_by_email(db, email) is not None:
        raise EmailTakenError("An account with this email already exists")
    now = datetime.now(UTC)
    pending = (
        await db.execute(
            select(Invitation).where(
                Invitation.email == email, Invitation.accepted_at.is_(None), Invitation.revoked_at.is_(None)
            )
        )
    ).scalar_one_or_none()
    if pending is not None:
        if pending.expires_at > now:
            raise InvitationPendingError("There is already a pending invitation for this email")
        pending.revoked_at = now  # expirado: dá lugar ao novo
        await db.flush()
    token = new_opaque_token()
    inv = Invitation(
        email=email,
        name=body.name,
        role=body.role,
        locale=body.locale,
        message=body.message,
        token_hash=hash_token(token),
        invited_by_id=admin.id,
        expires_at=now + timedelta(days=get_settings().invitation_days),
    )
    db.add(inv)
    try:
        await db.flush()
    except IntegrityError as exc:  # corrida: outro pedido criou o convite do mesmo email
        await db.rollback()
        raise InvitationPendingError("There is already a pending invitation for this email") from exc
    await audit.record_by(
        db,
        admin,
        "invitation.create",
        meta=meta,
        target_type="invitation",
        target_id=inv.id,
        target_label=email,
        details={"role": inv.role, "locale": inv.locale, "has_message": inv.message is not None},
    )
    await db.commit()
    delivery = await _send(db, sender, inv, admin, token)
    return to_out(inv, admin, delivery)


async def _get(db: AsyncSession, invitation_id: uuid.UUID) -> Invitation:
    inv = await db.get(Invitation, invitation_id)
    if inv is None:
        raise NotFoundError("Invitation not found")
    return inv


async def resend(
    db: AsyncSession, sender: EmailSender, admin: User, invitation_id: uuid.UUID, meta: RequestMeta
) -> InvitationOut:
    """Novo token (o anterior deixa de funcionar) e novo prazo. Só convites por aceitar (pendentes ou expirados)."""
    if not get_settings().magic_link_enabled:
        raise FeatureDisabledError("Email delivery is not configured")
    inv = await _get(db, invitation_id)
    if status_of(inv) in {"accepted", "revoked"}:
        raise ConflictError("This invitation is no longer open")
    if await users.get_by_email(db, inv.email) is not None:
        raise EmailTakenError("An account with this email already exists")
    token = new_opaque_token()
    inv.token_hash = hash_token(token)
    inv.expires_at = datetime.now(UTC) + timedelta(days=get_settings().invitation_days)
    inv.last_sent_at = None
    await audit.record_by(
        db,
        admin,
        "invitation.resend",
        meta=meta,
        target_type="invitation",
        target_id=inv.id,
        target_label=inv.email,
        details={"role": inv.role},
    )
    await db.commit()
    delivery = await _send(db, sender, inv, admin, token)
    return to_out(inv, await _inviter(db, inv), delivery)


async def new_link(db: AsyncSession, admin: User, invitation_id: uuid.UUID, meta: RequestMeta) -> InvitationLinkOut:
    """Novo token (o anterior deixa de valer) e o URL de convite, devolvido UMA vez, para o admin o enviar por
    outro canal quando o email falha. Não envia nada nem guarda o token."""
    inv = await _get(db, invitation_id)
    if status_of(inv) in {"accepted", "revoked"}:
        raise ConflictError("This invitation is no longer open")
    if await users.get_by_email(db, inv.email) is not None:
        raise EmailTakenError("An account with this email already exists")
    token = new_opaque_token()
    inv.token_hash = hash_token(token)
    inv.expires_at = datetime.now(UTC) + timedelta(days=get_settings().invitation_days)
    await audit.record_by(
        db,
        admin,
        "invitation.link",
        meta=meta,
        target_type="invitation",
        target_id=inv.id,
        target_label=inv.email,
        details={"role": inv.role},
    )
    await db.commit()
    return InvitationLinkOut(
        url=_accept_url(token), expires_at=inv.expires_at, invitation=await _out(db, inv, await _inviter(db, inv))
    )


SELF_RESEND_GAP = timedelta(minutes=5)
SELF_RESEND_PER_DAY = 5


async def self_resend(db: AsyncSession, sender: EmailSender, email: str, meta: RequestMeta | None) -> bool:
    """Quem tem um convite por aceitar mas SEM conta pede entrada: reenvia o convite (token novo).

    `True` = o email tem um convite aberto (reenviado ou travado pelos limites: 1 a cada 5 min, 5 por dia);
    `False` = não há convite aberto e o chamador segue para o email «não encontrámos uma conta». Se o envio falhar,
    o token anterior é reposto (não se perde um link que ainda possa estar na caixa de correio) e levanta 503/409."""
    address = email.lower()
    inv = (
        await db.execute(
            select(Invitation).where(
                Invitation.email == address, Invitation.accepted_at.is_(None), Invitation.revoked_at.is_(None)
            )
        )
    ).scalar_one_or_none()
    if inv is None or inv.invited_by_id is None:
        return False
    inviter = await db.get(User, inv.invited_by_id)
    if inviter is None or not inviter.is_active or inviter.role != "admin":
        return False  # o convite já não pode ser aceite (convidante sem papel): segue o email neutro
    await email_log.advisory_lock(db, f"invite-self:{inv.id}")
    now = datetime.now(UTC)
    if (
        await email_log.count_recent(
            db, ["invitation"], now - SELF_RESEND_GAP, invitation_id=inv.id, include_failed=False
        )
        or await email_log.count_recent(
            db, ["invitation"], now - timedelta(days=1), invitation_id=inv.id, include_failed=False
        )
        >= SELF_RESEND_PER_DAY
    ):
        await db.commit()
        log.info("invitation self-resend limited invitation=%s", inv.id)
        return True
    previous = (inv.token_hash, inv.expires_at, inv.last_sent_at)
    token = new_opaque_token()
    inv.token_hash = hash_token(token)
    inv.expires_at = now + timedelta(days=get_settings().invitation_days)
    inv.last_sent_at = None
    await audit.record(
        db,
        "invitation.self_resend",
        actor_id=None,
        target_type="invitation",
        target_id=inv.id,
        target_label=inv.email,
        meta=meta,
        details={"role": inv.role},
    )
    await db.commit()
    try:
        await _send(db, sender, inv, inviter, token, strict=True)
    except AppError:
        inv.token_hash, inv.expires_at, inv.last_sent_at = previous
        await db.commit()
        raise
    return True


async def revoke(db: AsyncSession, admin: User, invitation_id: uuid.UUID, meta: RequestMeta) -> InvitationOut:
    inv = await _get(db, invitation_id)
    if inv.accepted_at is not None:
        raise ConflictError("This invitation was already accepted")
    if inv.revoked_at is None:
        inv.revoked_at = datetime.now(UTC)
        await audit.record_by(
            db,
            admin,
            "invitation.revoke",
            meta=meta,
            target_type="invitation",
            target_id=inv.id,
            target_label=inv.email,
            details={"role": inv.role},
        )
        await db.commit()
    return await _out(db, inv, await _inviter(db, inv))


async def list_invitations(
    db: AsyncSession, *, status: InvitationStatus | None, q: str | None, offset: int, limit: int
) -> InvitationPage:
    now = datetime.now(UTC)
    where: list[ColumnElement[bool]] = []
    if status == "accepted":
        where.append(Invitation.accepted_at.is_not(None))
    elif status == "revoked":
        where += [Invitation.accepted_at.is_(None), Invitation.revoked_at.is_not(None)]
    elif status == "pending":
        where += [Invitation.accepted_at.is_(None), Invitation.revoked_at.is_(None), Invitation.expires_at > now]
    elif status == "expired":
        where += [Invitation.accepted_at.is_(None), Invitation.revoked_at.is_(None), Invitation.expires_at <= now]
    if q and q.strip():
        where.append(func.lower(Invitation.email).like(f"%{q.strip().lower()}%"))
    inviter = aliased(User)
    total = await db.scalar(select(func.count()).select_from(Invitation).where(*where)) or 0
    rows = (
        await db.execute(
            select(Invitation, inviter)
            .outerjoin(inviter, inviter.id == Invitation.invited_by_id)
            .where(*where)
            .order_by(Invitation.created_at.desc(), Invitation.id)
            .offset(offset)
            .limit(limit)
        )
    ).all()
    latest = await email_log.latest_by_invitation(db, [inv.id for inv, _ in rows])
    return InvitationPage(
        items=[to_out(inv, who, latest.get(inv.id)) for inv, who in rows],
        total=int(total),
        offset=offset,
        limit=limit,
    )


# --- rotas públicas (quem recebe o convite) -----------------------------------------------------------------


async def _open_invitation(db: AsyncSession, token: str) -> Invitation:
    """O convite só vale se estiver por aceitar, não revogado, dentro do prazo e o convidante ainda for admin ativo."""
    digest = hash_token(token)
    inv = (await db.execute(select(Invitation).where(Invitation.token_hash == digest))).scalar_one_or_none()
    neutral = InvalidTokenError("Invalid or expired invitation")
    if inv is None or not hmac.compare_digest(inv.token_hash, digest):
        raise neutral
    if status_of(inv) != "pending" or inv.invited_by_id is None:
        raise neutral
    inviter = await db.get(User, inv.invited_by_id)
    if inviter is None or not inviter.is_active or inviter.role != "admin":
        raise neutral
    return inv


async def preview(db: AsyncSession, token: str) -> InvitationPreview:
    inv = await _open_invitation(db, token)
    return InvitationPreview(
        email=inv.email,
        name=inv.name,
        role=cast(Role, inv.role),
        locale=cast(Locale, inv.locale),
        invited_by_name=await _inviter_name(db, inv),
        message=inv.message,
        expires_at=inv.expires_at,
    )


async def accept(
    db: AsyncSession, token: str, name: str, password: str | None, meta: RequestMeta
) -> tuple[User, str, str]:
    """Consome o convite (uma só vez), cria a conta com email verificado e inicia uma sessão longa."""
    inv = await _open_invitation(db, token)
    if await users.get_by_email(db, inv.email) is not None:
        raise EmailTakenError("An account with this email already exists")
    now = datetime.now(UTC)
    consumed = (
        await db.execute(
            update(Invitation)
            .where(
                Invitation.token_hash == hash_token(token),
                Invitation.accepted_at.is_(None),
                Invitation.revoked_at.is_(None),
                Invitation.expires_at > now,
            )
            .values(accepted_at=now)
            .returning(Invitation.id)
        )
    ).first()
    if consumed is None:  # perdeu a corrida contra outro pedido com o mesmo token
        await db.rollback()
        raise InvalidTokenError("Invalid or expired invitation")
    hashed = await hash_password_async(password) if password else None
    user = User(
        email=inv.email,
        name=name,
        hashed_password=hashed,
        role=inv.role,
        locale=inv.locale,
        email_verified=True,  # o convite chegou à caixa de correio: provou a posse do email
        joined_via="invited",
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise EmailTakenError("An account with this email already exists") from exc
    await db.execute(update(Invitation).where(Invitation.id == inv.id).values(accepted_user_id=user.id))
    await audit.record(
        db,
        "invitation.accept",
        actor_id=user.id,
        target_type="invitation",
        target_id=inv.id,
        target_label=inv.email,
        meta=meta,
        details={"role": inv.role, "with_password": password is not None, "invited_by": inv.invited_by_id},
    )
    access, refresh = await auth_service.issue_session(db, user, remember=True)
    return user, access, refresh
