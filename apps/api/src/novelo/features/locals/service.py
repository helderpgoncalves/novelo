"""Regras da conta de local: leitura do próprio sítio, um aviso ativo, certificado opt-in.

Sem FastAPI: os routers chamam daqui e os erros saem como `AppError`. Os dados do local deduzem-se SEMPRE
da conta de quem pede (`get_account`) — nunca de um parâmetro — para ser impossível ver o sítio do outro.
"""

import uuid
from datetime import UTC, datetime
from typing import NamedTuple

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.errors import (
    CertificateNotPublicError,
    LocalAccountMissingError,
    LocalNoticeActiveError,
    NotFoundError,
)
from novelo.domain.vocab import NoticeState, TextileDestination
from novelo.features.locals.models import LocalAccount, StopNotice
from novelo.features.locals.schemas import (
    LocalAccountAdminOut,
    LocalAccountOut,
    LocalCertificateOut,
    LocalReportOut,
    StopNoticeOut,
)
from novelo.features.lots import service as lots_service
from novelo.features.lots.models import Lot, LotItem, LotUnit
from novelo.features.lots.schemas import LotSummary
from novelo.features.network.models import Locality, Parish
from novelo.features.users.models import User


async def get_account(db: AsyncSession, user_id: uuid.UUID) -> LocalAccount:
    """A conta de local do utilizador. Falta (conta antiga sem ligações) → 404 `local_account_missing`."""
    account = (await db.execute(select(LocalAccount).where(LocalAccount.user_id == user_id))).scalar_one_or_none()
    if account is None:
        raise LocalAccountMissingError("This account has no locality binding")
    return account


async def locality_name_of(db: AsyncSession, locality_id: uuid.UUID | None) -> str | None:
    """O nome do local (para o convite e o certificado); nulo sem local ou se a Vitrus o retirar."""
    if locality_id is None:
        return None
    locality = await db.get(Locality, locality_id)
    return locality.name if locality else None


async def locality_names(db: AsyncSession, ids: list[uuid.UUID | None]) -> dict[uuid.UUID, str]:
    wanted = {i for i in ids if i is not None}
    if not wanted:
        return {}
    rows = (await db.execute(select(Locality.id, Locality.name).where(Locality.id.in_(wanted)))).all() if wanted else []
    return dict(rows)


async def active_notices(db: AsyncSession, locality_ids: set[uuid.UUID]) -> dict[uuid.UUID, StopNotice]:
    """O aviso ativo de cada local (um só por local, por construção)."""
    if not locality_ids:
        return {}
    rows = await db.execute(
        select(StopNotice).where(StopNotice.locality_id.in_(locality_ids), StopNotice.state == NoticeState.ACTIVE)
    )
    return {n.locality_id: n for n in rows.scalars() if n.locality_id is not None}


def notice_out(notice: StopNotice) -> StopNoticeOut:
    return StopNoticeOut(
        id=notice.id,
        locality_id=notice.locality_id,
        state=notice.state,
        bag_count=notice.bag_count,
        note=notice.note,
        created_at=notice.created_at,
        cancelled_at=notice.cancelled_at,
    )


async def raise_notice(
    db: AsyncSession, *, account: LocalAccount, user: User, bag_count: int | None, note: str | None
) -> StopNotice:
    """Dá o aviso «sacos prontos». Já há um ativo → 409 `notice_already_active` (anular antes de avisar outra vez)."""
    if await active_notice(db, account.locality_id) is not None:
        raise LocalNoticeActiveError("There is already an active notice for this locality")
    notice = StopNotice(
        locality_id=account.locality_id,
        state=NoticeState.ACTIVE,
        bag_count=bag_count,
        note=note,
        created_by_id=user.id,
    )
    db.add(notice)
    await db.commit()
    return notice


async def cancel_notice(db: AsyncSession, *, account: LocalAccount, user: User) -> StopNotice:
    """Anula o aviso ativo (o histórico fica: `state=cancelled`). Sem ativo → 404."""
    notice = await active_notice(db, account.locality_id)
    if notice is None:
        raise NotFoundError("No active notice for this locality")
    notice.state = NoticeState.CANCELLED
    notice.cancelled_at = datetime.now(UTC)
    notice.cancelled_by_id = user.id
    await db.commit()
    return notice


async def active_notice(db: AsyncSession, locality_id: uuid.UUID | None) -> StopNotice | None:
    if locality_id is None:
        return None
    return (
        await db.execute(
            select(StopNotice).where(StopNotice.locality_id == locality_id, StopNotice.state == NoticeState.ACTIVE)
        )
    ).scalar_one_or_none()


async def account_out(db: AsyncSession, account: LocalAccount) -> LocalAccountOut:
    locality: Locality | None = None
    if account.locality_id is not None:
        locality = await db.get(Locality, account.locality_id)
    parish_name = None
    if locality is not None and locality.parish_id is not None:
        parish = await db.get(Parish, locality.parish_id)
        parish_name = parish.name if parish else None
    return LocalAccountOut(
        id=account.id,
        locality_id=account.locality_id,
        locality_name=locality.name if locality else None,
        parish_name=parish_name,
        kind=account.kind,
        certificate_opt_in=account.certificate_opt_in,
        created_at=account.created_at,
    )


async def list_account_outs(db: AsyncSession) -> list[LocalAccountAdminOut]:
    """Contas de local para a equipa: quem entra, o sítio, o certificado e o aviso ativo de cada local."""
    rows = list((await db.execute(select(LocalAccount).order_by(LocalAccount.created_at))).scalars())
    user_ids = {a.user_id for a in rows}
    people: dict[uuid.UUID, User] = {}
    if user_ids:
        found = await db.execute(select(User).where(User.id.in_(user_ids)))
        people = {u.id: u for u in found.scalars()}
    names = await locality_names(db, [a.locality_id for a in rows])
    notices = await active_notices(db, {a.locality_id for a in rows if a.locality_id is not None})
    return [
        LocalAccountAdminOut(
            id=a.id,
            user_id=a.user_id,
            user_email=people[a.user_id].email if a.user_id in people else "?",
            user_name=people[a.user_id].name if a.user_id in people else None,
            locality_id=a.locality_id,
            locality_name=names.get(a.locality_id) if a.locality_id else None,
            kind=a.kind,
            certificate_opt_in=a.certificate_opt_in,
            notice=notice_out(notices[a.locality_id]) if a.locality_id in notices else None,
            created_at=a.created_at,
        )
        for a in rows
    ]


async def list_local_lots(db: AsyncSession, account: LocalAccount) -> list[LotSummary]:
    """Os lotes das paragens do próprio local (um lote por paragem), mais recentes primeiro."""
    return await lots_service.list_lots(db, None, None, None, locality_id=account.locality_id)


async def local_report(db: AsyncSession, account: LocalAccount) -> LocalReportOut:
    """Relatório do local em kg por destino: o peso vem da balança (ou da estimativa nos lotes antigos),
    os destinos da mesa de triagem — só os lotes triados contam no desvio. Sem CO₂ e sem doadores, sempre."""
    weights = await _weight_report(db, account.locality_id)
    destinations = await _destination_kg(db, account.locality_id)
    name = (await locality_names(db, [account.locality_id])).get(account.locality_id) if account.locality_id else None
    return LocalReportOut(
        locality_id=account.locality_id,
        locality_name=name,
        lots=weights.lots,
        measured_lots=weights.measured_lots,
        sorted_lots=weights.sorted_lots,
        lots_in_triage=weights.lots - weights.sorted_lots,
        weight_kg=round(weights.weight_g / 1000, 3),
        reuse_kg=round(destinations[TextileDestination.REUSE], 3),
        recycle_kg=round(destinations[TextileDestination.RECYCLE], 3),
        reject_kg=round(destinations[TextileDestination.REJECT], 3),
        first_stop_at=weights.first_stop_at,
        last_stop_at=weights.last_stop_at,
    )


class _Weights(NamedTuple):
    """Os totais do agregado de pesos por local (a mão: 3,5 kg medidos + 0,8 kg em triagem = 4,3 kg)."""

    lots: int
    measured_lots: int
    sorted_lots: int
    weight_g: int
    first_stop_at: datetime | None
    last_stop_at: datetime | None


async def _weight_report(db: AsyncSession, locality_id: uuid.UUID | None) -> _Weights:
    """Totais num agregado só: lotes, com peso medido, triados e o peso efetivo de cada lote.

    O peso efetivo é o medido nas unidades quando há balança; sem balança (lotes antigos), a soma estimada
    das peças — a mesma regra de `lots.service.lot_weight`, aqui em SQL para não carregar lotes para a memória.
    """
    item_totals = (
        select(
            LotItem.lot_id.label("lot_id"),
            func.count().label("n"),
            func.coalesce(func.sum(LotItem.estimated_weight_g), 0).label("grams"),
        )
        .group_by(LotItem.lot_id)
        .subquery()
    )
    unit_totals = (
        select(LotUnit.lot_id.label("lot_id"), func.coalesce(func.sum(LotUnit.weight_g), 0).label("grams"))
        .group_by(LotUnit.lot_id)
        .subquery()
    )
    effective_grams = case(
        (func.coalesce(unit_totals.c.grams, 0) > 0, func.coalesce(unit_totals.c.grams, 0)),
        else_=func.coalesce(item_totals.c.grams, 0),
    )
    query = (
        select(
            func.count().label("lots"),
            func.count().filter(unit_totals.c.grams > 0).label("measured_lots"),
            func.count().filter(item_totals.c.n > 0).label("sorted_lots"),
            func.coalesce(func.sum(effective_grams), 0).label("weight_g"),
            func.min(Lot.created_at).label("first_stop_at"),
            func.max(Lot.created_at).label("last_stop_at"),
        )
        .select_from(Lot)
        .outerjoin(item_totals, item_totals.c.lot_id == Lot.id)
        .outerjoin(unit_totals, unit_totals.c.lot_id == Lot.id)
    )
    if locality_id is not None:
        query = query.where(Lot.locality_id == locality_id)
    row = (await db.execute(query)).one()
    return _Weights(
        lots=int(row.lots),
        measured_lots=int(row.measured_lots),
        sorted_lots=int(row.sorted_lots),
        weight_g=int(row.weight_g),
        first_stop_at=row.first_stop_at,
        last_stop_at=row.last_stop_at,
    )


async def _destination_kg(db: AsyncSession, locality_id: uuid.UUID | None) -> dict[TextileDestination, float]:
    """Kg por destino: o que a mesa de triagem decidiu (só lotes triados)."""
    kg = dict.fromkeys(TextileDestination, 0.0)
    query = (
        select(LotItem.condition, func.coalesce(func.sum(LotItem.estimated_weight_g), 0))
        .join(Lot, Lot.id == LotItem.lot_id)
        .group_by(LotItem.condition)
    )
    if locality_id is not None:
        query = query.where(Lot.locality_id == locality_id)
    for condition, grams in (await db.execute(query)).all():
        kg[condition] += int(grams) / 1000
    return kg


async def set_certificate_opt_in(db: AsyncSession, *, account: LocalAccount, user: User, opt_in: bool) -> LocalAccount:
    """O opt-in do certificado público: só a própria conta decide (e pode voltar a desligar)."""
    account.certificate_opt_in = opt_in
    account.certificate_opt_in_at = datetime.now(UTC) if opt_in else None
    account.certificate_opt_in_by_id = user.id if opt_in else None
    await db.commit()
    return account


async def public_certificate(db: AsyncSession, account_id: uuid.UUID) -> LocalCertificateOut:
    """O certificado público de um local. Opt-in desligado → 404 `certificate_not_public` (não há página).

    Agregados do sítio, nunca pessoas: sem doadores, sem contactos, sem CO₂ (o CO₂ seria outra estimativa
    e o certificado só traz o que foi medido). Os percentuais vêm dos lotes triados (o desvio medido a jusante).
    """
    account = await db.get(LocalAccount, account_id)
    if account is None or not account.certificate_opt_in:
        raise CertificateNotPublicError("This certificate is not public")
    weights = await _weight_report(db, account.locality_id)
    destinations = await _destination_kg(db, account.locality_id)
    locality = await db.get(Locality, account.locality_id) if account.locality_id else None
    parish_name = None
    if locality is not None and locality.parish_id is not None:
        parish = await db.get(Parish, locality.parish_id)
        parish_name = parish.name if parish else None
    sorted_kg = sum(destinations.values())
    total = sorted_kg or 1.0
    return LocalCertificateOut(
        locality_name=locality.name if locality else None,
        parish_name=parish_name,
        stops=weights.lots,
        weight_kg=round(weights.weight_g / 1000, 3),
        reuse_kg=round(destinations[TextileDestination.REUSE], 3),
        recycle_kg=round(destinations[TextileDestination.RECYCLE], 3),
        reject_kg=round(destinations[TextileDestination.REJECT], 3),
        reuse_pct=round(destinations[TextileDestination.REUSE] / total * 100, 1),
        recycle_pct=round(destinations[TextileDestination.RECYCLE] / total * 100, 1),
        reject_pct=round(destinations[TextileDestination.REJECT] / total * 100, 1),
        first_stop_at=weights.first_stop_at,
        updated_at=datetime.now(UTC),
    )
