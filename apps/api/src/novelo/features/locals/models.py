"""A conta de local e o aviso «sacos prontos»: o local vê o que entregou e diz «estou pronto».

`LocalAccount` — a conta pertence ao local (assistido — escolas no MVP — ou produtor B2B), nunca à pessoa;
nasce de um convite da equipa com papel `local`, sem auto-registo. A natureza do sítio (`kind`) decide a
home de `/local`. O certificado público é **opt-in**: só existe página pública quem o ligar.

`StopNotice` — o aviso «sacos prontos»: a única escrita do local no MVP. Garante paragem nesse dia
(ADR: política de paragem) — é o sinal de procura que o otimizador (#61) consome. Um só aviso ativo por
local (índice parcial único); anular não apaga, e avisar outra vez cria uma linha nova (histórico fica).
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from novelo.core.database import Base, TimestampMixin, UuidPkMixin, enum_check, enum_column
from novelo.domain.vocab import LocalKind, NoticeState


class LocalAccount(Base, UuidPkMixin, TimestampMixin):
    """A conta de local: um utilizador (papel `local`) ligado a um local da rede da Vitrus.

    Um utilizador tem uma conta de local (`user_id` único). Várias pessoas do mesmo local podem ter
    contas próprias para o mesmo sítio (MVP: uma por local — é a equipa que convida). O certificado é
    opt-in por conta: quem liga assina (`certificate_opt_in_by_id`) e pode desligar outra vez.
    """

    __tablename__ = "local_accounts"
    __table_args__ = (enum_check("kind", LocalKind),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    locality_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("localities.id", ondelete="SET NULL"), index=True
    )
    kind: Mapped[LocalKind] = mapped_column(enum_column(LocalKind))
    certificate_opt_in: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    certificate_opt_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    certificate_opt_in_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )


class StopNotice(Base, UuidPkMixin, TimestampMixin):
    """O aviso «sacos prontos»: «estou pronto, vem cá». Uma linha por aviso; o ativo garante a paragem.

    `bag_count` é o que o local declara (o protótipo pede «quantos sacos») — sinal de procura para o
    otimizador, nunca uma contabilidade: o peso verdadeiro mede-se na balança da viatura. `note` é o
    recado para a equipa (ex.: «sala 12, porta dos fundos»).
    """

    __tablename__ = "stop_notices"
    __table_args__ = (
        enum_check("state", NoticeState),
        CheckConstraint("bag_count IS NULL OR bag_count > 0", name="bag_count_positive"),
        # Um só aviso ativo por local: os anulados ficam de fora (índice parcial).
        Index(
            "uq_stop_notices_active_locality",
            "locality_id",
            unique=True,
            postgresql_where=text("state = 'active'"),
        ),
    )

    locality_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("localities.id", ondelete="SET NULL"), index=True
    )
    state: Mapped[NoticeState] = mapped_column(
        enum_column(NoticeState), default=NoticeState.ACTIVE, server_default=NoticeState.ACTIVE.value
    )
    bag_count: Mapped[int | None] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(Text)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
