"""O pedido de recolha: entidade única para cidadão, local assistido e produtor B2B (spec #54).

Um discriminador (`subject_kind`) e a mesma máquina de estados para todos: a criação resolve logo —
`scheduled` (auto-aceite pelas regras de `domain/collection_requests.py`) ou `exception` (a fila de
despacho da Vitrus: fora de ronda, fora do prazo de 48 h, urgência, recolha especial). É diferente do
aviso «sacos prontos» (`stop_notices`, #59): aquele é um sinal de procura do local; este é um pedido
com data, morada e ciclo de vida próprio. O cidadão escreve a morada (nunca GPS); o local usa a
morada institucional do sítio da conta. A morada vive só no pedido — nunca no perfil da conta — e é
retida 12 meses (`address_retained_until`), purgada à leitura depois do prazo.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from novelo.core.database import Base, TimestampMixin, UuidPkMixin, enum_check, enum_column
from novelo.domain.vocab import CollectionRequestState, RequestExceptionReason, RequestSubject


class CollectionRequest(Base, UuidPkMixin, TimestampMixin):
    """Um pedido de recolha: quem pede, quantos sacos, para que dia, onde (morada ou local institucional).

    Estados ativos: `scheduled` e `exception` — é neles que mora a regra «1 ativo por morada» (índice
    parcial único na chave normalizada). Os outros cinco terminam o pedido; nenhum estado volta atrás.
    """

    __tablename__ = "collection_requests"
    __table_args__ = (
        enum_check("subject_kind", RequestSubject),
        enum_check("state", CollectionRequestState),
        enum_check("exception_reason", RequestExceptionReason),
        CheckConstraint("bag_count > 0", name="bag_count_positive"),
        # 1 ativo por morada: a chave normalizada (cidadão) ou institucional (local), só nos ativos.
        Index(
            "uq_collection_requests_active_address",
            "address_key",
            unique=True,
            postgresql_where=text("state IN ('scheduled', 'exception') AND address_key IS NOT NULL"),
        ),
    )

    subject_kind: Mapped[RequestSubject] = mapped_column(enum_column(RequestSubject))
    # Quem pediu; nula só quando a conta é apagada (#66) — o pedido e os agregados sobrevivem à conta.
    requester_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    # Só no local/B2B: a morada institucional é o sítio da conta; o cidadão escreve a morada.
    locality_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("localities.id", ondelete="SET NULL"), index=True
    )
    # Cidadão: morada manual de primeira classe (nunca GPS) + a freguesia declarada, que liga à ronda.
    address: Mapped[str | None] = mapped_column(Text)
    address_key: Mapped[str | None] = mapped_column(Text, index=True)
    parish_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("parishes.id", ondelete="SET NULL"), index=True
    )
    bag_count: Mapped[int] = mapped_column(Integer)
    requested_date: Mapped[date] = mapped_column(Date)
    urgent: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    note: Mapped[str | None] = mapped_column(Text)
    state: Mapped[CollectionRequestState] = mapped_column(
        enum_column(CollectionRequestState), index=True
    )
    exception_reason: Mapped[RequestExceptionReason | None] = mapped_column(enum_column(RequestExceptionReason))
    # Ausências: a 3.ª expira o pedido (regra pura em `domain/collection_requests.py`).
    missed_count: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    # Despacho do gestor (fila de exceções): agendar ou recusar com motivo.
    dispatched_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dispatch_reason: Mapped[str | None] = mapped_column(Text)  # o motivo da recusa (ou nota do agendamento)
    # Fecho do ciclo de vida.
    collected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    expired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # RGPD: a morada retém-se 12 meses; a purga à leitura põe `address`/`address_key` a nulo.
    address_retained_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
