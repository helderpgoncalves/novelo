"""ordem das localidades em cada circuito

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-20 18:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("circuit_localities", sa.Column("position", sa.SmallInteger(), server_default="0", nullable=False))


def downgrade() -> None:
    op.drop_column("circuit_localities", "position")
