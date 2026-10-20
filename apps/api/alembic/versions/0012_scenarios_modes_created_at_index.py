"""scenarios.modes (derivada de result.modes) e índice em scenarios.created_at

As listas de cenários e a home deixam de abrir o JSON `result` (centenas de KB por linha): usam as colunas de KPIs
e esta lista curta de modos. A migração preenche `modes` nos cenários existentes a partir do `result` guardado.

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-21 18:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "scenarios",
        sa.Column(
            "modes", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False
        ),
    )
    # Mesma regra do código: modos com pelo menos uma freguesia, pela ordem em que aparecem em `result.modes`.
    op.execute(
        """
        UPDATE scenarios SET modes = COALESCE((
            SELECT jsonb_agg(m ->> 'mode' ORDER BY ord)
            FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(result -> 'modes') = 'array' THEN result -> 'modes' ELSE '[]'::jsonb END
            ) WITH ORDINALITY AS t(m, ord)
            WHERE COALESCE((m ->> 'zones')::int, 0) > 0
        ), '[]'::jsonb)
        """
    )
    op.create_index("ix_scenarios_created_at", "scenarios", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_scenarios_created_at", table_name="scenarios")
    op.drop_column("scenarios", "modes")
