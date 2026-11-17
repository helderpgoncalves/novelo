"""A conta de local e o aviso «sacos prontos»: papel `local`, `local_accounts`, `stop_notices`.

O convite com papel `local` traz o local e a natureza do sítio (CHECK do papel recriado; entram `locality_id`
e `local_kind`). Tabela nova `local_accounts`: a conta pertence ao local (assistido ou produtor B2B), criada
pela equipa, com o certificado público opt-in. Tabela nova `stop_notices`: o aviso «sacos prontos» — um só
ativo por local (índice parcial único); anular não apaga, avisar outra vez cria linha nova.

Revision ID: 0020
Revises: 0019
Create Date: 2026-11-17 21:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# O CHECK do papel tem de ser recriado à mão: entra `local` (conta de local criada pela equipa).
ROLE_OLD = "('admin', 'operator', 'guest')"
ROLE_NEW = "('admin', 'operator', 'guest', 'local')"


def upgrade() -> None:
    op.execute("ALTER TABLE invitations DROP CONSTRAINT ck_invitations_role_valid")
    op.execute(f"ALTER TABLE invitations ADD CONSTRAINT ck_invitations_role_valid CHECK (role IN {ROLE_NEW})")
    op.add_column("invitations", sa.Column("locality_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        op.f("fk_invitations_locality_id_localities"),
        "invitations",
        "localities",
        ["locality_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column("invitations", sa.Column("local_kind", sa.String(length=32), nullable=True))
    op.create_check_constraint(
        op.f("ck_invitations_local_kind_valid"), "invitations", "local_kind IN ('assistido', 'b2b')"
    )
    op.create_table(
        "local_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("locality_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("certificate_opt_in", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("certificate_opt_in_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("certificate_opt_in_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_local_accounts_user_id_users"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["locality_id"],
            ["localities.id"],
            name=op.f("fk_local_accounts_locality_id_localities"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["certificate_opt_in_by_id"],
            ["users.id"],
            name=op.f("fk_local_accounts_certificate_opt_in_by_id_users"),
            ondelete="SET NULL",
        ),  # fmt: skip
        sa.PrimaryKeyConstraint("id", name=op.f("pk_local_accounts")),
        sa.CheckConstraint("kind IN ('assistido', 'b2b')", name=op.f("ck_local_accounts_kind_valid")),
    )
    op.create_index(op.f("ix_local_accounts_user_id"), "local_accounts", ["user_id"], unique=True)
    op.create_index(op.f("ix_local_accounts_locality_id"), "local_accounts", ["locality_id"], unique=False)
    op.create_table(
        "stop_notices",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("locality_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("state", sa.String(length=32), server_default="active", nullable=False),
        sa.Column("bag_count", sa.Integer(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["locality_id"], ["localities.id"], name=op.f("fk_stop_notices_locality_id_localities"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"], ["users.id"], name=op.f("fk_stop_notices_created_by_id_users"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["cancelled_by_id"], ["users.id"], name=op.f("fk_stop_notices_cancelled_by_id_users"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_stop_notices")),
        sa.CheckConstraint("state IN ('active', 'cancelled')", name=op.f("ck_stop_notices_state_valid")),
        sa.CheckConstraint("bag_count IS NULL OR bag_count > 0", name=op.f("ck_stop_notices_bag_count_positive")),
    )
    op.create_index(op.f("ix_stop_notices_locality_id"), "stop_notices", ["locality_id"], unique=False)
    # Um só aviso ativo por local: os anulados ficam de fora (índice parcial).
    op.create_index(
        "uq_stop_notices_active_locality",
        "stop_notices",
        ["locality_id"],
        unique=True,
        postgresql_where=sa.text("state = 'active'"),
    )


def downgrade() -> None:
    op.drop_index("uq_stop_notices_active_locality", table_name="stop_notices")
    op.drop_index(op.f("ix_stop_notices_locality_id"), table_name="stop_notices")
    op.drop_table("stop_notices")
    op.drop_index(op.f("ix_local_accounts_locality_id"), table_name="local_accounts")
    op.drop_index(op.f("ix_local_accounts_user_id"), table_name="local_accounts")
    op.drop_table("local_accounts")
    op.drop_column("invitations", "local_kind")
    op.drop_constraint(op.f("ck_invitations_local_kind_valid"), "invitations", type_name="check")
    op.drop_constraint(op.f("fk_invitations_locality_id_localities"), "invitations", type_name="foreignkey")
    op.drop_column("invitations", "locality_id")
    op.execute("ALTER TABLE invitations DROP CONSTRAINT ck_invitations_role_valid")
    op.execute(f"ALTER TABLE invitations ADD CONSTRAINT ck_invitations_role_valid CHECK (role IN {ROLE_OLD})")
