"""Miniatura opcional por peça de lote (`lot_item_photos`)

Tabela à parte de `lot_items` para que nenhuma listagem leia os bytes. A foto apaga-se em cascata com a peça e
automaticamente em `expires_at` (retenção configurável, ver `features/lots/photo_store.py`).

Revision ID: 0018
Revises: 0017
Create Date: 2026-10-23 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "lot_item_photos",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column("mime", sa.String(length=20), server_default="image/jpeg", nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("credit", sa.String(length=240), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consent_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["created_by_id"], ["users.id"], name=op.f("fk_lot_item_photos_created_by_id_users"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["item_id"], ["lot_items.id"], name=op.f("fk_lot_item_photos_item_id_lot_items"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_lot_item_photos")),
        sa.UniqueConstraint("item_id", name=op.f("uq_lot_item_photos_item_id")),
    )
    op.create_index(op.f("ix_lot_item_photos_expires_at"), "lot_item_photos", ["expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_lot_item_photos_expires_at"), table_name="lot_item_photos")
    op.drop_table("lot_item_photos")
