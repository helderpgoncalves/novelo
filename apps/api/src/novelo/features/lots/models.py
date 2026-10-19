import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from novelo.core.database import Base, TimestampMixin, UuidPkMixin, enum_check, enum_column
from novelo.domain.vocab import Fibre, GarmentType, LotEventKind, LotState, TextileDestination


class Lot(Base, UuidPkMixin, TimestampMixin):
    """Conjunto de peças triadas no mesmo ponto: tem QR, passaporte público e entra na bolsa de fibra."""

    __tablename__ = "lots"
    __table_args__ = (
        enum_check("state", LotState),
        enum_check("dominant_fibre", Fibre),
        Index("ix_lots_state_dominant_fibre", "state", "dominant_fibre"),
    )

    code: Mapped[str] = mapped_column(String(16), unique=True)
    state: Mapped[LotState] = mapped_column(
        enum_column(LotState), default=LotState.COLLECTED, server_default=LotState.COLLECTED.value
    )
    parish_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("parishes.id", ondelete="SET NULL"), index=True
    )
    container_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("containers.id", ondelete="SET NULL")
    )
    dominant_fibre: Mapped[Fibre] = mapped_column(
        enum_column(Fibre), default=Fibre.UNKNOWN, server_default=Fibre.UNKNOWN.value
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    items: Mapped[list["LotItem"]] = relationship(back_populates="lot", cascade="all, delete-orphan")
    events: Mapped[list["LotEvent"]] = relationship(
        back_populates="lot", cascade="all, delete-orphan", order_by="LotEvent.occurred_at"
    )
    reservation: Mapped["LotReservation | None"] = relationship(back_populates="lot", cascade="all, delete-orphan")


class LotItem(Base, UuidPkMixin, TimestampMixin):
    """Uma peça triada. Guarda marca, composição e estado; a fotografia nunca é guardada."""

    __tablename__ = "lot_items"
    __table_args__ = (
        enum_check("garment_type", GarmentType),
        enum_check("condition", TextileDestination),
        enum_check("dominant_fibre", Fibre),
        CheckConstraint("estimated_weight_g > 0", name="weight_positive"),
        CheckConstraint("confidence >= 0 AND confidence <= 1", name="confidence_range"),
    )

    lot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lots.id", ondelete="CASCADE"), index=True)
    garment_type: Mapped[GarmentType] = mapped_column(enum_column(GarmentType))
    condition: Mapped[TextileDestination] = mapped_column(enum_column(TextileDestination))
    composition: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    dominant_fibre: Mapped[Fibre] = mapped_column(enum_column(Fibre))
    brand: Mapped[str | None] = mapped_column(String(80), index=True)
    estimated_weight_g: Mapped[int] = mapped_column(Integer)
    confidence: Mapped[Decimal] = mapped_column(Numeric(3, 2))
    prompt_version: Mapped[str | None] = mapped_column(String(20))
    confirmed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    lot: Mapped[Lot] = relationship(back_populates="items")


class LotEvent(Base, UuidPkMixin):
    """Histórico do lote (passaporte): cada passo com data e autor."""

    __tablename__ = "lot_events"
    __table_args__ = (enum_check("kind", LotEventKind),)

    lot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lots.id", ondelete="CASCADE"), index=True)
    kind: Mapped[LotEventKind] = mapped_column(enum_column(LotEventKind))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    note: Mapped[str | None] = mapped_column(Text)

    lot: Mapped[Lot] = relationship(back_populates="events")


class LotReservation(Base, UuidPkMixin, TimestampMixin):
    """Reciclador que reservou o lote na bolsa de fibra (sem preços nem pagamentos no MVP)."""

    __tablename__ = "lot_reservations"

    lot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lots.id", ondelete="CASCADE"), unique=True
    )
    recycler_name: Mapped[str] = mapped_column(String(120))
    contact: Mapped[str] = mapped_column(String(160))
    note: Mapped[str | None] = mapped_column(Text)

    lot: Mapped[Lot] = relationship(back_populates="reservation")
