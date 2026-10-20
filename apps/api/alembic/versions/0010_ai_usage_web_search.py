"""ai_usage: pesquisas web faturadas por chamada (`usage.server_tool_use.web_search_requests`)

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-21 09:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("ai_usage", sa.Column("web_search_requests", sa.Integer(), server_default="0", nullable=False))


def downgrade() -> None:
    op.drop_column("ai_usage", "web_search_requests")
