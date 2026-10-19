import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from novelo.core.database import Base, TimestampMixin, UuidPkMixin


class AiSettings(Base, UuidPkMixin, TimestampMixin):
    """Configuração de IA (uma linha). Campos nulos herdam o `.env`; `tasks` guarda as exceções por tarefa."""

    __tablename__ = "ai_settings"
    __table_args__ = (CheckConstraint("singleton", name="singleton_only"),)

    singleton: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", unique=True)
    default_text_model: Mapped[str | None] = mapped_column(String(120))
    default_vision_model: Mapped[str | None] = mapped_column(String(120))
    default_fallback_model: Mapped[str | None] = mapped_column(String(120))
    default_max_output_tokens: Mapped[int | None] = mapped_column(Integer)
    default_reasoning_effort: Mapped[str | None] = mapped_column(String(10))
    monthly_budget_usd: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))  # nulo = .env; 0 = sem limite
    # {"copilot": {"model": ..., "fallback_model": ..., "max_output_tokens": ..., "reasoning_effort": ...}, ...}
    tasks: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )


class AiUsage(Base, UuidPkMixin, TimestampMixin):
    """Uma chamada ao modelo. Nunca guarda prompts, imagens nem respostas: no máximo um hash da entrada."""

    __tablename__ = "ai_usage"
    __table_args__ = (Index("ix_ai_usage_created_at_task", "created_at", "task"),)

    task: Mapped[str] = mapped_column(String(32))
    model: Mapped[str] = mapped_column(String(120))
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    cost_usd: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    cost_source: Mapped[str] = mapped_column(String(10))  # provider | catalog | unknown
    latency_ms: Mapped[int] = mapped_column(Integer)
    success: Mapped[bool] = mapped_column(Boolean)
    error_code: Mapped[str | None] = mapped_column(String(40))
    request_id: Mapped[str | None] = mapped_column(String(64), index=True)
    input_hash: Mapped[str | None] = mapped_column(String(64))
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
