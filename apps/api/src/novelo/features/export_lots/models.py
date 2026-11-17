import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from novelo.core.database import Base, TimestampMixin, UuidPkMixin, enum_check, enum_column
from novelo.domain.taxonomy import TAXONOMY_VERSION, FineState, Gender, Season
from novelo.domain.vocab import ExportLotState, GarmentType
from novelo.features.lots.models import LotItem


class ExportLot(Base, UuidPkMixin, TimestampMixin):
    """Lote de escoamento («lote vendável»): fechado por (estado fino, tipologia, estação, género).

    A chave são os quatro eixos de `EXPORT_KEY_AXES` (taxonomia v1): cor e tamanho nunca entram, ficam
    como filtros para o pedido do comprador. Há um só lote ABERTO por chave (índice único parcial);
    fechado o lote, a chave fica livre para o lote seguinte. `taxonomy_version` congela a versão da
    taxonomia em que o lote foi fechado. A linhagem vive nas peças (`ExportLotItem`) até aos lotes de
    recolha de origem e às paragens.
    """

    __tablename__ = "export_lots"
    __table_args__ = (
        enum_check("state", ExportLotState),
        enum_check("fine_state", FineState),
        enum_check("garment_type", GarmentType),
        enum_check("season", Season),
        enum_check("gender", Gender),
        Index(
            "uq_export_lots_open_key",
            "fine_state",
            "garment_type",
            "season",
            "gender",
            unique=True,
            postgresql_where=text("state = 'open'"),
        ),
        Index("ix_export_lots_state_created_at", "state", "created_at"),
    )

    code: Mapped[str] = mapped_column(String(16), unique=True)
    state: Mapped[ExportLotState] = mapped_column(
        enum_column(ExportLotState), default=ExportLotState.OPEN, server_default=ExportLotState.OPEN.value
    )
    fine_state: Mapped[FineState] = mapped_column(enum_column(FineState))
    garment_type: Mapped[GarmentType] = mapped_column(enum_column(GarmentType))
    season: Mapped[Season] = mapped_column(enum_column(Season))
    gender: Mapped[Gender] = mapped_column(enum_column(Gender))
    taxonomy_version: Mapped[int] = mapped_column(
        Integer, default=TAXONOMY_VERSION, server_default=str(TAXONOMY_VERSION)
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    memberships: Mapped[list["ExportLotItem"]] = relationship(
        back_populates="export_lot", cascade="all, delete-orphan", order_by="ExportLotItem.created_at"
    )


class ExportLotItem(Base, UuidPkMixin, TimestampMixin):
    """Uma peça do lote de escoamento: o elo da linhagem até à peça triada no lote de recolha.

    Uma peça entra em UM só lote de escoamento, nunca mais sai (único por `item_id`): fechado o lote,
    a peça seguiu para o mercado. A origem lê-se na própria peça (`LotItem.lot_id` → lote de recolha
    → local e freguesia da paragem).
    """

    __tablename__ = "export_lot_items"
    __table_args__ = (UniqueConstraint("item_id", name="uq_export_lot_items_item_id"),)

    export_lot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("export_lots.id", ondelete="CASCADE"), index=True
    )
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lot_items.id", ondelete="CASCADE"))
    added_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    export_lot: Mapped[ExportLot] = relationship(back_populates="memberships")
    item: Mapped[LotItem] = relationship(lazy="joined")
