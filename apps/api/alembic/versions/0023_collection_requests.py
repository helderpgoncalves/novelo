"""O pedido de recolha unificado: tabela `collection_requests` (cidadão, local assistido e B2B).

Entidade única com discriminador `subject_kind` (`citizen` | `local`): a criação resolve logo para
`scheduled` (auto-aceite pelas regras — corte de 48 h, limites de sacos, ronda na freguesia) ou para
`exception` (a fila de despacho da Vitrus: fora de ronda, fora do prazo, urgência, recolha especial
acima de 20 sacos). «1 ativo por morada» fica garantido por índice parcial único na chave normalizada
(morada escrita do cidadão ou `localidade:<uuid>` do local institucional), só nos estados ativos. A
morada retém-se 12 meses (`address_retained_until`) e purga-se à leitura — `address`/`address_key` a
nulo, o pedido fica para o histórico e os agregados.

Revision ID: 0023
Revises: 0022
Create Date: 2026-11-17 22:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0023"
down_revision: str | None = "0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "collection_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject_kind", sa.String(length=32), nullable=False),
        sa.Column("requester_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("locality_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("address_key", sa.Text(), nullable=True),
        sa.Column("parish_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("bag_count", sa.Integer(), nullable=False),
        sa.Column("requested_date", sa.Date(), nullable=False),
        sa.Column("urgent", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("state", sa.String(length=32), nullable=False),
        sa.Column("exception_reason", sa.String(length=32), nullable=True),
        sa.Column("missed_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("dispatched_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dispatch_reason", sa.Text(), nullable=True),
        sa.Column("collected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("expired_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("address_retained_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["requester_id"], ["users.id"], name=op.f("fk_collection_requests_requester_id_users"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["locality_id"],
            ["localities.id"],
            name=op.f("fk_collection_requests_locality_id_localities"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["parish_id"], ["parishes.id"], name=op.f("fk_collection_requests_parish_id_parishes"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["dispatched_by_id"],
            ["users.id"],
            name=op.f("fk_collection_requests_dispatched_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["cancelled_by_id"],
            ["users.id"],
            name=op.f("fk_collection_requests_cancelled_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_collection_requests")),
        sa.CheckConstraint(
            "subject_kind IN ('citizen', 'local')", name=op.f("ck_collection_requests_subject_kind_valid")
        ),
        sa.CheckConstraint(
            "state IN ('scheduled', 'exception', 'rejected', 'collected', 'expired', 'cancelled')",
            name=op.f("ck_collection_requests_state_valid"),
        ),
        sa.CheckConstraint(
            "exception_reason IS NULL OR exception_reason IN ('out_of_round', 'cutoff', 'special_volume', 'urgency')",
            name=op.f("ck_collection_requests_exception_reason_valid"),
        ),
        sa.CheckConstraint("bag_count > 0", name=op.f("ck_collection_requests_bag_count_positive")),
    )
    op.create_index(op.f("ix_collection_requests_requester_id"), "collection_requests", ["requester_id"], unique=False)
    op.create_index(op.f("ix_collection_requests_locality_id"), "collection_requests", ["locality_id"], unique=False)
    op.create_index(op.f("ix_collection_requests_parish_id"), "collection_requests", ["parish_id"], unique=False)
    op.create_index(op.f("ix_collection_requests_state"), "collection_requests", ["state"], unique=False)
    op.create_index(op.f("ix_collection_requests_address_key"), "collection_requests", ["address_key"], unique=False)
    op.create_index(
        op.f("ix_collection_requests_address_retained_until"),
        "collection_requests",
        ["address_retained_until"],
        unique=False,
    )
    # 1 ativo por morada: a chave normalizada, só nos estados ativos (os terminais são história).
    op.create_index(
        "uq_collection_requests_active_address",
        "collection_requests",
        ["address_key"],
        unique=True,
        postgresql_where=sa.text("state IN ('scheduled', 'exception') AND address_key IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_collection_requests_active_address", table_name="collection_requests")
    op.drop_index(op.f("ix_collection_requests_address_retained_until"), table_name="collection_requests")
    op.drop_index(op.f("ix_collection_requests_address_key"), table_name="collection_requests")
    op.drop_index(op.f("ix_collection_requests_state"), table_name="collection_requests")
    op.drop_index(op.f("ix_collection_requests_parish_id"), table_name="collection_requests")
    op.drop_index(op.f("ix_collection_requests_locality_id"), table_name="collection_requests")
    op.drop_index(op.f("ix_collection_requests_requester_id"), table_name="collection_requests")
    op.drop_table("collection_requests")
