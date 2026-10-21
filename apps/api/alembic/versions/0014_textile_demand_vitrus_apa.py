"""Procura de têxtil com a base da Vitrus + APA no conjunto de pressupostos ativo

A 21 out 2026 a Vitrus indicou a base do têxtil: 43 051 t de RSU recolhidas em 2025 × 5,4% de têxtil (APA), ou seja,
1,2353 kg por habitante e mês do que ainda vai para o lixo. O conjunto ativo guardado na base de dados ainda tem os
0,7 kg/hab/mês do plano municipal; só se atualiza se ninguém o alterou (valor antigo exato). Cenários antigos ficam
como estão: guardam a sua cópia dos pressupostos.

Revision ID: 0014
Revises: 0013
Create Date: 2026-10-21 16:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Fotografia dos valores (uma migração não importa o código da aplicação):
# 43 051 t × 0,054 × 1000 ÷ 156 830 hab ÷ 12 meses (features/textile/references.py).
OLD_KG_PER_INHAB_MONTH = 0.7
NEW_KG_PER_INHAB_MONTH = round(43_051 * 0.054 * 1000 / 156_830 / 12, 4)  # 1,2353, como em params.py


def _swap(old: float, new: float) -> None:
    op.get_bind().execute(
        sa.text(
            "UPDATE parameter_sets SET values = jsonb_set(values, '{kg_per_inhab_month}', to_jsonb(CAST(:new AS float8))), "
            "version = version + 1 "
            "WHERE is_default AND abs((values->>'kg_per_inhab_month')::float8 - :old) < 1e-9"
        ),
        {"old": old, "new": new},
    )


def upgrade() -> None:
    _swap(OLD_KG_PER_INHAB_MONTH, NEW_KG_PER_INHAB_MONTH)


def downgrade() -> None:
    _swap(NEW_KG_PER_INHAB_MONTH, OLD_KG_PER_INHAB_MONTH)
