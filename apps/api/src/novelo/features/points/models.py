"""O livro-razão dos pontos: linhas IMUTÁVEIS, append-only, auditáveis.

Nunca há UPDATE nem DELETE no código (a única correção é uma anulação — entrada negativa com motivo,
interesse legítimo declarado). O saldo é SEMPRE derivado das linhas (`domain.points.fifo_balance`):
não há coluna de saldo em cache — #65 (catálogo e resgate) acrescenta `redemption` e o saldo continua
a sair daqui. A imutabilidade é garantida por índices únicos PARCIAIS: um ganho flat por saco no
mundo, um bónus por saco na vida — a base recusa o duplicado mesmo em corrida entre processos.

`user_id` é SET NULL (ADR RGPD da conta): apagar a conta perde o crédito, mas as linhas ficam para os
agregados — toda a leitura filtra por conta viva, e as linhas órfãs não incomodam ninguém.
"""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Identity, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from novelo.core.database import Base, TimestampMixin, UuidPkMixin, enum_check, enum_column
from novelo.domain.points import PointEntryKind


class PointEntry(Base, UuidPkMixin, TimestampMixin):
    """Um lançamento do livro-razão: tipo, valor ASSINADO, fontes (saco e lote) e, na anulação, motivo.

    Ganha-se por SACO (código no `bag_code`), nunca por kg — ADR #35. `expires_at` existe só em ganhos
    (12 meses); anulações não expiram — consomem FIFO, e o saldo calcula-se em `domain/points.py`.
    """

    __tablename__ = "points_entries"
    __table_args__ = (
        enum_check("kind", PointEntryKind),
        CheckConstraint("amount != 0", name="amount_nonzero"),
        # Idempotência duradoura: o mesmo saco nunca ganha flat nem bónus duas vezes (parcial por tipo).
        Index(
            "uq_points_entries_flat_per_bag",
            "bag_code",
            unique=True,
            postgresql_where=sa.text("kind = 'gain_flat' AND bag_code IS NOT NULL"),
        ),
        Index(
            "uq_points_entries_bonus_per_bag",
            "bag_code",
            unique=True,
            postgresql_where=sa.text("kind = 'gain_bonus' AND bag_code IS NOT NULL"),
        ),
        Index("ix_points_entries_user_created", "user_id", "created_at"),
    )

    # Órfãs sobrevivem à conta (SET NULL): os agregados ficam, o crédito morre com ela.
    # Sequência GLOBAL monótona: dentro de uma transação todas as linhas nascem com o mesmo `created_at`
    # (now() do Postgres é o instante da transação) — o seq dá ordem de escrita determinística ao
    # histórico e ao FIFO, e aos auditores um número único por lançamento.
    seq: Mapped[int] = mapped_column(BigInteger, Identity(always=True), unique=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    kind: Mapped[PointEntryKind] = mapped_column(enum_column(PointEntryKind))
    amount: Mapped[int] = mapped_column(Integer)  # assinado: ganhos +, anulação/resgate −
    # Fontes do lançamento (auditoria sem joins): o saco que ganhou e o lote onde foi pesado/triado.
    bag_code: Mapped[str | None] = mapped_column(String(16))
    lot_code: Mapped[str | None] = mapped_column(String(16))
    # Fim do ganho (12 meses); nulo em anulações e resgates — que não expiram, consomem.
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    # Anulação em abuso: motivo OBRIGATÓRIO (auditoria) e quem a fez (SET NULL sobrevive à conta).
    reason: Mapped[str | None] = mapped_column(Text)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))


__all__ = ["PointEntry"]
