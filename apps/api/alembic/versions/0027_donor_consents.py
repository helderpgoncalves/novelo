"""O registo de consentimentos do doador: linhas append-only, uma por decisão (RGPD #66).

`donor_consents`: quem (user_id, SET NULL — sobrevive anónimo ao apagamento), que finalidade
(marketing/partnerships), dado ou retirado, que versão da política viu e de onde veio. A história é a
prova do art. 7.º/1 RGPD: nunca se edita nem se apaga uma linha.

Revision ID: 0027
Revises: 0026
Create Date: 2026-11-18 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0027"
down_revision: str | None = "0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "donor_consents",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("seq", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("granted", sa.Boolean(), nullable=False),
        sa.Column("policy_version", sa.String(length=40), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False, server_default="account"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_donor_consents_user_id_users"), ondelete="SET NULL"
        ),
        sa.CheckConstraint(
            "purpose IN ('marketing', 'partnerships')", name=op.f("ck_donor_consents_purpose_valid")
        ),
    )
    op.create_index(
        "ix_donor_consents_user_purpose_created",
        "donor_consents",
        ["user_id", "purpose", "created_at"],
        unique=False,
    )
    op.create_index(op.f("ix_donor_consents_user_id"), "donor_consents", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_donor_consents_user_id"), table_name="donor_consents")
    op.drop_index("ix_donor_consents_user_purpose_created", table_name="donor_consents")
    op.drop_table("donor_consents")
