"""O lote nasce na paragem: âncora no local, unidades físicas com QR e peso medido

`lots` ganha `locality_id` (local da paragem) e `departed_at` («Partir»). Tabela nova `lot_units`: uma
unidade física (saco) por linha, com QR próprio (saco da plataforma ou etiqueta impressa com UUID) e o peso
medido na balança da viatura — o fim do peso estimado como total do lote. O vocabulário de eventos ganha
`departed` e `unit_removed` (CHECK recriado).

Revision ID: 0019
Revises: 0018
Create Date: 2026-11-17 19:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# O CHECK de `kind` tem de ser recriado à mão: entram `departed` e `unit_removed`.
EVENT_KINDS_OLD = "('opened', 'item_added', 'sorted', 'reserved', 'delivered')"
EVENT_KINDS_NEW = "('opened', 'item_added', 'departed', 'unit_removed', 'sorted', 'reserved', 'delivered')"


def upgrade() -> None:
    op.add_column(
        "lots",
        sa.Column("locality_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_lots_locality_id_localities"), "lots", "localities", ["locality_id"], ["id"], ondelete="SET NULL"
    )
    op.create_index(op.f("ix_lots_locality_id"), "lots", ["locality_id"], unique=False)
    op.add_column("lots", sa.Column("departed_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("ALTER TABLE lot_events DROP CONSTRAINT ck_lot_events_kind_valid")
    op.execute(f"ALTER TABLE lot_events ADD CONSTRAINT ck_lot_events_kind_valid CHECK (kind IN {EVENT_KINDS_NEW})")
    op.create_table(
        "lot_units",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("lot_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("weight_g", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["lot_id"], ["lots.id"], name=op.f("fk_lot_units_lot_id_lots"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_lot_units")),
        sa.UniqueConstraint("lot_id", "code", name=op.f("uq_lot_units_lot_code")),
        sa.CheckConstraint("source IN ('bag', 'label')", name=op.f("ck_lot_units_source_valid")),
        sa.CheckConstraint("weight_g > 0", name=op.f("ck_lot_units_weight_positive")),
    )
    op.create_index(op.f("ix_lot_units_lot_id"), "lot_units", ["lot_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_lot_units_lot_id"), table_name="lot_units")
    op.drop_table("lot_units")
    op.execute("ALTER TABLE lot_events DROP CONSTRAINT ck_lot_events_kind_valid")
    op.execute(f"ALTER TABLE lot_events ADD CONSTRAINT ck_lot_events_kind_valid CHECK (kind IN {EVENT_KINDS_OLD})")
    op.drop_column("lots", "departed_at")
    op.drop_index(op.f("ix_lots_locality_id"), table_name="lots")
    op.drop_constraint(op.f("fk_lots_locality_id_localities"), "lots", type_="foreignkey")
    op.drop_column("lots", "locality_id")
