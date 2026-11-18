"""Rotas do catálogo e resgate (#65): o doador vê e resgata; a equipa gere e valida códigos.

Routers finos — as regras estão no serviço. O papel `donor` é o portão da área do doador (como no
resto de `/cidadao`); a gestão e a validação são de equipa (`admin`/`operator`). A validação é feita
pela equipa no MVP (o parceiro apresenta o código; o portal do parceiro com token próprio fica para
depois — decisão documentada no bilhete #65): zero dados do doador chegam ao parceiro de qualquer
forma — o código é tudo o que ele vê.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.core.deps import require_role
from novelo.core.ratelimit import redemptions_limiter
from novelo.core.request_meta import Meta
from novelo.features.catalog import service
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
    RedemptionCreate,
    RedemptionOut,
    RedemptionValidate,
)
from novelo.features.users.models import User

router = APIRouter()
Db = Annotated[AsyncSession, Depends(get_db)]

# O doador só toca no que é dele; a equipa gere o catálogo e valida códigos apresentados.
Donor = Annotated[User, Depends(require_role("donor"))]
Team = Annotated[User, Depends(require_role("admin", "operator"))]


# --- o doador: catálogo, campanhas e os meus códigos ------------------------------------------------


@router.get("/cidadao/catalog", response_model=list[CatalogItemPublic])
async def get_donor_catalog(db: Db) -> list[CatalogItemPublic]:
    """O catálogo do doador: ativos, com a âncora € APENAS como valor do donativo IPSS — nunca como
    valor dos pontos. Parceiro em pausa sai (o prémio não se pode cumprir)."""
    return await service.donor_catalog(db)


@router.get("/cidadao/campaigns", response_model=list[CampaignOut])
async def list_donor_campaigns(db: Db) -> list[CampaignOut]:
    """As campanhas de pontos na janela corrente (banner informativo; sem multiplicador no MVP)."""
    return await service.list_campaigns(db, only_active=True)


@router.get("/cidadao/redemptions", response_model=list[RedemptionOut])
async def list_donor_redemptions(user: Donor, db: Db) -> list[RedemptionOut]:
    """Os meus códigos de resgate, o mais recente primeiro: `RDM-…` e o estado (pendente/validado)."""
    return await service.list_own_redemptions(db, user.id)


@router.post(
    "/cidadao/redemptions",
    response_model=RedemptionOut,
    status_code=201,
    dependencies=[Depends(redemptions_limiter)],
)
async def create_redemption(body: RedemptionCreate, user: Donor, db: Db, meta: Meta) -> RedemptionOut:
    """Resgatar um item: saldo FIFO debitado (409 com a falta se não chegar), teto de donativos IPSS
    indexado ao custo evitado, e nasce o código pseudónimo — o parceiro nunca sabe quem trocou."""
    return await service.redeem(db, user, body.item_id, meta)


# --- a equipa: catálogo, parceiros, campanhas e validação --------------------------------------------


@router.get("/admin/catalog/items", response_model=list[CatalogItemOut])
async def list_admin_catalog_items(user: Team, db: Db) -> list[CatalogItemOut]:
    """O catálogo pela equipa: tudo (incl. inativos e parceiros em pausa), o mais recente primeiro."""
    return await service.admin_catalog(db)


@router.post("/admin/catalog/items", response_model=CatalogItemOut, status_code=201)
async def create_catalog_item(body: CatalogItemCreate, user: Team, db: Db) -> CatalogItemOut:
    """Criar item (donativo IPSS, prémio de parceiro ou acumulado ambiental): a forma é fechada —
    âncora € só no donativo, parceiro obrigatório no prémio (422 caso contrário)."""
    return await service.create_item(db, body)


@router.patch("/admin/catalog/items/{item_id}", response_model=CatalogItemOut)
async def update_catalog_item(item_id: uuid.UUID, body: CatalogItemUpdate, user: Team, db: Db) -> CatalogItemOut:
    """Editar item (nome, custo, âncora, ativo, stock…): a forma revalida-se sobre o resultado."""
    return await service.update_item(db, item_id, body)


@router.get("/admin/catalog/partners", response_model=list[PartnerOut])
async def list_catalog_partners(user: Team, db: Db) -> list[PartnerOut]:
    """O gestor de parcerias: propostas por aprovar, ativos e em pausa, o mais recente primeiro."""
    return await service.list_partners(db)


@router.post("/admin/catalog/partners", response_model=PartnerOut, status_code=201)
async def create_catalog_partner(body: PartnerCreate, user: Team, db: Db) -> PartnerOut:
    """Registar a proposta de um parceiro (a freguesia propõe, nasce `proposed`; a Vitrus aprova depois)."""
    return await service.create_partner(db, user, body)


@router.post("/admin/catalog/partners/{partner_id}/approve", response_model=PartnerOut)
async def approve_catalog_partner(partner_id: uuid.UUID, user: Team, db: Db) -> PartnerOut:
    """Aprovar a proposta: o parceiro fica ativo (prémios no catálogo, códigos aceites)."""
    return await service.approve_partner(db, user, partner_id)


@router.post("/admin/catalog/partners/{partner_id}/deactivate", response_model=PartnerOut)
async def deactivate_catalog_partner(partner_id: uuid.UUID, user: Team, db: Db) -> PartnerOut:
    """Pôr em pausa: os prémios saem do catálogo do doador e novos resgates são recusados (409)."""
    return await service.deactivate_partner(db, user, partner_id)


@router.patch("/admin/catalog/partners/{partner_id}", response_model=PartnerOut)
async def update_catalog_partner(partner_id: uuid.UUID, body: PartnerUpdate, user: Team, db: Db) -> PartnerOut:
    """Editar dados do parceiro (nome, descrição, contato da equipa); o estado vai pelos portões."""
    partner = await service.update_partner(db, partner_id, body)
    return PartnerOut.model_validate(partner)


@router.get("/admin/catalog/campaigns", response_model=list[CampaignOut])
async def list_admin_campaigns(user: Team, db: Db) -> list[CampaignOut]:
    """Todas as campanhas (passadas, correntes e futuras): a gestão agenda o calendário do impulso."""
    return await service.list_campaigns(db, only_active=False)


@router.post("/admin/catalog/campaigns", response_model=CampaignOut, status_code=201)
async def create_point_campaign(body: CampaignCreate, user: Team, db: Db) -> CampaignOut:
    """Criar campanha sazonal de pontos: janela temporal + descrição (informativa no MVP)."""
    return await service.create_campaign(db, body)


@router.patch("/admin/catalog/campaigns/{campaign_id}", response_model=CampaignOut)
async def update_point_campaign(campaign_id: uuid.UUID, body: CampaignUpdate, user: Team, db: Db) -> CampaignOut:
    """Editar campanha: nome, descrição e janela (o fim continua a ter de ser depois do início)."""
    return await service.update_campaign(db, campaign_id, body)


@router.post("/admin/redemptions/validate", response_model=RedemptionOut)
async def validate_redemption_code(body: RedemptionValidate, user: Team, db: Db, meta: Meta) -> RedemptionOut:
    """Validar o código apresentado pelo parceiro/IPSS: marca usado UMA vez (pagamento integral,
    auditado) e devolve o estado. Segunda apresentação é 409 `redemption_already_used`."""
    return await service.validate_code(db, user, body.code, meta)
