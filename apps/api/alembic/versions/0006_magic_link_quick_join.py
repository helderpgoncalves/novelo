"""magic link, quick join e role guest

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-20 15:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("joined_via", sa.String(length=20), server_default="password", nullable=False))
    op.add_column("users", sa.Column("consent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("consent_version", sa.String(length=20), nullable=True))
    op.execute("UPDATE users SET joined_via = 'google' WHERE google_sub IS NOT NULL AND hashed_password IS NULL")
    op.create_table(
        "login_tokens",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("purpose", sa.String(length=20), nullable=False),
        sa.Column("next_path", sa.String(length=255), server_default="/", nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("purpose IN ('magic_link', 'quick_join')", name=op.f("ck_login_tokens_purpose_valid")),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_login_tokens_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_login_tokens")),
    )
    op.create_index(op.f("ix_login_tokens_token_hash"), "login_tokens", ["token_hash"], unique=True)
    op.create_index(op.f("ix_login_tokens_user_id"), "login_tokens", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_login_tokens_user_id"), table_name="login_tokens")
    op.drop_index(op.f("ix_login_tokens_token_hash"), table_name="login_tokens")
    op.drop_table("login_tokens")
    op.execute("UPDATE users SET role = 'operator' WHERE role = 'guest'")
    op.drop_column("users", "consent_version")
    op.drop_column("users", "consent_at")
    op.drop_column("users", "joined_via")
