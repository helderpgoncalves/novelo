"""Morada efémera (spec #54, RGPD por minimização): apagar a morada ao fechar o pedido.

`collection_requests.ephemeral_address` (bool, false por omissão): só pedidos de cidadão (que têm
data por definição); ao chegar ao estado terminal a morada é purgada na hora — sem os 12 meses de
retenção do caminho normal. Os pedidos existentes ficam false: retenção de sempre.
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0030"
down_revision: str | None = "0029"
branch_labels: tuple[str, ...] | None = None
depends_on: tuple[str, ...] | None = None


def upgrade() -> None:
    op.add_column(
        "collection_requests", sa.Column("ephemeral_address", sa.Boolean(), nullable=False, server_default="false")
    )


def downgrade() -> None:
    op.drop_column("collection_requests", "ephemeral_address")
