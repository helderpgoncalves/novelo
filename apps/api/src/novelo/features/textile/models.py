import uuid
from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from novelo.core.database import Base, TimestampMixin, UuidPkMixin, enum_check, enum_column
from novelo.domain.vocab import TextileDestination, WasteCategory, WasteScope, WeighingMethod


class TextileEntity(Base, UuidPkMixin, TimestampMixin):
    """Entidade que recolhe têxteis no concelho (operadores licenciados, IPSS, a própria Vitrus)."""

    __tablename__ = "textile_entities"

    name: Mapped[str] = mapped_column(String(120), unique=True)

    flows: Mapped[list["TextileFlow"]] = relationship(back_populates="entity")


class TextileFlow(Base, UuidPkMixin, TimestampMixin):
    """Toneladas de têxtil de uma entidade num ano com um destino. Os totais calculam-se, nunca se guardam."""

    __tablename__ = "textile_flows"
    __table_args__ = (
        enum_check("destination", TextileDestination),
        enum_check("method", WeighingMethod),
        UniqueConstraint("entity_id", "year", "destination", name="uq_textile_flows_entity_year_destination"),
        CheckConstraint("tonnes >= 0", name="tonnes_non_negative"),
        CheckConstraint("year BETWEEN 2000 AND 2100", name="year_range"),
    )

    entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("textile_entities.id", ondelete="CASCADE"), index=True
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("data_sources.id", ondelete="RESTRICT"), index=True
    )
    year: Mapped[int] = mapped_column(SmallInteger)
    destination: Mapped[TextileDestination] = mapped_column(enum_column(TextileDestination))
    tonnes: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    method: Mapped[WeighingMethod] = mapped_column(enum_column(WeighingMethod))
    provenance: Mapped[str | None] = mapped_column(Text)

    entity: Mapped[TextileEntity] = relationship(back_populates="flows")


class WasteShare(Base, UuidPkMixin, TimestampMixin):
    """Quota de cada categoria na composição dos resíduos urbanos (Europa ou Portugal)."""

    __tablename__ = "waste_shares"
    __table_args__ = (
        enum_check("scope", WasteScope),
        enum_check("category", WasteCategory),
        UniqueConstraint("scope", "category", name="uq_waste_shares_scope_category"),
        CheckConstraint("share_pct >= 0 AND share_pct <= 100", name="share_pct_range"),
    )

    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("data_sources.id", ondelete="RESTRICT"), index=True
    )
    scope: Mapped[WasteScope] = mapped_column(enum_column(WasteScope))
    category: Mapped[WasteCategory] = mapped_column(enum_column(WasteCategory))
    share_pct: Mapped[Decimal] = mapped_column(Numeric(6, 3))
