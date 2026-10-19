"""configuração de IA (ai_settings) e registo de uso (ai_usage)

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-19 23:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_settings",
        sa.Column("singleton", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("default_text_model", sa.String(length=120), nullable=True),
        sa.Column("default_vision_model", sa.String(length=120), nullable=True),
        sa.Column("default_fallback_model", sa.String(length=120), nullable=True),
        sa.Column("default_max_output_tokens", sa.Integer(), nullable=True),
        sa.Column("default_reasoning_effort", sa.String(length=10), nullable=True),
        sa.Column("monthly_budget_usd", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("tasks", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("updated_by_id", sa.UUID(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("singleton", name=op.f("ck_ai_settings_singleton_only")),
        sa.ForeignKeyConstraint(
            ["updated_by_id"], ["users.id"], name=op.f("fk_ai_settings_updated_by_id_users"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ai_settings")),
        sa.UniqueConstraint("singleton", name=op.f("uq_ai_settings_singleton")),
    )
    op.create_table(
        "ai_usage",
        sa.Column("task", sa.String(length=32), nullable=False),
        sa.Column("model", sa.String(length=120), nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), nullable=True),
        sa.Column("completion_tokens", sa.Integer(), nullable=True),
        sa.Column("cost_usd", sa.Numeric(precision=12, scale=6), nullable=True),
        sa.Column("cost_source", sa.String(length=10), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("error_code", sa.String(length=40), nullable=True),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.Column("input_hash", sa.String(length=64), nullable=True),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_ai_usage_user_id_users"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ai_usage")),
    )
    op.create_index("ix_ai_usage_created_at_task", "ai_usage", ["created_at", "task"])
    op.create_index(op.f("ix_ai_usage_request_id"), "ai_usage", ["request_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_ai_usage_request_id"), table_name="ai_usage")
    op.drop_index("ix_ai_usage_created_at_task", table_name="ai_usage")
    op.drop_table("ai_usage")
    op.drop_table("ai_settings")
