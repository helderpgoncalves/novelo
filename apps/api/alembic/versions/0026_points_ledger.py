"""O livro-razão dos pontos: linhas imutáveis (ganhos por saco, anulações com motivo; resgate fica ao #65).

A imutabilidade é garantida por índices únicos PARCIAIS — um ganho flat por saco no mundo, um bónus por
saco na vida — e por não haver caminho de UPDATE/DELETE no código. `seq` é a sequência global que
desempata o `created_at` (igual dentro da transação) e dá aos auditores um número único por lançamento.
`user_id` é SET NULL: apagar a conta perde o crédito, o livro-razão sobrevive para os agregados (ADR RGPD).

Revision ID: 0026
Revises: 0025
Create Date: 2026-11-18 00:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0026"
down_revision: str | None = "0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "points_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("seq", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("bag_code", sa.String(length=16), nullable=True),
        sa.Column("lot_code", sa.String(length=16), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_points_entries_user_id_users"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["actor_id"], ["users.id"], name=op.f("fk_points_entries_actor_id_users"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_points_entries")),
        sa.UniqueConstraint("seq", name=op.f("uq_points_entries_seq")),
        sa.CheckConstraint("amount != 0", name="amount_nonzero"),
        sa.CheckConstraint("kind IN ('gain_flat', 'gain_bonus', 'annulment', 'redemption')", name="kind_valid"),
    )
    op.create_index(op.f("ix_points_entries_user_id"), "points_entries", ["user_id"], unique=False)
    op.create_index(op.f("ix_points_entries_expires_at"), "points_entries", ["expires_at"], unique=False)
    op.create_index("ix_points_entries_user_created", "points_entries", ["user_id", "created_at"], unique=False)
    # Idempotência duradoura: o mesmo saco nunca ganha flat nem bónus duas vezes (parcial por tipo).
    op.create_index(
        "uq_points_entries_flat_per_bag",
        "points_entries",
        ["bag_code"],
        unique=True,
        postgresql_where=sa.text("kind = 'gain_flat' AND bag_code IS NOT NULL"),
    )
    op.create_index(
        "uq_points_entries_bonus_per_bag",
        "points_entries",
        ["bag_code"],
        unique=True,
        postgresql_where=sa.text("kind = 'gain_bonus' AND bag_code IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_points_entries_bonus_per_bag", table_name="points_entries")
    op.drop_index("uq_points_entries_flat_per_bag", table_name="points_entries")
    op.drop_index("ix_points_entries_user_created", table_name="points_entries")
    op.drop_index(op.f("ix_points_entries_expires_at"), table_name="points_entries")
    op.drop_index(op.f("ix_points_entries_user_id"), table_name="points_entries")
    op.drop_table("points_entries")
