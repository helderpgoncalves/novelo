"""O saco ativado: a unidade de crédito do doador (nunca por kg — ADR #35).

Um saco da plataforma ativa-se no app com um apelido PRIVADO (nunca sai do próprio; lotes e passaportes
nunca mostram o doador) e uma declaração opcional «Vai no saco?» (`BagDeclaration`, base do bónus de
conformidade de #64). O código `NVL-XXXXXX` é o QR que a viatura lê no scan — entra em `lot_units.code`
como `source="bag"`, e é por aí que o histórico do doador chega ao passaporte público. Desativar congela
o saco (saiu do sistema) sem o apagar; a ativação sobrevive à conta (`user_id` SET NULL) — os agregados
ficam, o crédito morre com a conta.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from novelo.core.database import Base, TimestampMixin, UuidPkMixin, enum_check, enum_column
from novelo.domain.vocab import BagDeclaration


class BagActivation(Base, UuidPkMixin, TimestampMixin):
    """Um saco da plataforma ativado por um doador: QR próprio, apelido privado, declaração opcional.

    `active` deduz-se de `deactivated_at is null`. O mesmo código nunca se repete (índice único global:
    o QR tem de identificar um saco físico no mundo, não dentro de uma conta).
    """

    __tablename__ = "bag_activations"
    __table_args__ = (
        enum_check("declaration", BagDeclaration),
        Index("ix_bag_activations_user_active", "user_id", "deactivated_at"),
    )

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    # Apelido PRIVADO: só o dono o vê — nunca em lotes, passaportes ou listas da equipa.
    nickname: Mapped[str | None] = mapped_column(String(80))
    # Declaração «Vai no saco?» (base do bónus de conformidade, #64) e o momento em que foi feita.
    declaration: Mapped[BagDeclaration | None] = mapped_column(enum_column(BagDeclaration))
    declared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Desativar congela o saco (edições bloqueadas); nulo = ativo.
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


__all__ = ["BagActivation", "uuid"]
