import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Literal

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from novelo.core.database import Base, TimestampMixin, UuidPkMixin

Role = Literal["admin", "operator", "guest"]
JoinedVia = Literal["password", "google", "quick_join", "magic_link", "invited"]
ApprovalStatus = Literal["pending", "approved", "rejected"]


@dataclass(frozen=True)
class ImpersonationInfo:
    """Sessão de impersonação em curso (só existe em memória, no pedido: vem do token e da tabela de sessões)."""

    session_id: uuid.UUID
    admin_id: uuid.UUID
    admin_name: str | None
    expires_at: datetime


def _now() -> datetime:
    return datetime.now(UTC)


class User(Base, UuidPkMixin, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("approval_status IN ('pending', 'approved', 'rejected')", name="approval_status_valid"),
    )
    __allow_unmapped__ = True

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(255))
    # Nulo em contas criadas só com Google.
    hashed_password: Mapped[str | None] = mapped_column(String(255))
    google_sub: Mapped[str | None] = mapped_column(String(64), unique=True)
    avatar_url: Mapped[str | None] = mapped_column(String(1024))
    role: Mapped[str] = mapped_column(String(20), default="operator")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    locale: Mapped[str] = mapped_column(String(8), default="pt-PT", server_default="pt-PT")
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Como a conta nasceu; e, para o convidado do evento, o consentimento RGPD (quando e que texto aceitou).
    joined_via: Mapped[str] = mapped_column(String(20), default="password", server_default="password")
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consent_version: Mapped[str | None] = mapped_column(String(20))
    # Aprovação por um administrador: registo por password/Google nasce `pending`; convite, QR, admin e contas
    # anteriores são `approved`. Uma conta que não está `approved` autentica-se mas não acede a nada.
    approval_status: Mapped[str] = mapped_column(String(10), default="approved", server_default="approved")
    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejected_reason: Mapped[str | None] = mapped_column(String(300))
    # Introdução guiada: quando foi vista (ou saltada) e o checklist «Primeiros passos» (`done`, `dismissed`).
    onboarding_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    onboarding_state: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default=text("'{}'::jsonb"))
    # Não persistido: preenchido em cada pedido por `core/deps.get_current_user`. `None` = sessão normal.
    impersonation: ImpersonationInfo | None = None


class Invitation(Base, UuidPkMixin):
    """Convite por email. Só o SHA-256 do token fica aqui; uso único (`accepted_at` atómico).

    Estado: aceite (`accepted_at`), revogado (`revoked_at`), expirado (`expires_at` no passado) ou pendente.
    Um email só tem um convite pendente de cada vez (índice parcial único).
    """

    __tablename__ = "invitations"
    __table_args__ = (
        CheckConstraint("role IN ('admin', 'operator', 'guest')", name="role_valid"),
        Index(
            "uq_invitations_pending_email",
            "email",
            unique=True,
            postgresql_where=text("accepted_at IS NULL AND revoked_at IS NULL"),
        ),
    )

    email: Mapped[str] = mapped_column(String(255), index=True)  # normalizado (minúsculas)
    name: Mapped[str | None] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(20))
    locale: Mapped[str] = mapped_column(String(8), default="pt-PT", server_default="pt-PT")
    message: Mapped[str | None] = mapped_column(String(500))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    invited_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    accepted_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # nulo = o email nunca saiu
    send_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, server_default=text("now()"), nullable=False
    )


class ImpersonationSession(Base, UuidPkMixin):
    """Sessão de impersonação: o token só vale enquanto a linha estiver ativa (parar termina-a logo)."""

    __tablename__ = "impersonation_sessions"

    admin_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    target_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, server_default=text("now()"), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


__all__ = ["ApprovalStatus", "ImpersonationInfo", "ImpersonationSession", "Invitation", "Role", "User", "uuid"]
