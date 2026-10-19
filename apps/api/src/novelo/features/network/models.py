import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from novelo.core.database import Base, TimestampMixin, UuidPkMixin, enum_check, enum_column
from novelo.domain.vocab import (
    CircuitStatus,
    CollectionType,
    ContainerKind,
    ContainerStatus,
    DayGroup,
    Shift,
    Typology,
)


class Parish(Base, UuidPkMixin, TimestampMixin):
    """Freguesia (CAOP/INE). Vazia até importarmos os Censos; é a unidade da procura no simulador."""

    __tablename__ = "parishes"
    __table_args__ = (CheckConstraint("population >= 0", name="population_non_negative"),)

    dicofre: Mapped[str] = mapped_column(String(6), unique=True)  # código INE/DGT de 6 dígitos
    name: Mapped[str] = mapped_column(String(120))
    population: Mapped[int | None] = mapped_column(Integer)
    population_year: Mapped[int | None] = mapped_column(SmallInteger)
    area_km2: Mapped[Decimal | None] = mapped_column(Numeric(9, 3))
    source_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("data_sources.id"))


class Locality(Base, UuidPkMixin, TimestampMixin):
    """Lugar servido por circuitos, tal como escrito no planeamento da Vitrus (pode não ser uma freguesia)."""

    __tablename__ = "localities"

    name: Mapped[str] = mapped_column(String(160), unique=True)
    parish_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("parishes.id", ondelete="SET NULL"), index=True
    )


class Vehicle(Base, UuidPkMixin, TimestampMixin):
    __tablename__ = "vehicles"

    plate: Mapped[str] = mapped_column(String(12), unique=True)
    note: Mapped[str | None] = mapped_column(Text)

    assignments: Mapped[list["ShiftAssignment"]] = relationship(back_populates="vehicle")


class Circuit(Base, UuidPkMixin, TimestampMixin):
    __tablename__ = "circuits"
    __table_args__ = (
        enum_check("typology", Typology),
        enum_check("collection_type", CollectionType),
        enum_check("status", CircuitStatus),
    )

    code: Mapped[str] = mapped_column(String(40), unique=True)
    typology: Mapped[Typology] = mapped_column(enum_column(Typology), index=True)
    collection_type: Mapped[CollectionType] = mapped_column(enum_column(CollectionType))
    status: Mapped[CircuitStatus] = mapped_column(enum_column(CircuitStatus))
    days_text: Mapped[str] = mapped_column(String(200), default="")
    note: Mapped[str | None] = mapped_column(Text)
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("data_sources.id", ondelete="RESTRICT"), index=True
    )

    days: Mapped[list["CircuitDay"]] = relationship(cascade="all, delete-orphan")
    localities: Mapped[list["CircuitLocality"]] = relationship(cascade="all, delete-orphan")
    assignments: Mapped[list["ShiftAssignment"]] = relationship(back_populates="circuit")


class CircuitDay(Base):
    """Dias da semana em que o circuito passa (1 = segunda ... 7 = domingo)."""

    __tablename__ = "circuit_days"
    __table_args__ = (CheckConstraint("weekday BETWEEN 1 AND 7", name="weekday_range"),)

    circuit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("circuits.id", ondelete="CASCADE"), primary_key=True
    )
    weekday: Mapped[int] = mapped_column(SmallInteger, primary_key=True)


class CircuitLocality(Base):
    __tablename__ = "circuit_localities"
    __table_args__ = (Index("ix_circuit_localities_locality_id", "locality_id"),)

    circuit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("circuits.id", ondelete="CASCADE"), primary_key=True
    )
    locality_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("localities.id", ondelete="CASCADE"), primary_key=True
    )

    locality: Mapped[Locality] = relationship()


class ShiftAssignment(Base, UuidPkMixin, TimestampMixin):
    """Uma linha do planeamento: viatura + circuito + turno, com a tripulação."""

    __tablename__ = "shift_assignments"
    __table_args__ = (
        enum_check("day_group", DayGroup),
        enum_check("shift", Shift),
        enum_check("typology", Typology),
        enum_check("collection_type", CollectionType),
        CheckConstraint("crew_size >= 0", name="crew_non_negative"),
        Index("ix_shift_assignments_day_group_shift", "day_group", "shift"),
    )

    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("data_sources.id", ondelete="RESTRICT"), index=True
    )
    day_group: Mapped[DayGroup] = mapped_column(enum_column(DayGroup))
    shift: Mapped[Shift] = mapped_column(enum_column(Shift))
    typology: Mapped[Typology] = mapped_column(enum_column(Typology))
    collection_type: Mapped[CollectionType] = mapped_column(enum_column(CollectionType))
    # Nulo quando o planeamento lista a viatura sem circuito ("SEM CIRCUITO").
    circuit_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("circuits.id", ondelete="SET NULL"), index=True
    )
    circuit_label: Mapped[str] = mapped_column(String(60))
    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="RESTRICT"), index=True
    )
    crew_size: Mapped[int] = mapped_column(SmallInteger, default=0)
    note: Mapped[str | None] = mapped_column(Text)

    circuit: Mapped[Circuit | None] = relationship(back_populates="assignments")
    vehicle: Mapped[Vehicle] = relationship(back_populates="assignments")


class FleetCapacity(Base, UuidPkMixin, TimestampMixin):
    """Viaturas e recursos humanos totais por tipologia (dado fornecido à parte, não derivável dos turnos)."""

    __tablename__ = "fleet_capacity"
    __table_args__ = (
        enum_check("typology", Typology),
        UniqueConstraint("source_id", "typology", name="uq_fleet_capacity_source_typology"),
        CheckConstraint("vehicles >= 0 AND crew >= 0", name="non_negative"),
    )

    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("data_sources.id", ondelete="CASCADE"), index=True
    )
    typology: Mapped[Typology] = mapped_column(enum_column(Typology))
    vehicles: Mapped[int] = mapped_column(SmallInteger)
    crew: Mapped[int] = mapped_column(SmallInteger)


class Container(Base, UuidPkMixin, TimestampMixin):
    """Contentor georreferenciado. Vazia até chegarem as localizações (20 out 2026)."""

    __tablename__ = "containers"
    __table_args__ = (
        enum_check("kind", ContainerKind),
        enum_check("status", ContainerStatus),
        UniqueConstraint("source_id", "external_ref", name="uq_containers_source_external_ref"),
        CheckConstraint("latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180", name="coordinates_range"),
        Index("ix_containers_latitude_longitude", "latitude", "longitude"),
    )

    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("data_sources.id", ondelete="RESTRICT"), index=True
    )
    external_ref: Mapped[str] = mapped_column(String(80))  # identificador no ficheiro de origem
    kind: Mapped[ContainerKind] = mapped_column(enum_column(ContainerKind))
    status: Mapped[ContainerStatus] = mapped_column(
        enum_column(ContainerStatus), default=ContainerStatus.ACTIVE, server_default=ContainerStatus.ACTIVE.value
    )
    operator_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("textile_entities.id", ondelete="SET NULL"), index=True
    )
    locality_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("localities.id", ondelete="SET NULL"), index=True
    )
    parish_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("parishes.id", ondelete="SET NULL"), index=True
    )
    latitude: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    address: Mapped[str | None] = mapped_column(String(255))
    capacity_litres: Mapped[int | None] = mapped_column(Integer)
    installed_on: Mapped[date | None] = mapped_column(Date)
