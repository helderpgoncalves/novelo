"""novos tipos de alerta para a importação de contentores

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-19 23:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_KINDS = (
    "circuit_without_vehicle",
    "vehicle_code",
    "unknown_circuit",
    "incomplete_circuit",
    "duplicate_vehicle",
    "possible_plate_error",
    "multi_typology_vehicle",
    "vehicle_without_circuit",
    "undocumented_circuits",
    "different_dates",
    "normalized_spelling",
)
NEW_KINDS = (*OLD_KINDS, "container_rows_rejected", "container_pending_location", "container_assumed_values")
CONSTRAINT = "ck_data_alerts_kind_valid"


def _in_list(kinds: tuple[str, ...]) -> str:
    return "kind IN (" + ", ".join(f"'{k}'" for k in kinds) + ")"


def upgrade() -> None:
    op.drop_constraint(op.f(CONSTRAINT), "data_alerts", type_="check")
    op.create_check_constraint(op.f(CONSTRAINT), "data_alerts", _in_list(NEW_KINDS))


def downgrade() -> None:
    op.execute("DELETE FROM data_alerts WHERE kind LIKE 'container\\_%'")
    op.drop_constraint(op.f(CONSTRAINT), "data_alerts", type_="check")
    op.create_check_constraint(op.f(CONSTRAINT), "data_alerts", _in_list(OLD_KINDS))
