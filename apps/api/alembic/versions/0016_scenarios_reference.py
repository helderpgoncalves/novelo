"""Cenários de referência marcados: `reference_key` e `reference_version`

O arranque passa a recalcular os cenários de referência desatualizados (ver `features/planning/reference.py`). Os
antigos, sem marca, são reconhecidos pelo rótulo no arranque e ficam com versão nula (logo recalculados). Os cenários
dos utilizadores ficam com as duas colunas nulas e nunca são apagados.

Revision ID: 0016
Revises: 0015
Create Date: 2026-10-21 18:05:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("scenarios", sa.Column("reference_key", sa.String(length=40), nullable=True))
    op.add_column("scenarios", sa.Column("reference_version", sa.SmallInteger(), nullable=True))
    op.create_index(op.f("ix_scenarios_reference_key"), "scenarios", ["reference_key"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_scenarios_reference_key"), table_name="scenarios")
    op.drop_column("scenarios", "reference_version")
    op.drop_column("scenarios", "reference_key")
