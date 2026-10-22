"""Pressupostos ativos com a base de 22 out 2026: procura do concelho, tratamento, estaleiro e viatura dedicada

A Vitrus respondeu a 22 out 2026: o saco de têxtil não pode ir na compactadora do porta a porta (a recolha é feita por
uma viatura nova, sem compactação), o tratamento do indiferenciado custa 105,64 €/t (40 €/t TGR + 65,64 €/t
Resinorte) e o estaleiro é o da Rua das Lameiras, Polvoreira. A procura passa a ser o indiferenciado do concelho
(43 050,5 t ÷ 0,840) × 5,86% (APA). O conjunto ativo só muda nos campos que ninguém alterou (valor antigo exato); os
campos do canal porta a porta (`piggyback_*`, `pap_*`) saem. Cenários antigos ficam como estão.

Revision ID: 0017
Revises: 0016
Create Date: 2026-10-22 20:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: str | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Fotografia dos valores (uma migração não importa o código da aplicação): features/planning/assumptions.py e
# features/textile/references.py.
OLD_KG = round(43_051 * 0.054 * 1000 / 156_830 / 12, 4)  # 1,2353
NEW_KG = round(43_050.5 / 0.84 * 0.0586 * 1000 / 156_830 / 12, 5)  # 1,59583
OLD_DEPOT = (41.4425, -8.2918)  # centro de Guimarães (pressuposto antigo)
NEW_DEPOT = (41.41823, -8.30164)  # estaleiro de Polvoreira (Vitrus)
OLD_CAPACITY_T = 4.0  # viatura PAP
NEW_CAPACITY_T = 2.0  # viatura dedicada de caixa fechada (pressuposto)
TREATMENT_EUR_PER_T = 105.64
NEW_FIELDS = {
    "on_demand_every_weeks": 2,
    "vehicle_capex_eur": 42_500.0,
    "vehicle_lifetime_years": 8.0,
    "vehicle_speed_kmh": 30.0,
    "door_stop_minutes": 2.0,
    "site_stop_minutes": 10.0,
    "shift_hours": 7.0,
}
DROPPED = ("piggyback_extra_km", "piggyback_min_days", "pap_cost_per_pickup_eur", "pap_free_capacity_kg")


def _swap_number(key: str, old: float, new: float, tolerance: float = 1e-9) -> None:
    op.get_bind().execute(
        sa.text(
            f"UPDATE parameter_sets SET values = jsonb_set(values, '{{{key}}}', to_jsonb(CAST(:new AS float8))) "
            f"WHERE is_default AND abs((values->>'{key}')::float8 - :old) < :tol"
        ),
        {"old": old, "new": new, "tol": tolerance},
    )


def upgrade() -> None:
    bind = op.get_bind()
    # O conjunto ativo pode ter a base antiga a 4 casas (1,2353) ou sem arredondar (1,23528...): ambas são a mesma.
    _swap_number("kg_per_inhab_month", OLD_KG, NEW_KG, tolerance=1e-4)
    _swap_number("depot_lat", OLD_DEPOT[0], NEW_DEPOT[0])
    _swap_number("depot_lon", OLD_DEPOT[1], NEW_DEPOT[1])
    _swap_number("vehicle_capacity_t", OLD_CAPACITY_T, NEW_CAPACITY_T)
    bind.execute(
        sa.text(
            "UPDATE parameter_sets SET values = jsonb_set(values, '{rsu_treatment_eur_per_t}', "
            "to_jsonb(CAST(:v AS float8))) "
            "WHERE is_default AND (values->'rsu_treatment_eur_per_t' IS NULL "
            "OR jsonb_typeof(values->'rsu_treatment_eur_per_t') = 'null')"
        ),
        {"v": TREATMENT_EUR_PER_T},
    )
    for key, value in NEW_FIELDS.items():
        bind.execute(
            sa.text(
                f"UPDATE parameter_sets SET values = jsonb_set(values, '{{{key}}}', to_jsonb(CAST(:v AS float8))) "
                f"WHERE is_default AND NOT (values ? '{key}')"
            ),
            {"v": value},
        )
    for key in DROPPED:
        bind.execute(sa.text(f"UPDATE parameter_sets SET values = values - '{key}' WHERE is_default"))
    bind.execute(sa.text("UPDATE parameter_sets SET version = version + 1 WHERE is_default"))


def downgrade() -> None:
    _swap_number("kg_per_inhab_month", NEW_KG, OLD_KG, tolerance=1e-4)
    _swap_number("depot_lat", NEW_DEPOT[0], OLD_DEPOT[0])
    _swap_number("depot_lon", NEW_DEPOT[1], OLD_DEPOT[1])
    _swap_number("vehicle_capacity_t", NEW_CAPACITY_T, OLD_CAPACITY_T)
