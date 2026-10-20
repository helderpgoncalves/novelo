import uuid
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from novelo.core.database import Base, UuidPkMixin

DeliveryStatus = Literal["queued", "sent", "delivered", "delayed", "bounced", "complained", "failed", "skipped"]
EmailTemplate = Literal[
    "magic_link",
    "invitation",
    "registration_received",
    "approval_requested",
    "approval_granted",
    "approval_rejected",
    "verify_email",
    "guest_welcome",
    "password_reset",
    "account_unavailable",
    "account_not_found",
    "pending_reminder",
    "email_alert",
    "test_email",
]
SuppressionReason = Literal["bounced", "complained", "manual"]
STATUSES: tuple[str, ...] = (
    "queued", "sent", "delivered", "delayed", "bounced", "complained", "failed", "skipped",
)  # fmt: skip


def _now() -> datetime:
    return datetime.now(UTC)


class EmailDelivery(Base, UuidPkMixin):
    """Um email que tentámos enviar. SÓ metadados: nunca o assunto, o corpo, links nem tokens."""

    __tablename__ = "email_deliveries"
    __table_args__ = (
        CheckConstraint(
            "status IN ('queued', 'sent', 'delivered', 'delayed', 'bounced', 'complained', 'failed', 'skipped')",
            name="status_valid",
        ),
        Index("ix_email_deliveries_created_at", "created_at"),
    )

    to_email: Mapped[str] = mapped_column(String(255), index=True)  # em minúsculas
    template: Mapped[str] = mapped_column(String(40))
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    invitation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invitations.id", ondelete="SET NULL"), index=True
    )
    provider_message_id: Mapped[str | None] = mapped_column(String(100), index=True)
    status: Mapped[str] = mapped_column(String(12), default="queued", server_default="queued", index=True)
    error_code: Mapped[str | None] = mapped_column(String(60))
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Datas geradas no Python (e não só `now()` da transação): a ordem dos envios é sempre total e verdadeira.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, server_default=func.now(), nullable=False
    )


class EmailSuppression(Base, UuidPkMixin):
    """Endereço que não recebe emails: devolvido (ressalto permanente), marcado como spam ou bloqueado por um admin.
    Ressaltos transitórios (caixa cheia, atraso) NÃO entram aqui."""

    __tablename__ = "email_suppressions"
    __table_args__ = (CheckConstraint("reason IN ('bounced', 'complained', 'manual')", name="reason_valid"),)

    to_email: Mapped[str] = mapped_column(String(255), unique=True)  # em minúsculas
    reason: Mapped[str] = mapped_column(String(12))
    source_delivery_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("email_deliveries.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
