"""O registo de consentimentos: LINHAS APPEND-ONLY, uma por decisão — a prova do art. 7.º/1 RGPD.

Nunca se edita nem se apaga um consentimento: dar e retirar criam linhas novas (a história É a prova —
quem, quando, que texto da política viu). `seq` é a sequência global que desempata o `created_at`
(igual dentro da transação): a ordem de escrita é determinística, como no livro de pontos. `user_id` é
SET NULL (ADR RGPD): apagar a conta deixa as linhas anónimas, que continuam a valer como prova
agregada sem identificar ninguém. O essencial da conta é contrato e não anda aqui: só as DUAS CAMADAS
de consentimento (marketing da Vitrus e ofertas de parceiros — nunca soft opt-in, DIRETRIZ 2022/1),
desligadas por defeito.
"""

import uuid

from sqlalchemy import BigInteger, Boolean, ForeignKey, Identity, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from novelo.core.database import Base, TimestampMixin, UuidPkMixin, enum_check, enum_column
from novelo.domain.privacy import ConsentPurpose


class DonorConsent(Base, UuidPkMixin, TimestampMixin):
    """Uma decisão de consentimento: finalidade, dado ou retirado, versão da política e origem.

    O estado corrente deduz-se da última linha por finalidade; o histórico completo fica no próprio.
    """

    __tablename__ = "donor_consents"
    __table_args__ = (
        enum_check("purpose", ConsentPurpose),
        Index("ix_donor_consents_user_purpose_created", "user_id", "purpose", "created_at"),
    )

    # Sequência GLOBAL monótona: ordem de escrita determinística (mesma razão no livro de pontos).
    seq: Mapped[int] = mapped_column(BigInteger, Identity(always=True), unique=True)

    # Anónima sobrevive à conta (SET NULL): a prova fica, a pessoa vai.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    purpose: Mapped[ConsentPurpose] = mapped_column(enum_column(ConsentPurpose))
    granted: Mapped[bool] = mapped_column(Boolean)
    # A versão do texto da política que a pessoa viu no momento da decisão (`policy.POLICY_VERSION`).
    policy_version: Mapped[str] = mapped_column(String(40))
    # De onde veio a decisão: `account` (toggles na carteira) ou `api`.
    source: Mapped[str] = mapped_column(String(20), default="account", server_default="account")


__all__ = ["DonorConsent"]
