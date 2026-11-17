"""As rotas do cidadão: a conta de doador, os sacos ativados e a agenda pública.

Routers finos — as regras estão no serviço. O papel `donor` é o portão da área (como o `local` o é da
área do local): a web redireciona, a API recusa. A agenda pública («onde e quando entrego») não pede
sessão — é a promessa do serviço ao cidadão, incluindo a quem ainda não tem conta.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.core.deps import require_role
from novelo.core.ratelimit import agenda_limiter, donor_bags_limiter
from novelo.core.request_meta import Meta
from novelo.features.audit import service as audit
from novelo.features.cidadao import service
from novelo.features.cidadao.schemas import (
    BagActivationCreate,
    BagActivationOut,
    BagActivationUpdate,
    CollectionAgendaOut,
    CollectionHistoryOut,
    DonorAccountOut,
    DonorQrOut,
)
from novelo.features.users.models import User

router = APIRouter()
public_router = APIRouter()
Db = Annotated[AsyncSession, Depends(get_db)]

# A conta de doador só toca no que é dela: o papel é o portão e os sacos deduzem-se da conta.
Donor = Annotated[User, Depends(require_role("donor"))]


@router.get("/cidadao/account", response_model=DonorAccountOut)
async def get_donor_account(user: Donor, db: Db) -> DonorAccountOut:
    """A conta de doador de quem pede: o pseudónimo do QR de conta e a idade declarada."""
    return service.account_out(user)


@router.get("/cidadao/account/qr", response_model=DonorQrOut)
async def get_donor_account_qr(user: Donor, db: Db) -> DonorQrOut:
    """O QR de conta (segundo portador, ADR #35): entrega mão a mão, sem saco da plataforma.

    É um portador de CRÉDITO, nunca uma credencial de sessão — quem o apresenta atribui a entrega à
    própria conta; o scan só etiqueta o lote com o código pseudónimo. Perder o telemóvel não perde a
    conta; o QR pode voltar a abrir-se a qualquer momento.
    """
    code, svg = service.account_qr(user)
    return DonorQrOut(code=code, svg=svg)


# --- os meus sacos --------------------------------------------------------------------------------


@router.get("/cidadao/bags", response_model=list[BagActivationOut])
async def list_bag_activations(user: Donor, db: Db) -> list[BagActivationOut]:
    """Os sacos do próprio, o mais recente primeiro (apelido e declaração incluídos: são privados)."""
    return [service.bag_out(b) for b in await service.list_activations(db, user)]


@router.post(
    "/cidadao/bags", response_model=BagActivationOut, status_code=201, dependencies=[Depends(donor_bags_limiter)]
)
async def create_bag_activation(body: BagActivationCreate, user: Donor, db: Db, meta: Meta) -> BagActivationOut:
    """Ativa um saco da plataforma: nasce com código e QR próprios (`NVL-…`), apelido privado opcional
    e a declaração «Vai no saco?» opcional — a base do bónus de conformidade quando a triagem confirma."""
    bag = await service.create_activation(db, user, body)
    await audit.record(
        db, "bag.activate", actor_id=user.id, target_type="bag_activation", target_id=bag.id, meta=meta,
        details={"declaration": bag.declaration.value if bag.declaration else None},
    )  # fmt: skip
    return service.bag_out(bag)


@router.patch("/cidadao/bags/{bag_id}", response_model=BagActivationOut, dependencies=[Depends(donor_bags_limiter)])
async def update_bag_activation(bag_id: uuid.UUID, body: BagActivationUpdate, user: Donor, db: Db) -> BagActivationOut:
    """Corrige o apelido ou a declaração enquanto o saco está ativo; desativado congela (409)."""
    return service.bag_out(await service.update_activation(db, user, bag_id, body))


@router.post(
    "/cidadao/bags/{bag_id}/activate",
    response_model=BagActivationOut,
    dependencies=[Depends(donor_bags_limiter)],
)
async def activate_bag(bag_id: uuid.UUID, user: Donor, db: Db) -> BagActivationOut:
    """Reativa um saco desativado (o código é o mesmo: o QR impresso continua a valer)."""
    return service.bag_out(await service.set_activation_state(db, user, bag_id, active=True))


@router.post(
    "/cidadao/bags/{bag_id}/deactivate",
    response_model=BagActivationOut,
    dependencies=[Depends(donor_bags_limiter)],
)
async def deactivate_bag(bag_id: uuid.UUID, user: Donor, db: Db, meta: Meta) -> BagActivationOut:
    """Desativa um saco (saiu do sistema: rasgou-se, perdeu-se). Congela sem apagar — o histórico fica."""
    bag = await service.set_activation_state(db, user, bag_id, active=False)
    await audit.record(
        db, "bag.deactivate", actor_id=user.id, target_type="bag_activation", target_id=bag.id, meta=meta
    )
    return service.bag_out(bag)


@router.get("/cidadao/bags/{bag_id}/qr", response_model=DonorQrOut)
async def get_bag_qr(bag_id: uuid.UUID, user: Donor, db: Db) -> DonorQrOut:
    """O QR do saco ativado: imprime-se ou mostra-se à viatura; o payload é o próprio código `NVL-…`."""
    bag = await service.get_own_bag(db, user, bag_id)
    code, svg = service.bag_qr(bag)
    return DonorQrOut(code=code, svg=svg)


# --- histórico ------------------------------------------------------------------------------------


@router.get("/cidadao/history", response_model=list[CollectionHistoryOut])
async def get_collection_history(user: Donor, db: Db) -> list[CollectionHistoryOut]:
    """O histórico do doador: cada saco ligado ao lote que o levou, com link só para o passaporte
    público — o passaporte nunca mostra quem entregou (ADR #35)."""
    return await service.history(db, user)


# --- agenda pública «onde e quando entrego» (sem sessão) -------------------------------------------


@public_router.get("/collection-agenda", response_model=CollectionAgendaOut, dependencies=[Depends(agenda_limiter)])
async def get_public_collection_agenda(db: Db, response: Response) -> CollectionAgendaOut:
    """As rondas publicadas («onde e quando entrego»), do cenário completo mais recente com agenda.

    Público e sem sessão: é a promessa do serviço ao cidadão. `agenda` nulo = ainda não há agenda
    publicada — a página diz-o, nunca inventa dias. Agregado: nenhum dado de contas aqui. Cache curto
    no cliente: a agenda muda quando a equipa publica um cenário novo, não a cada minuto.
    """
    response.headers["Cache-Control"] = "public, max-age=60"
    return await service.public_agenda(db)
