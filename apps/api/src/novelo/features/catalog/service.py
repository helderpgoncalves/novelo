"""Regras do catálogo e do resgate (#65): sem FastAPI; os routers chamam daqui.

O resgate é uma TRANSAÇÃO com ordem fixa: bloqueio da conta (corridas) → item válido → saldo FIFO
suficiente → teto de donativos (só IPSS, indexado ao custo evitado) → stock atómico → linha negativa
no livro-razão → bilhete pseudónimo. O saldo é SEMPRE derivado (`domain.points.fifo_balance`) — nunca
há coluna em cache. A validação marca o código usado UMA vez (UPDATE condicional ao estado `pending`),
auditada: pagamento integral ao parceiro por código apresentado (ADR «resgate por código pseudónimo»).
"""

import uuid
from datetime import UTC, datetime

import sqlalchemy as sa
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.config import get_settings
from novelo.core.errors import (
    CampaignWindowError,
    CatalogItemInactiveError,
    CatalogItemShapeError,
    DonationCapReachedError,
    InsufficientPointsError,
    NotFoundError,
    OutOfStockError,
    RedemptionAlreadyUsedError,
)
from novelo.core.request_meta import RequestMeta
from novelo.domain.bags import new_redemption_code
from novelo.domain.catalog import CatalogItemKind, PartnerState, RedemptionState, donation_cap_cents
from novelo.domain.points import LedgerEntry, PointEntryKind, fifo_balance
from novelo.domain.vocab import LotUnitSource
from novelo.features.audit import service as audit
from novelo.features.catalog.models import CatalogItem, CatalogPartner, PointCampaign, Redemption
from novelo.features.catalog.schemas import (
    CampaignCreate,
    CampaignOut,
    CampaignUpdate,
    CatalogItemCreate,
    CatalogItemOut,
    CatalogItemPublic,
    CatalogItemUpdate,
    PartnerCreate,
    PartnerOut,
    PartnerUpdate,
    RedemptionOut,
)
from novelo.features.citizen.models import BagActivation
from novelo.features.lots.models import LotUnit
from novelo.features.points.models import PointEntry
from novelo.features.users.models import User


async def _advisory_lock(db: AsyncSession, key: str) -> None:
    """Bloqueio por conta até ao fim da transação: dois resgates em corrida passam um de cada vez
    (o saldo FIFO é lido-escrito aqui; sem o bloqueio, dois podiam passar a verificação juntos)."""
    await db.execute(select(func.pg_advisory_xact_lock(func.hashtextextended(key, 0))))


async def _measured_grams(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Quilos MEDIDOS na balança da viatura em sacos da conta (vida toda: o desvio já aconteceu).

    É a base do teto de donativos (custo evitado × toneladas): medido, nunca estimado — e por isso
    mesmo as etiquetas impressas (sem saco/conta) e os sacos sem peso não contam.
    """
    total = await db.scalar(
        select(func.coalesce(func.sum(LotUnit.weight_g), 0))
        .select_from(LotUnit)
        .join(BagActivation, BagActivation.code == LotUnit.code)
        .where(
            BagActivation.user_id == user_id,
            LotUnit.source == LotUnitSource.BAG,
            LotUnit.weight_g.is_not(None),
        )
    )
    return int(total or 0)


async def _donated_this_month_cents(db: AsyncSession, user_id: uuid.UUID, now: datetime) -> int:
    """Valor-euro de donativos IPSS JÁ empenhados no mês (pendentes incluem-se: empenho é despesa)."""
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    total = await db.scalar(
        select(func.coalesce(func.sum(Redemption.donation_value_cents), 0)).where(
            Redemption.user_id == user_id,
            Redemption.item_kind == CatalogItemKind.IPSS_DONATION,
            Redemption.created_at >= month_start,
        )
    )
    return int(total or 0)


async def _fifo_balance(db: AsyncSession, user_id: uuid.UUID, now: datetime) -> int:
    """O saldo derivado do livro-razão (ordem de escrita `seq` a desempatar o `created_at` igual)."""
    rows = (
        (
            await db.execute(
                select(PointEntry).where(PointEntry.user_id == user_id).order_by(PointEntry.created_at, PointEntry.seq)
            )
        )
        .scalars()
        .all()
    )
    entries = [
        LedgerEntry(kind=row.kind, amount=row.amount, created_at=row.created_at, expires_at=row.expires_at)
        for row in rows
    ]
    return fifo_balance(entries, now=now).balance


# --- resgate e validação ---------------------------------------------------------------------------


async def redeem(db: AsyncSession, user: User, item_id: uuid.UUID, meta: RequestMeta) -> RedemptionOut:
    """Resgatar um item: teto FIFO → teto de donativos → stock → livro-razão → bilhete `RDM-…`."""
    await _advisory_lock(db, f"redeem:{user.id}")
    now = datetime.now(UTC)
    item = await db.get(CatalogItem, item_id)
    if item is None:
        raise NotFoundError("Catalog item not found")
    if not item.active:
        raise CatalogItemInactiveError("Catalog item is inactive")
    if item.partner_id is not None:
        partner = await db.get(CatalogPartner, item.partner_id)
        if partner is not None and partner.state is not PartnerState.ACTIVE:
            # Parceiro em pausa: o prémio sai do alcance (o catálogo do doador já o esconde).
            raise CatalogItemInactiveError("Partner is not active")

    # 1. Saldo FIFO: o gasto come os ganhos mais antigos primeiro; nunca fica negativo.
    balance = await _fifo_balance(db, user.id, now)
    if balance < item.points_cost:
        raise InsufficientPointsError(balance=balance, shortfall=item.points_cost - balance)

    # 2. Teto de donativos IPSS: valor-euro do mês ≤ pct × custo evitado × toneladas MEDIDAS.
    if item.kind is CatalogItemKind.IPSS_DONATION and item.donation_value_cents is not None:
        cap = donation_cap_cents(await _measured_grams(db, user.id), cap_pct=get_settings().points_donation_cap_pct)
        donated = await _donated_this_month_cents(db, user.id, now)
        if donated + item.donation_value_cents > cap:
            raise DonationCapReachedError(
                cap_cents=cap, donated_this_month_cents=donated, item_value_cents=item.donation_value_cents
            )

    # 3. Stock finito: decremento CONDICIONAL (stock > 0) — duas corridas nunca vendem o mesmo.
    if item.stock is not None:
        result = await db.execute(
            update(CatalogItem)
            .where(CatalogItem.id == item.id, CatalogItem.stock > 0)
            .values(stock=CatalogItem.stock - 1)
        )
        if int(getattr(result, "rowcount", 0) or 0) == 0:
            raise OutOfStockError("Catalog item is out of stock")

    # 4. Livro-razão: a linha NEGATIVA `redemption` (append-only, sem expiração — consome).
    partner_name: str | None = None
    if item.partner_id is not None:
        partner = await db.get(CatalogPartner, item.partner_id)
        partner_name = partner.name if partner else None
    db.add(
        PointEntry(
            user_id=user.id,
            kind=PointEntryKind.REDEMPTION,
            amount=-item.points_cost,
        )
    )

    # 5. O bilhete pseudónimo: o parceiro vê o código, nunca o doador (zero partilha por defeito).
    redemption = Redemption(
        user_id=user.id,
        item_id=item.id,
        item_name=item.name,
        item_kind=item.kind,
        partner_id=item.partner_id,
        partner_name=partner_name,
        code=new_redemption_code(),
        points_spent=item.points_cost,
        donation_value_cents=item.donation_value_cents,
        state=RedemptionState.PENDING,
    )
    db.add(redemption)
    await audit.record(
        db,
        "catalog.redeem",
        actor_id=user.id,
        target_type="redemption",
        target_id=redemption.id,
        meta=meta,
        details={"item": item.name, "code": redemption.code, "points": -item.points_cost},
    )
    await db.commit()
    await db.refresh(redemption)
    return RedemptionOut.model_validate(redemption)


async def validate_code(db: AsyncSession, team_user: User, raw_code: str, meta: RequestMeta) -> RedemptionOut:
    """Validar um código apresentado: marca usado UMA vez (pagamento integral) e fica auditado.

    A leitura é tolerante: o parceiro pode trazer o código em minúsculas ou com espaços — normaliza-se
    antes de procurar. A segunda apresentação é recusada (409 `redemption_already_used`), também em
    corrida (UPDATE condicional ao estado `pending`).
    """
    code = raw_code.strip().upper()
    redemption = (await db.execute(select(Redemption).where(Redemption.code == code))).scalar_one_or_none()
    if redemption is None:
        raise NotFoundError("Redemption code not found")
    result = await db.execute(
        update(Redemption)
        .where(Redemption.id == redemption.id, Redemption.state == RedemptionState.PENDING)
        .values(state=RedemptionState.VALIDATED, validated_at=datetime.now(UTC), validated_by_id=team_user.id)
    )
    if int(getattr(result, "rowcount", 0) or 0) == 0:
        raise RedemptionAlreadyUsedError("Redemption code was already validated")
    await audit.record(
        db,
        "catalog.validate",
        actor_id=team_user.id,
        target_type="redemption",
        target_id=redemption.id,
        meta=meta,
        details={
            "code": redemption.code,
            "partner": redemption.partner_name,
            "value_cents": redemption.donation_value_cents,
        },
    )
    await db.commit()
    await db.refresh(redemption)
    return RedemptionOut.model_validate(redemption)


async def list_own_redemptions(db: AsyncSession, user_id: uuid.UUID) -> list[RedemptionOut]:
    """Os códigos do próprio, o mais recente primeiro (pendentes primeiro na vida real, mas a ordem
    cronológica recente é a que o doador espera)."""
    rows = (
        (
            await db.execute(
                select(Redemption).where(Redemption.user_id == user_id).order_by(Redemption.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [RedemptionOut.model_validate(row) for row in rows]


# --- leitura do catálogo ---------------------------------------------------------------------------


async def donor_catalog(db: AsyncSession) -> list[CatalogItemPublic]:
    """O catálogo do doador: itens ativos e, nos prémios, só de parceiro ATIVO (parceiro em pausa sai)."""
    rows = (
        await db.execute(
            select(CatalogItem, CatalogPartner.name)
            .join(CatalogPartner, CatalogPartner.id == CatalogItem.partner_id, isouter=True)
            .where(
                CatalogItem.active.is_(True),
                sa.or_(CatalogItem.partner_id.is_(None), CatalogPartner.state == PartnerState.ACTIVE),
            )
            .order_by(CatalogItem.points_cost, CatalogItem.created_at)
        )
    ).all()
    result = []
    for item, partner_name in rows:
        public = CatalogItemPublic(
            id=item.id,
            name=item.name,
            kind=item.kind,
            points_cost=item.points_cost,
            donation_value_cents=item.donation_value_cents,
            partner_name=partner_name,
            description=item.description,
            stock=item.stock,
        )
        result.append(public)
    return result


async def admin_catalog(db: AsyncSession) -> list[CatalogItemOut]:
    """O catálogo pela equipa: tudo, incl. inativos e parceiros em pausa (para gerir, não para vender)."""
    rows = (
        await db.execute(
            select(CatalogItem, CatalogPartner.name)
            .join(CatalogPartner, CatalogPartner.id == CatalogItem.partner_id, isouter=True)
            .order_by(CatalogItem.created_at.desc())
        )
    ).all()
    return [
        CatalogItemOut(
            id=item.id,
            name=item.name,
            kind=item.kind,
            points_cost=item.points_cost,
            donation_value_cents=item.donation_value_cents,
            active=item.active,
            partner_id=item.partner_id,
            partner_name=partner_name,
            description=item.description,
            stock=item.stock,
            created_at=item.created_at,
        )
        for item, partner_name in rows
    ]


async def _partner_name(db: AsyncSession, partner_id: uuid.UUID | None) -> str | None:
    if partner_id is None:
        return None
    partner = await db.get(CatalogPartner, partner_id)
    return partner.name if partner else None


def _item_out(item: CatalogItem, partner_name: str | None) -> CatalogItemOut:
    return CatalogItemOut(
        id=item.id,
        name=item.name,
        kind=item.kind,
        points_cost=item.points_cost,
        donation_value_cents=item.donation_value_cents,
        active=item.active,
        partner_id=item.partner_id,
        partner_name=partner_name,
        description=item.description,
        stock=item.stock,
        created_at=item.created_at,
    )


def _validate_shape(kind: CatalogItemKind, partner_id: uuid.UUID | None, donation_value_cents: int | None) -> None:
    # A forma do item no PATCH: mesma regra do `model_validator` de criação (aí sai como
    # `validation_error` com campos, por ser parsing do pedido); aqui sai 422 `catalog_item_shape`.
    bad: list[str] = []
    if (kind is CatalogItemKind.IPSS_DONATION) != (donation_value_cents is not None):
        bad.append("donation_value_cents")
    if (kind is CatalogItemKind.PARTNER_PRIZE) != (partner_id is not None):
        bad.append("partner_id")
    if bad:
        raise CatalogItemShapeError(fields=bad)


# --- gestão: itens ---------------------------------------------------------------------------------


async def create_item(db: AsyncSession, body: CatalogItemCreate) -> CatalogItemOut:
    """Criar item (equipa). O parceiro de um prémio tem de existir."""
    if body.partner_id is not None:
        partner = await db.get(CatalogPartner, body.partner_id)
        if partner is None:
            raise NotFoundError("Partner not found")
    item = CatalogItem(
        name=body.name,
        kind=body.kind,
        points_cost=body.points_cost,
        donation_value_cents=body.donation_value_cents,
        active=body.active,
        partner_id=body.partner_id,
        description=body.description,
        stock=body.stock,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _item_out(item, await _partner_name(db, item.partner_id))


async def update_item(db: AsyncSession, item_id: uuid.UUID, body: CatalogItemUpdate) -> CatalogItemOut:
    """Editar item: campos parciais sobre o estado atual; a forma revalida-se no resultado (422)."""
    item = await db.get(CatalogItem, item_id)
    if item is None:
        raise NotFoundError("Catalog item not found")
    changes = body.model_dump(exclude_unset=True)
    if changes.get("partner_id") is not None:
        partner = await db.get(CatalogPartner, changes["partner_id"])
        if partner is None:
            raise NotFoundError("Partner not found")
    for field, value in changes.items():
        setattr(item, field, value)
    _validate_shape(item.kind, item.partner_id, item.donation_value_cents)
    await db.commit()
    await db.refresh(item)
    return _item_out(item, await _partner_name(db, item.partner_id))


# --- gestão: parceiros (freguesias propõem, Vitrus aprova) ------------------------------------------


async def create_partner(db: AsyncSession, team_user: User, body: PartnerCreate) -> PartnerOut:
    """Registar a proposta de um parceiro (nasce `proposed`): quem propôs fica na trilha."""
    partner = CatalogPartner(
        name=body.name,
        state=PartnerState.PROPOSED,
        parish_id=body.parish_id,
        proposed_by_id=team_user.id,
        description=body.description,
        contact=body.contact,
    )
    db.add(partner)
    await audit.record(
        db, "catalog.partner.propose", actor_id=team_user.id, target_type="catalog_partner", target_id=partner.id
    )
    await db.commit()
    await db.refresh(partner)
    return PartnerOut.model_validate(partner)


async def _set_partner_state(
    db: AsyncSession, team_user: User, partner_id: uuid.UUID, state: PartnerState, action: str
) -> PartnerOut:
    """Transição de estado do parceiro, auditada (aprovação e pausa são decisões públicas)."""
    partner = await db.get(CatalogPartner, partner_id)
    if partner is None:
        raise NotFoundError("Partner not found")
    partner.state = state
    await audit.record(db, action, actor_id=team_user.id, target_type="catalog_partner", target_id=partner.id)
    await db.commit()
    await db.refresh(partner)
    return PartnerOut.model_validate(partner)


async def approve_partner(db: AsyncSession, team_user: User, partner_id: uuid.UUID) -> PartnerOut:
    """A Vitrus aprova a proposta: o parceiro pode ter prémios no catálogo e receber códigos."""
    return await _set_partner_state(db, team_user, partner_id, PartnerState.ACTIVE, "catalog.partner.approve")


async def deactivate_partner(db: AsyncSession, team_user: User, partner_id: uuid.UUID) -> PartnerOut:
    """Pausa ou saída: os prémios saem do catálogo do doador e novos resgates são recusados."""
    return await _set_partner_state(db, team_user, partner_id, PartnerState.INACTIVE, "catalog.partner.deactivate")


async def list_partners(db: AsyncSession) -> list[PartnerOut]:
    """Todos os parceiros (equipa): a fila de propostas por aprovar inclui-se — é o gestor de parcerias."""
    rows = (await db.execute(select(CatalogPartner).order_by(CatalogPartner.created_at.desc()))).scalars().all()
    return [PartnerOut.model_validate(row) for row in rows]


async def update_partner(db: AsyncSession, partner_id: uuid.UUID, body: PartnerUpdate) -> PartnerOut:
    """Editar dados do parceiro (nome, freguesia proponente, descrição, contato da equipa)."""
    partner = await db.get(CatalogPartner, partner_id)
    if partner is None:
        raise NotFoundError("Partner not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(partner, field, value)
    await db.commit()
    await db.refresh(partner)
    return PartnerOut.model_validate(partner)


# --- gestão: campanhas sazonais ---------------------------------------------------------------------


async def create_campaign(db: AsyncSession, body: CampaignCreate) -> CampaignOut:
    """Criar campanha: janela válida (fim depois do início — o parsing já recusa 422; defesa aqui)."""
    if body.ends_at <= body.starts_at:
        raise CampaignWindowError()
    campaign = PointCampaign(
        name=body.name, description=body.description, starts_at=body.starts_at, ends_at=body.ends_at
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return CampaignOut.model_validate(campaign)


async def update_campaign(db: AsyncSession, campaign_id: uuid.UUID, body: CampaignUpdate) -> CampaignOut:
    """Editar campanha: a janela resultante continua a ter de fazer sentido temporal (422)."""
    campaign = await db.get(PointCampaign, campaign_id)
    if campaign is None:
        raise NotFoundError("Campaign not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(campaign, field, value)
    if campaign.ends_at <= campaign.starts_at:
        raise CampaignWindowError()
    await db.commit()
    await db.refresh(campaign)
    return CampaignOut.model_validate(campaign)


async def list_campaigns(db: AsyncSession, *, only_active: bool) -> list[CampaignOut]:
    """Campanhas: a equipa vê tudo; o doador só as da janela corrente (banner «Campanha ativa»)."""
    now = datetime.now(UTC)
    stmt = select(PointCampaign).order_by(PointCampaign.starts_at.desc())
    if only_active:
        stmt = stmt.where(PointCampaign.starts_at <= now, PointCampaign.ends_at > now)
    rows = (await db.execute(stmt)).scalars().all()
    return [CampaignOut.model_validate(row) for row in rows]


__all__ = [
    "admin_catalog",
    "approve_partner",
    "create_campaign",
    "create_item",
    "create_partner",
    "deactivate_partner",
    "donor_catalog",
    "list_campaigns",
    "list_own_redemptions",
    "list_partners",
    "redeem",
    "update_campaign",
    "update_item",
    "update_partner",
    "validate_code",
]
