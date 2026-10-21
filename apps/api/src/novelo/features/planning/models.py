import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, Integer, Numeric, SmallInteger, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from novelo.core.database import Base, TimestampMixin, UuidPkMixin, enum_check, enum_column
from novelo.domain.vocab import ScenarioObjective, ScenarioStatus


class ParameterSet(Base, UuidPkMixin, TimestampMixin):
    """Pressupostos do modelo (captura, custos...). Há um conjunto ativo; cada cenário guarda uma cópia."""

    __tablename__ = "parameter_sets"

    name: Mapped[str] = mapped_column(String(80), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    values: Mapped[dict[str, Any]] = mapped_column(JSONB)
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )


class Scenario(Base, UuidPkMixin, TimestampMixin):
    """Uma execução do otimizador: entradas, resultado e autor. Imutável; para mudar cria-se outro (parent_id)."""

    __tablename__ = "scenarios"
    __table_args__ = (
        enum_check("objective", ScenarioObjective),
        enum_check("status", ScenarioStatus),
        CheckConstraint("budget_eur_year IS NULL OR budget_eur_year >= 0", name="budget_non_negative"),
        CheckConstraint("siting IN ('parish', 'sites')", name="siting"),
        Index("ix_scenarios_created_at", "created_at"),  # listas e home ordenam por data, mais recentes primeiro
    )

    label: Mapped[str] = mapped_column(String(80))
    objective: Mapped[ScenarioObjective] = mapped_column(enum_column(ScenarioObjective))
    budget_eur_year: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    target_tonnes: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    status: Mapped[ScenarioStatus] = mapped_column(enum_column(ScenarioStatus))
    solver_status: Mapped[str] = mapped_column(String(20))
    # Cópia dos pressupostos usados e das restrições por freguesia: o cenário é reproduzível.
    params: Mapped[dict[str, Any]] = mapped_column(JSONB)
    parameter_set_version: Mapped[int] = mapped_column(SmallInteger, default=1)
    constraints: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    result: Mapped[dict[str, Any]] = mapped_column(JSONB)
    # KPIs desnormalizados para listar e ordenar sem abrir o JSON.
    tonnes_year: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    capex_eur: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    annual_cost_eur: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    eur_per_tonne: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    coverage_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    # Modos de recolha com pelo menos uma freguesia (derivado de `result.modes`): a home não abre o JSON todo.
    modes: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default=text("'[]'::jsonb"))
    # `parish`: por freguesia; `sites`: escolhe locais reais da rede municipal (derivado de `result.siting`).
    siting: Mapped[str] = mapped_column(String(10), default="parish", server_default="parish")
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scenarios.id", ondelete="SET NULL"), index=True
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    # Cenário de referência criado pelo arranque (`planning/reference.py`): chave estável (ex.: `sites:60000`,
    # `parish:60000`) e a versão do modelo com que foi calculado. Nulo = cenário de um utilizador (nunca se apaga).
    reference_key: Mapped[str | None] = mapped_column(String(40), index=True)
    reference_version: Mapped[int | None] = mapped_column(SmallInteger)
