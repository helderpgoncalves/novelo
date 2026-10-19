import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from novelo.core.database import Base, TimestampMixin, UuidPkMixin, enum_check, enum_column
from novelo.domain.vocab import AlertKind, AlertStatus


class DataSource(Base, UuidPkMixin, TimestampMixin):
    """Proveniência: de que ficheiro, de quem e de quando vem cada conjunto de dados."""

    __tablename__ = "data_sources"

    key: Mapped[str] = mapped_column(String(80), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    provider: Mapped[str] = mapped_column(String(120))
    file_name: Mapped[str] = mapped_column(String(255))
    file_sha256: Mapped[str] = mapped_column(String(64))
    received_on: Mapped[date | None] = mapped_column(Date)
    period_start: Mapped[date | None] = mapped_column(Date)
    period_end: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class DataAlert(Base, UuidPkMixin, TimestampMixin):
    """Inconsistência nos dados recebidos, com estado de resolução (fluxo de trabalho com a Vitrus)."""

    __tablename__ = "data_alerts"
    __table_args__ = (
        enum_check("kind", AlertKind),
        enum_check("status", AlertStatus),
        UniqueConstraint("source_id", "number", name="uq_data_alerts_source_number"),
        CheckConstraint("number > 0", name="number_positive"),
    )

    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("data_sources.id", ondelete="CASCADE"), index=True
    )
    number: Mapped[int] = mapped_column(SmallInteger)
    kind: Mapped[AlertKind] = mapped_column(enum_column(AlertKind))
    detail: Mapped[str] = mapped_column(Text)
    suggestion: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[AlertStatus] = mapped_column(
        enum_column(AlertStatus), default=AlertStatus.OPEN, server_default=AlertStatus.OPEN.value
    )
    resolution_note: Mapped[str | None] = mapped_column(Text)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
