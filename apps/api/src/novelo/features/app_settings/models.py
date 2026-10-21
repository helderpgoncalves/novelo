import uuid

from sqlalchemy import Boolean, CheckConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from novelo.core.database import Base, TimestampMixin, UuidPkMixin


class AppSettings(Base, UuidPkMixin, TimestampMixin):
    """Definições globais da aplicação (uma só linha, como `ai_settings`). Sem linha = valores por omissão."""

    __tablename__ = "app_settings"
    __table_args__ = (CheckConstraint("singleton", name="singleton_only"),)

    singleton: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", unique=True)
    # Registo aberto: contas novas (password, Google) e contas `pending` que entram ficam logo `approved`.
    open_registration: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
