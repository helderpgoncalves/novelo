"""Definições globais da aplicação (uma linha): registo aberto

Com `open_registration` ligado, quem se regista (password ou Google) ou entra com a conta por aprovar fica logo
aprovado. Por omissão desligado: sem linha, o comportamento é o de antes (aprovação por um administrador).

Revision ID: 0015
Revises: 0014
Create Date: 2026-10-21 18:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("singleton", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("open_registration", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("updated_by_id", sa.UUID(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("singleton", name=op.f("ck_app_settings_singleton_only")),
        sa.ForeignKeyConstraint(
            ["updated_by_id"], ["users.id"], name=op.f("fk_app_settings_updated_by_id_users"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_app_settings")),
        sa.UniqueConstraint("singleton", name=op.f("uq_app_settings_singleton")),
    )


def downgrade() -> None:
    op.drop_table("app_settings")
