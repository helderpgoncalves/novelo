"""scenarios.siting: rede por freguesia ou por locais reais

As listas de cenários distinguem os cenários por locais reais sem abrir o JSON `result`. Os cenários que já existem
são todos por freguesia (o valor por omissão).

Revision ID: 0013
Revises: 0012
Create Date: 2026-10-21 22:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("scenarios", sa.Column("siting", sa.String(length=10), server_default="parish", nullable=False))
    op.create_check_constraint(op.f("ck_scenarios_siting"), "scenarios", "siting IN ('parish', 'sites')")


def downgrade() -> None:
    op.drop_constraint(op.f("ck_scenarios_siting"), "scenarios", type_="check")
    op.drop_column("scenarios", "siting")
