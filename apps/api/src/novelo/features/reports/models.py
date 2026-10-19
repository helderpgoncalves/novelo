import uuid
from typing import Any

from sqlalchemy import ForeignKey, Integer, LargeBinary, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from novelo.core.database import Base, TimestampMixin, UuidPkMixin


class Report(Base, UuidPkMixin, TimestampMixin):
    """Relatório RAP gerado. Guarda o PDF e a que cenários se refere, para se poder reproduzir e descarregar de novo."""

    __tablename__ = "reports"

    title: Mapped[str] = mapped_column(String(160))
    locale: Mapped[str] = mapped_column(String(8))
    scenario_ids: Mapped[list[str]] = mapped_column(JSONB)
    summary: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    pdf: Mapped[bytes] = mapped_column(LargeBinary)
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
