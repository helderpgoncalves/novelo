"""convites por email, auditoria de administração e sessões de impersonação

As chaves estrangeiras para `users` já tratam a eliminação de contas: CASCADE nos dados pessoais (sessões, tokens,
copiloto) e SET NULL nos registos operacionais (cenários, relatórios, lotes, alertas, parâmetros, utilização de IA).
Esta migração só acrescenta tabelas e segue a mesma regra.

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-20 21:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Aprovação de contas: as existentes ficam aprovadas (server_default); só os registos novos nascem pendentes.
    op.add_column(
        "users", sa.Column("approval_status", sa.String(length=10), server_default="approved", nullable=False)
    )
    op.add_column("users", sa.Column("approved_by_id", sa.UUID(), nullable=True))
    op.add_column("users", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("rejected_reason", sa.String(length=300), nullable=True))
    op.create_foreign_key(
        op.f("fk_users_approved_by_id_users"), "users", "users", ["approved_by_id"], ["id"], ondelete="SET NULL"
    )
    op.create_check_constraint(
        op.f("ck_users_approval_status_valid"), "users", "approval_status IN ('pending', 'approved', 'rejected')"
    )

    op.create_table(
        "invitations",
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=True),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("locale", sa.String(length=8), server_default="pt-PT", nullable=False),
        sa.Column("message", sa.String(length=500), nullable=True),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("invited_by_id", sa.UUID(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accepted_user_id", sa.UUID(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("send_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.CheckConstraint("role IN ('admin', 'operator', 'guest')", name=op.f("ck_invitations_role_valid")),
        sa.ForeignKeyConstraint(
            ["invited_by_id"], ["users.id"], name=op.f("fk_invitations_invited_by_id_users"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["accepted_user_id"], ["users.id"], name=op.f("fk_invitations_accepted_user_id_users"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_invitations")),
    )
    op.create_index(op.f("ix_invitations_email"), "invitations", ["email"], unique=False)
    op.create_index(op.f("ix_invitations_token_hash"), "invitations", ["token_hash"], unique=True)
    op.create_index(op.f("ix_invitations_invited_by_id"), "invitations", ["invited_by_id"], unique=False)
    op.create_index(
        "uq_invitations_pending_email",
        "invitations",
        ["email"],
        unique=True,
        postgresql_where=sa.text("accepted_at IS NULL AND revoked_at IS NULL"),
    )

    op.create_table(
        "audit_log",
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("actor_id", sa.UUID(), nullable=True),
        sa.Column("effective_actor_id", sa.UUID(), nullable=True),
        sa.Column("action", sa.String(length=60), nullable=False),
        sa.Column("target_type", sa.String(length=30), nullable=True),
        sa.Column("target_id", sa.String(length=64), nullable=True),
        sa.Column("target_label", sa.String(length=255), nullable=True),
        sa.Column("ip", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column(
            "details", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False
        ),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(
            ["actor_id"], ["users.id"], name=op.f("fk_audit_log_actor_id_users"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["effective_actor_id"],
            ["users.id"],
            name=op.f("fk_audit_log_effective_actor_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_log")),
    )
    op.create_index(op.f("ix_audit_log_created_at"), "audit_log", ["created_at"], unique=False)
    op.create_index(op.f("ix_audit_log_actor_id"), "audit_log", ["actor_id"], unique=False)
    op.create_index(op.f("ix_audit_log_action"), "audit_log", ["action"], unique=False)
    op.create_index(op.f("ix_audit_log_target_id"), "audit_log", ["target_id"], unique=False)

    op.create_table(
        "impersonation_sessions",
        sa.Column("admin_id", sa.UUID(), nullable=False),
        sa.Column("target_id", sa.UUID(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(
            ["admin_id"], ["users.id"], name=op.f("fk_impersonation_sessions_admin_id_users"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["target_id"], ["users.id"], name=op.f("fk_impersonation_sessions_target_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_impersonation_sessions")),
    )
    op.create_index(op.f("ix_impersonation_sessions_admin_id"), "impersonation_sessions", ["admin_id"], unique=False)
    op.create_index(op.f("ix_impersonation_sessions_target_id"), "impersonation_sessions", ["target_id"], unique=False)


def downgrade() -> None:
    op.drop_constraint(op.f("ck_users_approval_status_valid"), "users", type_="check")
    op.drop_constraint(op.f("fk_users_approved_by_id_users"), "users", type_="foreignkey")
    op.drop_column("users", "rejected_reason")
    op.drop_column("users", "approved_at")
    op.drop_column("users", "approved_by_id")
    op.drop_column("users", "approval_status")
    op.drop_table("impersonation_sessions")
    op.drop_table("audit_log")
    op.drop_table("invitations")
