"""As rotas do pedido de recolha: quem pede cria, vê os seus e anula; a equipa vê tudo, despacha e aponta.

Routers finos — as regras estão no serviço (`service.py`) e as puras em `domain/collection_requests.py`.
O sujeito deduz-se da conta: papel `local` pede com a morada institucional do sítio; todos os outros
são cidadão. A fila de despacho do gestor é a mesma para fora de ronda, urgências e recolha especial.
"""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.core.deps import get_current_user, require_role
from novelo.core.guest import NotGuestDep
from novelo.core.request_meta import Meta
from novelo.domain.vocab import CollectionRequestState, RequestSubject
from novelo.features.audit import service as audit
from novelo.features.collection_requests import service
from novelo.features.collection_requests.schemas import (
    CollectionRequestCreate,
    CollectionRequestListFilters,
    CollectionRequestOut,
    DispatchRequest,
    RequestOutcomeCreate,
)
from novelo.features.users.models import User

router = APIRouter()
Db = Annotated[AsyncSession, Depends(get_db)]

# Quem chama: qualquer conta aprovada (o hóspede não escreve — NotGuestDep nas escritas do próprio).
Caller = Annotated[User, Depends(get_current_user)]


# A equipa (gestão da Vitrus) vê tudo: a fila de exceções é `?state=exception`.
Team = Annotated[User, Depends(require_role("admin", "operator"))]


def _filters(
    state: CollectionRequestState | None = Query(default=None),
    subject_kind: RequestSubject | None = Query(default=None, alias="subject"),
    parish_code: str | None = Query(default=None, max_length=6),
    limit: int = Query(default=200, ge=1, le=1000),
) -> CollectionRequestListFilters:
    return CollectionRequestListFilters(state=state, subject_kind=subject_kind, parish_code=parish_code, limit=limit)


@router.post("/collection-requests", response_model=CollectionRequestOut, status_code=201, dependencies=[NotGuestDep])
async def create_collection_request(body: CollectionRequestCreate, user: Caller, db: Db, meta: Meta) -> CollectionRequestOut:
    """Pede uma recolha. Cidadão: morada manual + freguesia, 1–5 sacos, corte de 48 h, auto-aceite pelas
    regras — fora de ronda, fora do prazo, urgência ou mais de 20 sacos (local/B2B) caem na fila de
    exceções do gestor. Local/B2B: morada institucional do sítio da conta, teto de 20 (estimativa)."""
    request = await service.create_request(db, user, body)
    await audit.record(
        db,
        "collection_request.create",
        actor_id=user.id,
        target_type="collection_request",
        target_id=request.id,
        meta=meta,
        details={
            "subject_kind": request.subject_kind.value,
            "state": request.state.value,
            "exception_reason": request.exception_reason.value if request.exception_reason else None,
            "bag_count": request.bag_count,
        },
    )
    return await service.request_out(db, request)


@router.get("/collection-requests", response_model=list[CollectionRequestOut])
async def list_collection_requests(
    user: Caller, db: Db, filters: Annotated[CollectionRequestListFilters, Depends(_filters)]
) -> list[CollectionRequestOut]:
    """Os pedidos de recolha: quem pede vê os seus; a equipa vê todos com filtros (`state=exception`
    é a fila de despacho). Moradas fora dos 12 meses de retenção são purgadas à leitura."""
    return await service.list_requests(db, user, filters)


@router.delete("/collection-requests/{request_id}", status_code=204)
async def cancel_collection_request(request_id: uuid.UUID, user: Caller, db: Db, meta: Meta):
    """Anula um pedido ativo (agendado ou em exceção). Quem pediu anula o seu; a equipa pode anular qualquer um."""
    request = await service.cancel_request(db, user, request_id)
    await audit.record(
        db,
        "collection_request.cancel",
        actor_id=user.id,
        target_type="collection_request",
        target_id=request.id,
        meta=meta,
    )


@router.post("/collection-requests/{request_id}/dispatch", response_model=CollectionRequestOut)
async def dispatch_collection_request(
    request_id: uuid.UUID, body: DispatchRequest, user: Team, db: Db, meta: Meta
) -> CollectionRequestOut:
    """O gestor despacha uma exceção: agendar (com data, que pode sair da ronda pedida) ou recusar com motivo."""
    request = await service.dispatch_request(db, user, request_id, body)
    await audit.record(
        db,
        "collection_request.dispatch",
        actor_id=user.id,
        target_type="collection_request",
        target_id=request.id,
        meta=meta,
        details={"action": body.action.value, "reason": body.reason},
    )
    return await service.request_out(db, request, team_view=True)


@router.post("/collection-requests/{request_id}/outcome", response_model=CollectionRequestOut)
async def record_request_outcome(
    request_id: uuid.UUID, body: RequestOutcomeCreate, user: Team, db: Db, meta: Meta
) -> CollectionRequestOut:
    """Aponta o resultado da visita: recolhido fecha o pedido; a ausência soma — à 3.ª, o pedido expira."""
    request = await service.record_outcome(db, user, request_id, body)
    await audit.record(
        db,
        "collection_request.outcome",
        actor_id=user.id,
        target_type="collection_request",
        target_id=request.id,
        meta=meta,
        details={"outcome": body.outcome.value, "missed_count": request.missed_count},
    )
    return await service.request_out(db, request, team_view=True)
