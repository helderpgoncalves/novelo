import uuid
from typing import Any

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from novelo.core.database import Base, TimestampMixin, UuidPkMixin


class Scenario(Base, UuidPkMixin, TimestampMixin):
    """Cenário guardado: parâmetros de entrada, resultado e versão dos parâmetros."""

    __tablename__ = "scenarios"

    label: Mapped[str] = mapped_column(String(80))
    params: Mapped[dict[str, Any]] = mapped_column(JSONB)
    result: Mapped[dict[str, Any]] = mapped_column(JSONB)
    params_version: Mapped[str] = mapped_column(String(40), default="v0")
    parent_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
