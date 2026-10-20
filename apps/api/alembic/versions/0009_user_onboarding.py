"""introdução guiada por conta (vista/saltada e checklist «Primeiros passos»)

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-20 23:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("onboarding_seen_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "onboarding_state",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )
    # Quem já tinha conta não é «novo»: a introdução fica como vista e o checklist dispensado.
    op.execute(
        "UPDATE users SET onboarding_seen_at = now(), onboarding_state = '{\"dismissed\": true}'::jsonb "
        "WHERE role <> 'guest'"
    )


def downgrade() -> None:
    op.drop_column("users", "onboarding_state")
    op.drop_column("users", "onboarding_seen_at")
