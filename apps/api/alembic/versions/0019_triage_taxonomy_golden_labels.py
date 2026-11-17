"""Taxonomia da triagem (v1): estado fino e eixos por peça + rótulos dourados

Colunas novas em `lot_items`: `fine_state` (estado fino; `condition` passa a ser derivado),
estação, cor, género e tamanho em bandas, e a proveniência por eixo em JSONB. Tudo nulo:
as peças anteriores à taxonomia (bilhete #56) mantêm só o destino legado. Tabela nova
`golden_labels`: uma linha por eixo corrigido pelo operador face à proposta da IA.

Revision ID: 0019
Revises: 0018
Create Date: 2026-11-17 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "lot_items",
        sa.Column("fine_state", sa.String(length=32), nullable=True),
    )
    op.add_column("lot_items", sa.Column("season", sa.String(length=32), nullable=True))
    op.add_column("lot_items", sa.Column("colour", sa.String(length=32), nullable=True))
    op.add_column("lot_items", sa.Column("gender", sa.String(length=32), nullable=True))
    op.add_column("lot_items", sa.Column("size_band", sa.String(length=32), nullable=True))
    op.add_column("lot_items", sa.Column("provenance", postgresql.JSONB(), nullable=True))
    op.create_check_constraint(
        "fine_state_valid",
        "lot_items",
        "fine_state IN ('grade_a', 'grade_b', 'grade_c', 'grade_d', 'recycle', 'reject')",
    )
    op.create_check_constraint("season_valid", "lot_items", "season IN ('all_season', 'warm', 'cold')")
    op.create_check_constraint(
        "colour_valid",
        "lot_items",
        "colour IN ('black', 'white', 'grey', 'beige', 'brown', 'red', 'orange', 'yellow', "
        "'green', 'blue', 'pink', 'multicolour', 'unknown')",
    )
    op.create_check_constraint("gender_valid", "lot_items", "gender IN ('men', 'women', 'kids', 'babies')")
    op.create_check_constraint(
        "size_band_valid",
        "lot_items",
        "size_band IN ('xs', 's', 'm', 'l', 'xl', 'xxl', 'unknown')",
    )

    op.create_table(
        "golden_labels",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("lot_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("axis", sa.String(length=32), nullable=False),
        sa.Column("ai_value", sa.String(length=40), nullable=True),
        sa.Column("operator_value", sa.String(length=40), nullable=False),
        sa.Column("ai_confidence", sa.Numeric(precision=3, scale=2), nullable=True),
        sa.Column("model", sa.String(length=120), nullable=True),
        sa.Column("prompt_version", sa.String(length=20), nullable=True),
        sa.Column("confirmed_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["item_id"], ["lot_items.id"], name=op.f("fk_golden_labels_item_id_lot_items"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["lot_id"], ["lots.id"], name=op.f("fk_golden_labels_lot_id_lots"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["confirmed_by_id"], ["users.id"], name=op.f("fk_golden_labels_confirmed_by_id_users"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_golden_labels")),
        sa.CheckConstraint(
            "axis IN ('fine_state', 'garment_type', 'season', 'colour', 'gender', 'size_band')",
            name=op.f("ck_golden_labels_axis_valid"),
        ),
        sa.UniqueConstraint("item_id", "axis", name="uq_golden_labels_item_axis"),
    )
    op.create_index("ix_golden_labels_item_id", "golden_labels", ["item_id"], unique=False)
    op.create_index("ix_golden_labels_lot_id", "golden_labels", ["lot_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_golden_labels_lot_id", table_name="golden_labels")
    op.drop_index("ix_golden_labels_item_id", table_name="golden_labels")
    op.drop_table("golden_labels")
    op.drop_constraint(op.f("ck_lot_items_size_band_valid"), "lot_items", type_="check")
    op.drop_constraint(op.f("ck_lot_items_gender_valid"), "lot_items", type_="check")
    op.drop_constraint(op.f("ck_lot_items_colour_valid"), "lot_items", type_="check")
    op.drop_constraint(op.f("ck_lot_items_season_valid"), "lot_items", type_="check")
    op.drop_constraint(op.f("ck_lot_items_fine_state_valid"), "lot_items", type_="check")
    op.drop_column("lot_items", "provenance")
    op.drop_column("lot_items", "size_band")
    op.drop_column("lot_items", "gender")
    op.drop_column("lot_items", "colour")
    op.drop_column("lot_items", "season")
    op.drop_column("lot_items", "fine_state")
