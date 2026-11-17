"""Modelos do catálogo e resgate (#65): parceiros, itens, campanhas e códigos de resgate.

Economia (ADR «economia dos pontos»): os PRÉMIOS são cedidos e pagos por parceiros locais; os
DONATIVOS a IPSS são pagos pela Vitrus com teto indexado ao custo evitado (`domain.catalog.
donation_cap_cents`) — a âncora 1 000 pontos ≈ 5 € é apresentação do valor do donativo, nunca câmbio.
Os CHECKs da tabela `catalog_items` fecham as regras de forma: âncora € só em donativo IPSS, parceiro
obrigatório em prémio de parceiro. O resgate vive no livro-razão (`points_entries`, linha negativa
`redemption`) e o código é o ÚNICO que o parceiro vê (ADR «resgate por código pseudónimo»).
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from novelo.core.database import Base, TimestampMixin, UuidPkMixin, enum_check, enum_column
from novelo.domain.catalog import CatalogItemKind, PartnerState, RedemptionState


class CatalogPartner(Base, UuidPkMixin, TimestampMixin):
    """Um parceiro local: a freguesia PROPÕE, a Vitrus APROVA (proposed → active) e pode pôr em pausa.

    Nunca se apaga (os códigos validados ficam com o pagamento por apresentação auditável); «inactive»
    tira os prémios do catálogo e bloqueia novos resgates. O contato é da equipa — nunca sai para o
    doador (zero partilha de dados, nos dois sentidos).
    """

    __tablename__ = "catalog_partners"
    __table_args__ = (enum_check("state", PartnerState),)

    name: Mapped[str] = mapped_column(String(120), unique=True)
    state: Mapped[PartnerState] = mapped_column(
        enum_column(PartnerState), default=PartnerState.PROPOSED, server_default=PartnerState.PROPOSED.value
    )
    # A freguesia proponente (gestor de parcerias: «freguesias propõem»); nulo se a proposta veio da equipa.
    parish_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("parishes.id", ondelete="SET NULL")
    )
    proposed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    description: Mapped[str | None] = mapped_column(Text)
    contact: Mapped[str | None] = mapped_column(String(200))


class CatalogItem(Base, UuidPkMixin, TimestampMixin):
    """Um item do catálogo: donativo IPSS, prémio de parceiro ou acumulado ambiental (não monetário).

    `points_cost > 0`; `donation_value_cents` existe SÓ no donativo IPSS (CHECK de forma) e é a âncora
    € APRESENTADA ao doador — o valor do donativo, nunca o valor dos pontos. `stock` nulo = sem limite;
    definido, decrementa em cada resgate e 0 esgota.
    """

    __tablename__ = "catalog_items"
    __table_args__ = (
        enum_check("kind", CatalogItemKind),
        CheckConstraint("points_cost > 0", name="cost_positive"),
        CheckConstraint("stock IS NULL OR stock >= 0", name="stock_nonnegative"),
        # Forma do catálogo: âncora € só no donativo IPSS (o acumulado ambiental e o prémio não têm €).
        CheckConstraint(
            "(kind = 'ipss_donation') = (donation_value_cents IS NOT NULL)", name="donation_value_only_ipss"
        ),
        # Prémio de parceiro TEM de ter parceiro; as outras prateleiras não têm.
        CheckConstraint("(kind = 'partner_prize') = (partner_id IS NOT NULL)", name="partner_only_prizes"),
        Index("ix_catalog_items_active", "active"),
    )

    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[CatalogItemKind] = mapped_column(enum_column(CatalogItemKind))
    points_cost: Mapped[int] = mapped_column(Integer)
    donation_value_cents: Mapped[int | None] = mapped_column(Integer)  # apresentação: 1 000 pts ≈ 5 €
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    partner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalog_partners.id", ondelete="SET NULL"), index=True
    )
    description: Mapped[str | None] = mapped_column(Text)
    stock: Mapped[int | None] = mapped_column(Integer)  # nulo = sem limite; 0 = esgotado


class PointCampaign(Base, UuidPkMixin, TimestampMixin):
    """Uma campanha sazonal de pontos da Vitrus: janela temporal + descrição mostrada no web.

    No MVP a campanha é INFORMATIVA (impulso comunicado ao doador); multiplicadores automáticos de
    ganho ficam para depois — decisão documentada em «docs/engenharia/features.md» (#65).
    """

    __tablename__ = "point_campaigns"
    __table_args__ = (CheckConstraint("ends_at > starts_at", name="window_valid"),)

    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Redemption(Base, UuidPkMixin, TimestampMixin):
    """Um resgate: o livro-razão debita (linha `redemption`), aqui fica o BILHETE pseudónimo.

    Snapshots (item, parceiro, valor-€) para o bilhete e o pagamento por apresentação sobreviverem a
    renomeações e desativações. O código `RDM-XXXXXX` é único no mundo e é a ÚNICA coisa que o
    parceiro vê; a validação marca usado UMA vez (UPDATE condicional ao estado `pending`). A ligação
    ao lançamento do livro-razão é por conta + momento (`user_id`, `created_at`): o razão é imutável.
    """

    __tablename__ = "redemptions"
    __table_args__ = (
        enum_check("state", RedemptionState),
        enum_check("item_kind", CatalogItemKind),
        CheckConstraint("points_spent > 0", name="spent_positive"),
        Index("ix_redemptions_user_created", "user_id", "created_at"),
        Index("ix_redemptions_partner_state", "partner_id", "state"),
    )

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalog_items.id", ondelete="SET NULL")
    )
    item_name: Mapped[str] = mapped_column(String(120))
    item_kind: Mapped[CatalogItemKind] = mapped_column(enum_column(CatalogItemKind))
    partner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalog_partners.id", ondelete="SET NULL")
    )
    partner_name: Mapped[str | None] = mapped_column(String(120))
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    points_spent: Mapped[int] = mapped_column(Integer)
    donation_value_cents: Mapped[int | None] = mapped_column(Integer)
    state: Mapped[RedemptionState] = mapped_column(
        enum_column(RedemptionState), default=RedemptionState.PENDING, server_default=RedemptionState.PENDING.value
    )
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    validated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )


__all__ = ["CatalogItem", "CatalogPartner", "PointCampaign", "Redemption"]
