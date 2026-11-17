"""O cidadão: perfil de doador na conta e sacos ativados (`bag_activations`).

A conta de doador é uma conta normal com papel `donor`: ganha a idade DECLARADA (13+; abaixo é
recusa explícita — ADR RGPD da conta de doador) e o código pseudónimo do QR de conta (`NVA-…`,
portador de crédito, nunca credencial de sessão). `bag_activations` é a unidade de crédito do
doador (ADR #35: crédito por saco ativado, nunca por kg): código `NVL-XXXXXX` único no mundo (é o
QR que a viatura lê no scan e entra em `lot_units.code`), apelido PRIVADO, declaração «Vai no
saco?» opcional (`reuse`/`recycle`, base do bónus de conformidade de #64) e `deactivated_at`
(desativar congela sem apagar). `user_id` é SET NULL: a ativação sobrevive à conta — os agregados
ficam, o crédito morre com ela.

Revision ID: 0024
Revises: 0023
Create Date: 2026-11-17 23:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0024"
down_revision: str | None = "0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("declared_age", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("donor_code", sa.String(length=16), nullable=True))
    op.create_index(op.f("ix_users_donor_code"), "users", ["donor_code"], unique=True)
    op.create_check_constraint("declared_age_minimum", "users", sa.text("declared_age IS NULL OR declared_age >= 13"))
    op.create_table(
        "bag_activations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("nickname", sa.String(length=80), nullable=True),
        sa.Column("declaration", sa.String(length=32), nullable=True),
        sa.Column("declared_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_bag_activations_user_id_users"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_bag_activations")),
        sa.CheckConstraint("declaration IN ('reuse', 'recycle')", name="declaration_valid"),
    )
    op.create_index(op.f("ix_bag_activations_code"), "bag_activations", ["code"], unique=True)
    op.create_index(op.f("ix_bag_activations_user_id"), "bag_activations", ["user_id"], unique=False)
    op.create_index("ix_bag_activations_user_active", "bag_activations", ["user_id", "deactivated_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_bag_activations_user_active", table_name="bag_activations")
    op.drop_index(op.f("ix_bag_activations_user_id"), table_name="bag_activations")
    op.drop_index(op.f("ix_bag_activations_code"), table_name="bag_activations")
    op.drop_table("bag_activations")
    op.drop_constraint("declared_age_minimum", "users", type_="check")
    op.drop_index(op.f("ix_users_donor_code"), table_name="users")
    op.drop_column("users", "donor_code")
    op.drop_column("users", "declared_age")
