"""A tabela de agregados da calibração: a ÚNICA ponte entre os eventos e o planeamento (spec #62).

`CalibrationAggregate` — métrica × unidade × janela de 12 semanas, recomputada só quando um cenário é
recalculado (nunca agendada; ADR: captura anual é derivada). O planeamento lê apenas esta tabela:
eventos individuais (paragens com pesos, pedidos com morada) nunca chegam a ele. Cada linha carrega o
blend completo — prior, observado, calibrado, n, rótulo — para que o painel «Calibração» e a
fotografia do cenário se leiam sem voltar aos eventos.
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from novelo.core.database import Base, TimestampMixin, UuidPkMixin, enum_check, enum_column
from novelo.domain.vocab import CalibrationMetric, CalibrationScope


class CalibrationAggregate(Base, UuidPkMixin, TimestampMixin):
    """Uma métrica calibrada numa unidade (local, freguesia ou concelho) na janela atual.

    O recálculo reconstrói a tabela inteira numa transação (idempotente): o estado é sempre a última
    fotografia completa. `unit_key` garante uma linha por (métrica, unidade) — `local:<uuid>`,
    `parish:<dicofre>` ou `concelho`. `label` é o rótulo humano («pressuposto», «estimativa·n»,
    «observado·n») que o painel e os pressupostos mostram.
    """

    __tablename__ = "calibration_aggregates"
    __table_args__ = (
        enum_check("metric", CalibrationMetric),
        enum_check("scope", CalibrationScope),
        UniqueConstraint("metric", "unit_key", name="uq_calibration_metric_unit"),
        CheckConstraint("n >= 0", name="n_non_negative"),
        CheckConstraint("pseudo_k > 0", name="pseudo_k_positive"),
    )

    metric: Mapped[CalibrationMetric] = mapped_column(enum_column(CalibrationMetric))
    scope: Mapped[CalibrationScope] = mapped_column(enum_column(CalibrationScope))
    # Chave estável da unidade: «local:<uuid>», «parish:<dicofre>» ou «concelho». Os FKs abaixo ligam à
    # rede (SET NULL: a rede muda, o agregado observado fica).
    unit_key: Mapped[str] = mapped_column(String(60))
    unit_code: Mapped[str] = mapped_column(String(60))
    unit_name: Mapped[str] = mapped_column(String(120))
    parish_code: Mapped[str] = mapped_column(String(20), default="", server_default="")
    locality_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("localities.id", ondelete="SET NULL"), index=True
    )
    parish_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("parishes.id", ondelete="SET NULL"), index=True
    )
    # Amostras e blend: n conta visitas (métricas por local) ou semanas (por freguesia).
    n: Mapped[int] = mapped_column(Integer)
    pseudo_k: Mapped[int] = mapped_column(Integer)
    observed: Mapped[Decimal | None] = mapped_column(Numeric(16, 8))  # estatística da janela; nulo sem amostras
    prior: Mapped[Decimal] = mapped_column(Numeric(16, 8))
    blended: Mapped[Decimal] = mapped_column(Numeric(16, 8))
    weight: Mapped[Decimal] = mapped_column(Numeric(10, 8))  # n ÷ (n + k), 0 a 1
    label: Mapped[str] = mapped_column(String(40))
    # Janela e altura do recálculo (a fotografia do cenário copia-as linha a linha).
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
