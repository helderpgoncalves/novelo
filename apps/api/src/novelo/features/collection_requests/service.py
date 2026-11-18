"""Regras do pedido de recolha no serviço: sujeito pela conta, auto-aceite, fila de exceções, ciclo de vida.

Sem FastAPI: os routers chamam daqui e os erros saem como `AppError`. O sujeito (cidadão ou local/B2B)
deduz-se SEMPRE da conta de quem pede — nunca de um parâmetro do corpo. As regras puras (limites,
corte de 48 h, ausências, retenção) vivem em `domain/collection_requests.py` e são testadas à mão;
aqui fica só a costura com a base de dados (ronda na freguesia, 1 ativo por morada, purga à leitura).
"""

import uuid
from datetime import UTC, datetime
from datetime import date as dt_date
from typing import NamedTuple

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.errors import (
    AddressRequestActiveError,
    CitizenAddressRequiredError,
    CitizenBagsLimitError,
    CitizenParishRequiredError,
    ForbiddenError,
    LocalAccountMissingError,
    LocalAddressForbiddenError,
    NotFoundError,
    RequestCancelNotAllowedError,
    RequestNotDispatchableError,
    RequestNotScheduledError,
)
from novelo.domain.collection_requests import (
    address_retained_until,
    apply_outcome,
    bags_out_of_range,
    decide,
    locality_address_key,
    normalize_address,
)
from novelo.domain.vocab import (
    CollectionRequestState,
    DispatchAction,
    RequestSubject,
)
from novelo.features.collection_requests.models import CollectionRequest
from novelo.features.collection_requests.schemas import (
    CollectionRequestCreate,
    CollectionRequestListFilters,
    CollectionRequestOut,
    DispatchRequest,
    RequestOutcomeCreate,
)
from novelo.features.locals.models import LocalAccount
from novelo.features.network.models import CircuitDay, CircuitLocality, Locality, Parish
from novelo.features.users.models import User

ACTIVE_STATES = (CollectionRequestState.SCHEDULED, CollectionRequestState.EXCEPTION)
TERMINAL_STATES = (
    CollectionRequestState.REJECTED,
    CollectionRequestState.COLLECTED,
    CollectionRequestState.EXPIRED,
    CollectionRequestState.CANCELLED,
)


def subject_of(user: User) -> RequestSubject:
    """O sujeito vem do papel: `local` pede como local (assistido/B2B); todos os outros, como cidadão."""
    return RequestSubject.LOCAL if user.role == "local" else RequestSubject.CITIZEN


async def _parish_by_code(db: AsyncSession, dicofre: str) -> Parish:
    parish: Parish | None = (await db.execute(select(Parish).where(Parish.dicofre == dicofre))).scalar_one_or_none()
    if parish is None:
        raise NotFoundError(f"Unknown parish code {dicofre}")
    return parish


async def _in_round(
    db: AsyncSession,
    *,
    parish_id: uuid.UUID | None = None,
    locality_id: uuid.UUID | None = None,
    requested_date: dt_date,
) -> bool:
    """Há ronda nesse dia para a freguesia (ou o local)? Proxy do MVP: os dias dos circuitos da Vitrus.

    Não é o calendário da viatura de têxtil (que o otimizador do #61 vai escolher) — é o ritmo das
    rondas existentes na rede da Vitrus, usado como estimativa; o gestor despacha o resto.
    """
    query = (
        select(CircuitDay.circuit_id)
        .join(CircuitLocality, CircuitLocality.circuit_id == CircuitDay.circuit_id)
        .join(Locality, Locality.id == CircuitLocality.locality_id)
        .where(CircuitDay.weekday == requested_date.isoweekday())  # 1 = segunda … 7 = domingo
        .limit(1)
    )
    if locality_id is not None:
        query = query.where(Locality.id == locality_id)
    elif parish_id is not None:
        query = query.where(Locality.parish_id == parish_id)
    else:
        return False
    return (await db.execute(query)).scalar_one_or_none() is not None


async def _active_at_address(db: AsyncSession, address_key: str) -> CollectionRequest | None:
    return (
        await db.execute(
            select(CollectionRequest)
            .where(
                CollectionRequest.address_key == address_key,
                CollectionRequest.state.in_(ACTIVE_STATES),
            )
            .limit(1)
        )
    ).scalar_one_or_none()


async def create_request(db: AsyncSession, user: User, body: CollectionRequestCreate) -> CollectionRequest:
    """Cria o pedido e decide logo: auto-aceite (agendado) ou exceção para o gestor despachar.

    Levanta 409 `address_request_active` se já houver pedido ativo na mesma morada (cidadão) ou no
    mesmo local (B2B) — regra «1 ativo por morada», reforçada por índice parcial único.
    """
    subject = subject_of(user)
    locality_id: uuid.UUID | None = None
    parish: Parish | None = None
    address_key: str | None = None
    address_text: str | None = None

    if subject is RequestSubject.LOCAL:
        if body.address is not None or body.parish_code is not None:
            raise LocalAddressForbiddenError("Local/B2B requests carry no address: it is the institutional one")
        if body.ephemeral_address:
            raise LocalAddressForbiddenError("Ephemeral addresses exist only on dated citizen requests")
        account = (await db.execute(select(LocalAccount).where(LocalAccount.user_id == user.id))).scalar_one_or_none()
        if account is None or account.locality_id is None:
            raise LocalAccountMissingError("This account has no locality binding")
        locality_id = account.locality_id
        address_key = locality_address_key(locality_id)
    else:
        if not body.address or not body.address.strip():
            raise CitizenAddressRequiredError("Citizen requests need a manual address (GPS is out of the MVP)")
        if not body.parish_code:
            raise CitizenParishRequiredError("Citizen requests need the parish to link to the round")
        address_text = body.address.strip()
        address_key = normalize_address(address_text)
        parish = await _parish_by_code(db, body.parish_code)
        if bags_out_of_range(RequestSubject.CITIZEN, body.bag_count):
            raise CitizenBagsLimitError("Citizen requests carry 1 to 5 bags")

    if await _active_at_address(db, address_key) is not None:
        raise AddressRequestActiveError("There is already an active request at this address")

    in_round = await _in_round(
        db,
        parish_id=parish.id if parish else None,
        locality_id=locality_id,
        requested_date=body.requested_date,
    )
    decision = decide(
        subject=subject,
        bag_count=body.bag_count,
        requested_date=body.requested_date,
        today=datetime.now(UTC).date(),
        urgent=body.urgent,
        in_round=in_round,
    )
    request = CollectionRequest(
        subject_kind=subject,
        requester_id=user.id,
        locality_id=locality_id,
        address=address_text,
        address_key=address_key,
        # Morada efémera (só cidadão): sem retenção de 12 meses — apaga-se ao fechar o pedido.
        ephemeral_address=bool(body.ephemeral_address and address_text),
        parish_id=parish.id if parish else None,
        bag_count=body.bag_count,
        requested_date=body.requested_date,
        urgent=body.urgent,
        note=body.note,
        state=decision.state,
        exception_reason=decision.exception_reason,
        address_retained_until=(
            address_retained_until(datetime.now(UTC)) if address_text and not body.ephemeral_address else None
        ),
    )
    db.add(request)
    try:
        await db.commit()
    except IntegrityError as exc:  # a corrida entre dois pedidos da mesma morada cai no índice parcial
        raise AddressRequestActiveError("There is already an active request at this address") from exc
    return request


async def purge_expired_addresses(db: AsyncSession) -> int:
    """A purga à leitura: moradas fora do prazo de 12 meses passam a `null` (o pedido fica, para história).

    Chamada nas listagens. Os agregados (#62) nunca dependem da morada, e «1 ativo por morada» só
    olha aos pedidos ativos — perder a chave nos terminais não muda nenhuma regra.
    """
    result = await db.execute(
        update(CollectionRequest)
        .where(
            CollectionRequest.address.is_not(None),
            CollectionRequest.address_retained_until.is_not(None),
            CollectionRequest.address_retained_until < datetime.now(UTC),
        )
        .values(address=None, address_key=None)
    )
    await db.commit()
    return int(getattr(result, "rowcount", 0) or 0)


def _purge_ephemeral_address(request: CollectionRequest) -> None:
    """Morada efémera (só cidadão): ao CHEGAR ao estado terminal a morada apaga-se na hora —
    minimização RGPD sem os 12 meses de retenção do caminho normal. A morada efémera nunca tem
    `address_retained_until`, por isso a purga de leitura não a tocaria: esta é a única purga dela."""
    if request.ephemeral_address:
        request.address = None
        request.address_key = None


class _Names(NamedTuple):
    """Os nomes para a leitura: freguesia (dicofre + nome) e local, buscados em lote."""

    parishes: dict[uuid.UUID, Parish]
    localities: dict[uuid.UUID, Locality]


async def _names(db: AsyncSession, requests: list[CollectionRequest]) -> _Names:
    parish_ids = {r.parish_id for r in requests if r.parish_id is not None}
    locality_ids = {r.locality_id for r in requests if r.locality_id is not None}
    parishes: dict[uuid.UUID, Parish] = {}
    if parish_ids:
        found_parishes = await db.execute(select(Parish).where(Parish.id.in_(parish_ids)))
        parishes = {p.id: p for p in found_parishes.scalars()}
    localities: dict[uuid.UUID, Locality] = {}
    if locality_ids:
        found_localities = await db.execute(select(Locality).where(Locality.id.in_(locality_ids)))
        localities = {item.id: item for item in found_localities.scalars()}
    return _Names(parishes=parishes, localities=localities)


async def _requester_emails(db: AsyncSession, requests: list[CollectionRequest]) -> dict[uuid.UUID, str]:
    ids = {r.requester_id for r in requests if r.requester_id is not None}
    if not ids:
        return {}
    rows = await db.execute(select(User).where(User.id.in_(ids)))
    return {u.id: u.email for u in rows.scalars()}


async def request_out(db: AsyncSession, request: CollectionRequest, *, team_view: bool = False) -> CollectionRequestOut:
    """A leitura de um pedido. A equipa vê ainda quem pediu; quem pediu nunca vê dados alheios."""
    names = await _names(db, [request])
    emails = await _requester_emails(db, [request]) if team_view else {}
    return _to_out(
        request,
        parish=names.parishes.get(request.parish_id) if request.parish_id else None,
        locality=names.localities.get(request.locality_id) if request.locality_id else None,
        requester_email=emails.get(request.requester_id) if request.requester_id else None,
    )


async def get_request(db: AsyncSession, request_id: uuid.UUID) -> CollectionRequest:
    request = await db.get(CollectionRequest, request_id)
    if request is None:
        raise NotFoundError("No such collection request")
    return request


async def list_requests(
    db: AsyncSession, user: User, filters: CollectionRequestListFilters
) -> list[CollectionRequestOut]:
    """A leitura de pedidos: quem pede vê os seus; a equipa (admin/operator) vê tudo, com filtros.

    A fila de despacho do gestor é `state=exception` — fora de ronda, fora do prazo, urgências e
    recolhas especiais vivem na mesma fila (decisão da spec #54).
    """
    await purge_expired_addresses(db)
    query = select(CollectionRequest)
    is_team = user.role in ("admin", "operator")
    if is_team:
        if filters.state is not None:
            query = query.where(CollectionRequest.state == filters.state)
        if filters.subject_kind is not None:
            query = query.where(CollectionRequest.subject_kind == filters.subject_kind)
        if filters.parish_code:
            parish = (
                await db.execute(select(Parish).where(Parish.dicofre == filters.parish_code))
            ).scalar_one_or_none()
            if parish is None:
                return []
            query = query.where(CollectionRequest.parish_id == parish.id)
    else:
        if subject_of(user) is RequestSubject.LOCAL:
            account = (
                await db.execute(select(LocalAccount).where(LocalAccount.user_id == user.id))
            ).scalar_one_or_none()
            if account is None or account.locality_id is None:
                raise LocalAccountMissingError("This account has no locality binding")
            query = query.where(CollectionRequest.locality_id == account.locality_id)
        else:
            query = query.where(CollectionRequest.requester_id == user.id)
        if filters.state is not None:
            query = query.where(CollectionRequest.state == filters.state)
    requests = list(
        (await db.execute(query.order_by(CollectionRequest.created_at.desc()).limit(filters.limit))).scalars()
    )
    names = await _names(db, requests)
    emails = await _requester_emails(db, requests) if is_team else {}
    return [
        _to_out(
            r,
            parish=names.parishes.get(r.parish_id) if r.parish_id else None,
            locality=names.localities.get(r.locality_id) if r.locality_id else None,
            requester_email=emails.get(r.requester_id) if r.requester_id else None,
        )
        for r in requests
    ]


def _to_out(
    request: CollectionRequest,
    *,
    parish: Parish | None,
    locality: Locality | None,
    requester_email: str | None = None,
) -> CollectionRequestOut:
    return CollectionRequestOut(
        id=request.id,
        subject_kind=request.subject_kind,
        requester_id=request.requester_id,
        requester_email=requester_email,
        locality_id=request.locality_id,
        locality_name=locality.name if locality else None,
        parish_code=parish.dicofre if parish else None,
        parish_name=parish.name if parish else None,
        address=request.address,
        ephemeral_address=request.ephemeral_address,
        bag_count=request.bag_count,
        requested_date=request.requested_date,
        urgent=request.urgent,
        note=request.note,
        state=request.state,
        exception_reason=request.exception_reason,
        missed_count=request.missed_count,
        dispatch_reason=request.dispatch_reason,
        dispatched_at=request.dispatched_at,
        collected_at=request.collected_at,
        cancelled_at=request.cancelled_at,
        expired_at=request.expired_at,
        address_retained_until=request.address_retained_until,
        created_at=request.created_at,
    )


async def cancel_request(db: AsyncSession, user: User, request_id: uuid.UUID) -> CollectionRequest:
    """Anula um pedido ativo. Quem pediu anula o seu; a equipa (admin/operator) pode anular qualquer um."""
    request = await get_request(db, request_id)
    is_owner = request.requester_id == user.id
    if not is_owner and user.role not in ("admin", "operator"):
        raise ForbiddenError("Only the requester or the team can cancel a request")
    if request.state not in ACTIVE_STATES:
        raise RequestCancelNotAllowedError("Only active requests can be cancelled")
    request.state = CollectionRequestState.CANCELLED
    request.cancelled_at = datetime.now(UTC)
    request.cancelled_by_id = user.id
    _purge_ephemeral_address(request)  # morada efémera: apaga-se ao fechar (sem retenção)
    await db.commit()
    return request


async def dispatch_request(
    db: AsyncSession, user: User, request_id: uuid.UUID, body: DispatchRequest
) -> CollectionRequest:
    """O gestor despacha uma exceção: agendar (com data, que pode sair da ronda pedida) ou recusar com motivo."""
    request = await get_request(db, request_id)
    if request.state is not CollectionRequestState.EXCEPTION:
        raise RequestNotDispatchableError("Only requests in the exception queue can be dispatched")
    if body.action is DispatchAction.REJECT:
        if not body.reason:
            raise RequestNotDispatchableError("Rejecting needs a reason")
        request.state = CollectionRequestState.REJECTED
        request.dispatch_reason = body.reason  # o motivo da exceção fica no histórico do pedido
        _purge_ephemeral_address(request)  # recusado é terminal: morada efémera apaga-se já
    else:
        request.state = CollectionRequestState.SCHEDULED
        request.exception_reason = None
        if body.requested_date is not None:
            request.requested_date = body.requested_date
        if body.reason:
            request.dispatch_reason = body.reason
    request.dispatched_by_id = user.id
    request.dispatched_at = datetime.now(UTC)
    await db.commit()
    return request


async def record_outcome(
    db: AsyncSession, user: User, request_id: uuid.UUID, body: RequestOutcomeCreate
) -> CollectionRequest:
    """O resultado da visita: recolhido fecha o pedido; a ausência soma — à 3.ª, o pedido expira."""
    request = await get_request(db, request_id)
    try:
        result = apply_outcome(request.state, request.missed_count, body.outcome)
    except ValueError as exc:
        raise RequestNotScheduledError(str(exc)) from exc
    request.state = result.state
    request.missed_count = result.missed_count
    if result.state is CollectionRequestState.COLLECTED:
        request.collected_at = datetime.now(UTC)
    elif result.state is CollectionRequestState.EXPIRED:
        request.expired_at = datetime.now(UTC)
    if result.state in TERMINAL_STATES:
        _purge_ephemeral_address(request)  # recolhido/expirado: morada efémera apaga-se ao fechar
    await db.commit()
    return request
