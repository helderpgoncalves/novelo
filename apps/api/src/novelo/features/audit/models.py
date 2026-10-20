import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from novelo.core.database import Base, UuidPkMixin


def _now() -> datetime:
    return datetime.now(UTC)


class AuditLog(Base, UuidPkMixin):
    """Registo de auditoria de ações de administração (acrescenta-se, nunca se edita).

    `actor_id` é a pessoa real; `effective_actor_id` a conta em nome de quem agiu (difere durante uma impersonação).
    Os dois passam a NULL se a conta for eliminada. `target_id` não tem FK: sobrevive à eliminação do alvo, mas
    o `target_label` (email) é apagado nessa altura. `details` nunca leva tokens nem passwords.
    """

    __tablename__ = "audit_log"

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, server_default=text("now()"), nullable=False, index=True
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    effective_actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    action: Mapped[str] = mapped_column(String(60), index=True)
    target_type: Mapped[str | None] = mapped_column(String(30))
    target_id: Mapped[str | None] = mapped_column(String(64), index=True)
    target_label: Mapped[str | None] = mapped_column(String(255))
    ip: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(String(255))
    details: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default=text("'{}'::jsonb"))
