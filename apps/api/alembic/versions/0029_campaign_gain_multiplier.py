"""Campanhas sazonais tocam os pontos (US40): multiplicador de ganho flat por campanha.

`point_campaigns.gain_multiplier` (float, > 0, 1.0 por omissão): multiplica o ganho FLAT por saco
creditado dentro da janela da campanha; teto mensal, FIFO e expiração continuam como estão. As
campanhas existentes ficam a 1.0 — campanhas informativas, paridade exata com o comportamento de antes.
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0029"
down_revision: str | None = "0028"
branch_labels: tuple[str, ...] | None = None
depends_on: tuple[str, ...] | None = None


def upgrade() -> None:
    op.add_column("point_campaigns", sa.Column("gain_multiplier", sa.Float(), nullable=False, server_default="1.0"))
    op.create_check_constraint("multiplier_positive", "point_campaigns", "gain_multiplier > 0")


def downgrade() -> None:
    op.drop_constraint("multiplier_positive", "point_campaigns", type_="check")
    op.drop_column("point_campaigns", "gain_multiplier")
