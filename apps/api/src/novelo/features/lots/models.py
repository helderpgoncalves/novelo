import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from novelo.core.database import Base, TimestampMixin, UuidPkMixin, enum_check, enum_column
from novelo.domain.vocab import Fibre, GarmentType, LotEventKind, LotState, LotUnitSource, TextileDestination


class Lot(Base, UuidPkMixin, TimestampMixin):
    """Lote de recolha: nasce na paragem da viatura (um por paragem), com QR, peso e histórico públicos.

    Âncora: o local e a freguesia onde a paragem aconteceu. O peso do lote é o medido nas unidades
    (`LotUnit.weight_g`); sem unidades pesadas (lotes antigos) cai na soma estimada das peças.
    """

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
    locality_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("localities.id", ondelete="SET NULL"), index=True
    )
    # Momento «Partir»: a viatura deixou a paragem; a partir daí as unidades do lote congelam.
    departed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dominant_fibre: Mapped[Fibre] = mapped_column(
        enum_column(Fibre), default=Fibre.UNKNOWN, server_default=Fibre.UNKNOWN.value
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    items: Mapped[list["LotItem"]] = relationship(back_populates="lot", cascade="all, delete-orphan")
    units: Mapped[list["LotUnit"]] = relationship(
        back_populates="lot", cascade="all, delete-orphan", order_by="LotUnit.created_at"
    )
    events: Mapped[list["LotEvent"]] = relationship(
        back_populates="lot", cascade="all, delete-orphan", order_by="LotEvent.occurred_at"
    )
    reservation: Mapped["LotReservation | None"] = relationship(back_populates="lot", cascade="all, delete-orphan")


class LotItem(Base, UuidPkMixin, TimestampMixin):
    """Uma peça triada. Guarda marca, composição e estado. A miniatura opcional vive à parte (`LotItemPhoto`)."""

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


class LotUnit(Base, UuidPkMixin, TimestampMixin):
    """Uma unidade física na paragem (um saco): um QR próprio e o peso medido na balança da viatura.

    O QR é o do saco da plataforma (`source="bag"`) ou o UUID de uma etiqueta impressa na viatura quando o
    saco não tem (`source="label"`; o código é o próprio UUID). O peso vem de pratos ≤ 15 kg: um saco pesado
    em vários pratos entra com a soma. O código é único dentro do lote (o mesmo saco não entra duas vezes).
    """

    __tablename__ = "lot_units"
    __table_args__ = (
        enum_check("source", LotUnitSource),
        UniqueConstraint("lot_id", "code", name="uq_lot_units_lot_code"),
        CheckConstraint("weight_g > 0", name="weight_positive"),
    )

    lot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lots.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(80))
    source: Mapped[LotUnitSource] = mapped_column(enum_column(LotUnitSource))
    weight_g: Mapped[int | None] = mapped_column(Integer)

    lot: Mapped[Lot] = relationship(back_populates="units")


class LotItemPhoto(Base, UuidPkMixin):
    """Miniatura opcional de uma peça (RGPD: sem metadados, JPEG pequeno, apagada ao fim de `expires_at`).

    Tabela à parte para que nenhuma listagem carregue os bytes: `content` é diferida e só se lê com uma consulta
    explícita. Substituir a foto cria uma linha nova (novo `id`, logo novo ETag) depois de apagar a anterior.
    """

    __tablename__ = "lot_item_photos"

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lot_items.id", ondelete="CASCADE"), unique=True
    )
    content: Mapped[bytes] = mapped_column(LargeBinary, deferred=True)
    mime: Mapped[str] = mapped_column(String(20), default="image/jpeg", server_default="image/jpeg")
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    size_bytes: Mapped[int] = mapped_column(Integer)
    credit: Mapped[str | None] = mapped_column(String(240))  # atribuição de licença quando a foto é de terceiros
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    consent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


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
