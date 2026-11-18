"""Catálogo e resgate (#65): parceiros, itens, campanhas e códigos de resgate pseudónimos.

Os CHECKs fecham a forma do catálogo: âncora € (apresentação do valor do donativo) só em donativo
IPSS; parceiro obrigatório em prémio de parceiro. O resgate vive aqui só como BILHETE (`RDM-…`,
único no mundo) — o gasto fica no livro-razão `points_entries` (linha negativa `redemption`, CHECK
de 0026 já o aceita). Snapshots do item/parceiro/valor para o pagamento por apresentação sobreviver
a renomeações; `user_id`/`validated_by_id`/`item_id`/`partner_id` são SET NULL (agregados ficam).

Revision ID: 0028
Revises: 0027
Create Date: 2026-11-18 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0028"
down_revision: str | None = "0027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "catalog_partners",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("state", sa.String(length=32), nullable=False, server_default="proposed"),
        sa.Column("parish_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("proposed_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("contact", sa.String(length=200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_catalog_partners")),
        sa.UniqueConstraint("name", name=op.f("uq_catalog_partners_name")),
        sa.ForeignKeyConstraint(
            ["parish_id"], ["parishes.id"], name=op.f("fk_catalog_partners_parish_id_parishes"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["proposed_by_id"], ["users.id"], name=op.f("fk_catalog_partners_proposed_by_id_users"), ondelete="SET NULL"
        ),
        sa.CheckConstraint("state IN ('proposed', 'active', 'inactive')", name="state_valid"),
    )

    op.create_table(
        "catalog_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("points_cost", sa.Integer(), nullable=False),
        sa.Column("donation_value_cents", sa.Integer(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("stock", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["partner_id"],
            ["catalog_partners.id"],
            name=op.f("fk_catalog_items_partner_id_catalog_partners"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_catalog_items")),
        sa.CheckConstraint("kind IN ('ipss_donation', 'partner_prize', 'environmental')", name="kind_valid"),
        sa.CheckConstraint("points_cost > 0", name="cost_positive"),
        sa.CheckConstraint("stock IS NULL OR stock >= 0", name="stock_nonnegative"),
        sa.CheckConstraint(
            "(kind = 'ipss_donation') = (donation_value_cents IS NOT NULL)", name="donation_value_only_ipss"
        ),
        sa.CheckConstraint("(kind = 'partner_prize') = (partner_id IS NOT NULL)", name="partner_only_prizes"),
    )
    op.create_index(op.f("ix_catalog_items_partner_id"), "catalog_items", ["partner_id"], unique=False)
    op.create_index("ix_catalog_items_active", "catalog_items", ["active"], unique=False)

    op.create_table(
        "point_campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_point_campaigns")),
        sa.CheckConstraint("ends_at > starts_at", name="window_valid"),
    )

    op.create_table(
        "redemptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("item_name", sa.String(length=120), nullable=False),
        sa.Column("item_kind", sa.String(length=32), nullable=False),
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("partner_name", sa.String(length=120), nullable=True),
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("points_spent", sa.Integer(), nullable=False),
        sa.Column("donation_value_cents", sa.Integer(), nullable=True),
        sa.Column("state", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("validated_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_redemptions_user_id_users"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["item_id"], ["catalog_items.id"], name=op.f("fk_redemptions_item_id_catalog_items"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["partner_id"],
            ["catalog_partners.id"],
            name=op.f("fk_redemptions_partner_id_catalog_partners"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["validated_by_id"], ["users.id"], name=op.f("fk_redemptions_validated_by_id_users"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_redemptions")),
        sa.CheckConstraint("state IN ('pending', 'validated')", name="state_valid"),
        sa.CheckConstraint("item_kind IN ('ipss_donation', 'partner_prize', 'environmental')", name="item_kind_valid"),
        sa.CheckConstraint("points_spent > 0", name="spent_positive"),
    )
    # O código é único no mundo por índice ÚNICO (é o que a base recusa em corrida) — e consultável.
    op.create_index(op.f("ix_redemptions_code"), "redemptions", ["code"], unique=True)
    op.create_index(op.f("ix_redemptions_user_id"), "redemptions", ["user_id"], unique=False)
    op.create_index("ix_redemptions_user_created", "redemptions", ["user_id", "created_at"], unique=False)
    op.create_index("ix_redemptions_partner_state", "redemptions", ["partner_id", "state"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_redemptions_partner_state", table_name="redemptions")
    op.drop_index("ix_redemptions_user_created", table_name="redemptions")
    op.drop_index(op.f("ix_redemptions_user_id"), table_name="redemptions")
    op.drop_index(op.f("ix_redemptions_code"), table_name="redemptions")
    op.drop_table("redemptions")
    op.drop_table("point_campaigns")
    op.drop_index("ix_catalog_items_active", table_name="catalog_items")
    op.drop_index(op.f("ix_catalog_items_partner_id"), table_name="catalog_items")
    op.drop_table("catalog_items")
    op.drop_table("catalog_partners")
