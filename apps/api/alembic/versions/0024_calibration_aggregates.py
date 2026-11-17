"""Agregados da calibração: tabela `calibration_aggregates` (métrica × unidade × janela de 12 semanas).

A única ponte entre os eventos (pesos medidos nas paragens, pedidos de recolha) e o planeamento:
recomputada só quando um cenário é recalculado (nunca agendada; ADR «Captura anual é derivada», #53).
Cada linha guarda o blend completo — prior, observado, calibrado, n, peso do observado e rótulo
(«pressuposto», «estimativa·n», «observado·n») — para o painel «Calibração» e para a fotografia que
cada cenário copia para o seu resultado. O recálculo reconstrói a tabela inteira: uma linha por
(métrica, unidade) via `uq_calibration_metric_unit` com `unit_key` («local:<uuid>»,
«parish:<dicofre>», «concelho»).

Revision ID: 0024
Revises: 0023
Create Date: 2026-11-18 00:00:00.000000
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
    op.create_table(
        "calibration_aggregates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("metric", sa.String(length=32), nullable=False),
        sa.Column("scope", sa.String(length=32), nullable=False),
        sa.Column("unit_key", sa.String(length=60), nullable=False),
        sa.Column("unit_code", sa.String(length=60), nullable=False),
        sa.Column("unit_name", sa.String(length=120), nullable=False),
        sa.Column("parish_code", sa.String(length=20), nullable=False, server_default=""),
        sa.Column("locality_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("parish_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("n", sa.Integer(), nullable=False),
        sa.Column("pseudo_k", sa.Integer(), nullable=False),
        sa.Column("observed", sa.Numeric(16, 8), nullable=True),
        sa.Column("prior", sa.Numeric(16, 8), nullable=False),
        sa.Column("blended", sa.Numeric(16, 8), nullable=False),
        sa.Column("weight", sa.Numeric(10, 8), nullable=False),
        sa.Column("label", sa.String(length=40), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("window_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["locality_id"],
            ["localities.id"],
            name=op.f("fk_calibration_aggregates_locality_id_localities"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["parish_id"],
            ["parishes.id"],
            name=op.f("fk_calibration_aggregates_parish_id_parishes"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_calibration_aggregates")),
        sa.CheckConstraint(
            "metric IN ('generation_rate', 'kg_per_bag', 'bags_per_round', 'requests_per_week', 'on_demand_capture')",
            name=op.f("ck_calibration_aggregates_metric_valid"),
        ),
        sa.CheckConstraint(
            "scope IN ('local', 'parish', 'concelho')",
            name=op.f("ck_calibration_aggregates_scope_valid"),
        ),
        sa.CheckConstraint("n >= 0", name=op.f("ck_calibration_aggregates_n_non_negative")),
        sa.CheckConstraint("pseudo_k > 0", name=op.f("ck_calibration_aggregates_pseudo_k_positive")),
        sa.UniqueConstraint("metric", "unit_key", name=op.f("uq_calibration_metric_unit")),
    )
    op.create_index(op.f("ix_calibration_aggregates_locality_id"), "calibration_aggregates", ["locality_id"])
    op.create_index(op.f("ix_calibration_aggregates_parish_id"), "calibration_aggregates", ["parish_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_calibration_aggregates_parish_id"), table_name="calibration_aggregates")
    op.drop_index(op.f("ix_calibration_aggregates_locality_id"), table_name="calibration_aggregates")
    op.drop_table("calibration_aggregates")
