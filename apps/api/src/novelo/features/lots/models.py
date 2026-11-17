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
from novelo.domain.taxonomy import Colour, FineState, Gender, Season, SizeBand, TriageAxis
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
    """Uma peça triada. Guarda marca, composição, estado fino e a proveniência por eixo.

    `condition` é o destino (reuse/recycle/reject) derivado do `fine_state` — mantém passaporte, bolsa
    e relatório RAP a funcionar. Peças anteriores à taxonomia (bilhete #56) têm `fine_state` nulo e
    ficam fora dos lotes de escoamento (#57) até re-triagem.
    """

    __tablename__ = "lot_items"
    __table_args__ = (
        enum_check("garment_type", GarmentType),
        enum_check("condition", TextileDestination),
        enum_check("fine_state", FineState),
        enum_check("season", Season),
        enum_check("colour", Colour),
        enum_check("gender", Gender),
        enum_check("size_band", SizeBand),
        enum_check("dominant_fibre", Fibre),
        CheckConstraint("estimated_weight_g > 0", name="weight_positive"),
        CheckConstraint("confidence >= 0 AND confidence <= 1", name="confidence_range"),
    )

    lot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lots.id", ondelete="CASCADE"), index=True)
    garment_type: Mapped[GarmentType] = mapped_column(enum_column(GarmentType))
    condition: Mapped[TextileDestination] = mapped_column(enum_column(TextileDestination))
    fine_state: Mapped[FineState | None] = mapped_column(enum_column(FineState))
    season: Mapped[Season | None] = mapped_column(enum_column(Season))
    colour: Mapped[Colour | None] = mapped_column(enum_column(Colour))
    gender: Mapped[Gender | None] = mapped_column(enum_column(Gender))
    size_band: Mapped[SizeBand | None] = mapped_column(enum_column(SizeBand))
    provenance: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
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
    golden_labels: Mapped[list["GoldenLabel"]] = relationship(back_populates="item", cascade="all, delete-orphan")


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


class GoldenLabel(Base, UuidPkMixin, TimestampMixin):
    """Rótulo dourado: o operador corrigiu um valor que a IA propôs (padrão-ouro da triagem).

    Uma linha por eixo corrigido, com o valor proposto e o valor humano — é a verdade-terreno que o
    eval por eixo (`just eval-triage`) usa para saber em que atributo a IA falha. `lot_id` é
    desnormalizado para linhagem barata; apagar a peça apaga os rótulos.
    """

    __tablename__ = "golden_labels"
    __table_args__ = (
        enum_check("axis", TriageAxis),
        UniqueConstraint("item_id", "axis", name="uq_golden_labels_item_axis"),
    )

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lot_items.id", ondelete="CASCADE"), index=True
    )
    lot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lots.id", ondelete="CASCADE"), index=True)
    axis: Mapped[TriageAxis] = mapped_column(enum_column(TriageAxis))
    ai_value: Mapped[str | None] = mapped_column(String(40))
    operator_value: Mapped[str] = mapped_column(String(40))
    ai_confidence: Mapped[Decimal | None] = mapped_column(Numeric(3, 2))
    model: Mapped[str | None] = mapped_column(String(120))
    prompt_version: Mapped[str | None] = mapped_column(String(20))
    confirmed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    item: Mapped[LotItem] = relationship(back_populates="golden_labels")
