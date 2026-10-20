"""email_deliveries (registo de envios, só metadados) e email_suppressions (endereços sem emails)

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-21 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "email_deliveries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("to_email", sa.String(length=255), nullable=False),
        sa.Column("template", sa.String(length=40), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("invitation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("provider_message_id", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=12), server_default="queued", nullable=False),
        sa.Column("error_code", sa.String(length=60), nullable=True),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "status IN ('queued', 'sent', 'delivered', 'delayed', 'bounced', 'complained', 'failed', 'skipped')",
            name=op.f("ck_email_deliveries_status_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_email_deliveries_user_id_users"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["invitation_id"],
            ["invitations.id"],
            name=op.f("fk_email_deliveries_invitation_id_invitations"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_email_deliveries")),
    )
    for column in ("to_email", "user_id", "invitation_id", "provider_message_id", "status", "created_at"):
        op.create_index(op.f(f"ix_email_deliveries_{column}"), "email_deliveries", [column])
    op.create_table(
        "email_suppressions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("to_email", sa.String(length=255), nullable=False),
        sa.Column("reason", sa.String(length=12), nullable=False),
        sa.Column("source_delivery_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "reason IN ('bounced', 'complained', 'manual')", name=op.f("ck_email_suppressions_reason_valid")
        ),
        sa.ForeignKeyConstraint(
            ["source_delivery_id"],
            ["email_deliveries.id"],
            name=op.f("fk_email_suppressions_source_delivery_id_email_deliveries"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_email_suppressions")),
        sa.UniqueConstraint("to_email", name=op.f("uq_email_suppressions_to_email")),
    )


def downgrade() -> None:
    op.drop_table("email_suppressions")
    for column in ("created_at", "status", "provider_message_id", "invitation_id", "user_id", "to_email"):
        op.drop_index(op.f(f"ix_email_deliveries_{column}"), table_name="email_deliveries")
    op.drop_table("email_deliveries")
