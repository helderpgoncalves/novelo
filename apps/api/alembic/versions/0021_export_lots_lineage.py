"""Lotes de escoamento com linhagem (bilhete #57)

Tabelas novas: `export_lots` — o lote vendável fechado por (estado fino, tipologia, estação, género),
com a versão da taxonomia congelada e um índice único parcial que garante UM só lote aberto por
chave; e `export_lot_items` — a peça no escoamento, única por peça triada (um só lote de escoamento
por peça, nunca mais sai), que preserva a linhagem até ao lote de recolha de origem e à sua paragem.
Cor e tamanho nunca entram na chave: vivem na peça e servem de filtros.

Revision ID: 0021
Revises: 0020
Create Date: 2026-11-17 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0021"
down_revision: str | None = "0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "export_lots",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("state", sa.String(length=32), server_default="open", nullable=False),
        sa.Column("fine_state", sa.String(length=32), nullable=False),
        sa.Column("garment_type", sa.String(length=32), nullable=False),
        sa.Column("season", sa.String(length=32), nullable=False),
        sa.Column("gender", sa.String(length=32), nullable=False),
        sa.Column("taxonomy_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["created_by_id"], ["users.id"], name=op.f("fk_export_lots_created_by_id_users"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_export_lots")),
        sa.UniqueConstraint("code", name="uq_export_lots_code"),
        sa.CheckConstraint("state IN ('open', 'closed')", name="state_valid"),
        sa.CheckConstraint(
            "fine_state IN ('grade_a', 'grade_b', 'grade_c', 'grade_d', 'recycle', 'reject')",
            name="fine_state_valid",
        ),
        sa.CheckConstraint(
            "garment_type IN ('tshirt', 'shirt', 'trousers', 'jumper', 'jacket', 'dress', 'skirt', "
            "'bedding', 'towel', 'footwear', 'accessory', 'other')",
            name="garment_type_valid",
        ),
        sa.CheckConstraint("season IN ('all_season', 'warm', 'cold')", name="season_valid"),
        sa.CheckConstraint("gender IN ('men', 'women', 'kids', 'babies')", name="gender_valid"),
    )
    # Um só lote ABERTO por chave; fechado o lote, a chave fica livre para o seguinte.
    op.create_index(
        "uq_export_lots_open_key",
        "export_lots",
        ["fine_state", "garment_type", "season", "gender"],
        unique=True,
        postgresql_where=sa.text("state = 'open'"),
    )
    op.create_index("ix_export_lots_state_created_at", "export_lots", ["state", "created_at"], unique=False)

    op.create_table(
        "export_lot_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("export_lot_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("added_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["export_lot_id"], ["export_lots.id"], name=op.f("fk_export_lot_items_export_lot_id_export_lots"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["item_id"], ["lot_items.id"], name=op.f("fk_export_lot_items_item_id_lot_items"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["added_by_id"], ["users.id"], name=op.f("fk_export_lot_items_added_by_id_users"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_export_lot_items")),
        # A peça entra em UM só lote de escoamento, para sempre: é o que mantém a linhagem honesta.
        sa.UniqueConstraint("item_id", name="uq_export_lot_items_item_id"),
    )
    op.create_index("ix_export_lot_items_export_lot_id", "export_lot_items", ["export_lot_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_export_lot_items_export_lot_id", table_name="export_lot_items")
    op.drop_table("export_lot_items")
    op.drop_index("ix_export_lots_state_created_at", table_name="export_lots")
    op.drop_index("uq_export_lots_open_key", table_name="export_lots")
    op.drop_table("export_lots")
