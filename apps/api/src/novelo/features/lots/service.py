"""Lotes, passaporte, bolsa de fibra e evidência por marca."""

import io
import secrets
import uuid
from collections import Counter, defaultdict
from datetime import UTC, datetime

import segno
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from novelo.core.config import get_settings
from novelo.core.errors import ConflictError, NotFoundError
from novelo.domain.vocab import Fibre, LotEventKind, LotState, TextileDestination
from novelo.features.lots.models import Lot, LotEvent, LotItem, LotReservation
from novelo.features.lots.schemas import (
    BrandCount,
    BrandsOut,
    BrandStat,
    CompositionPart,
    LotDetail,
    LotEventOut,
    LotItemIn,
    LotItemOut,
    LotSummary,
    MarketEntry,
    MarketLot,
    Passport,
    ReservationOut,
    ReserveRequest,
)
from novelo.features.network.models import Parish
from novelo.features.users.models import User

# Alfabeto sem 0/O/1/I/L: o código lê-se bem em etiquetas impressas.
_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

# Peso médio por tipo de peça, em gramas. PRESSUPOSTO da equipa (no piloto vem de uma balança no ponto).
AVERAGE_WEIGHT_G = {
    "tshirt": 150, "shirt": 200, "trousers": 450, "jumper": 400, "jacket": 700,
    "dress": 300, "skirt": 250, "bedding": 900, "towel": 500, "other": 300,
}  # fmt: skip


def _clean_brand(brand: str | None) -> str | None:
    """Uma só grafia por marca ("  zara " e "ZARA" contam como "Zara") para a evidência por marca somar certo."""
    cleaned = " ".join((brand or "").split())
    return cleaned.title() if cleaned else None


def new_code() -> str:
    return "NOV-" + "".join(secrets.choice(_ALPHABET) for _ in range(6))


def dominant_fibre(composition: list[CompositionPart]) -> Fibre:
    if not composition:
        return Fibre.UNKNOWN
    return max(composition, key=lambda p: p.pct).fibre


def estimate_weight_g(garment_type: str) -> int:
    return AVERAGE_WEIGHT_G.get(garment_type, AVERAGE_WEIGHT_G["other"])


def aggregate_composition(items: list[LotItem]) -> list[CompositionPart]:
    """Composição do lote: média das composições das peças, ponderada pelo peso."""
    grams: dict[str, float] = defaultdict(float)
    total = 0.0
    for it in items:
        for part in it.composition:
            grams[part["fibre"]] += it.estimated_weight_g * part["pct"] / 100
        total += it.estimated_weight_g
    if total == 0:
        return []
    parts = [CompositionPart(fibre=Fibre(f), pct=round(g / total * 100, 1)) for f, g in grams.items()]
    return sorted(parts, key=lambda p: -p.pct)


def _item_out(i: LotItem) -> LotItemOut:
    return LotItemOut(
        id=i.id,
        garment_type=i.garment_type,
        condition=i.condition,
        composition=[CompositionPart(**p) for p in i.composition],
        dominant_fibre=i.dominant_fibre,
        brand=i.brand,
        estimated_weight_g=i.estimated_weight_g,
        confidence=float(i.confidence),
        created_at=i.created_at,
    )


async def _load(db: AsyncSession, code: str) -> Lot:
    lot = (
        await db.execute(
            select(Lot)
            .where(Lot.code == code.upper())
            .options(selectinload(Lot.items), selectinload(Lot.events), selectinload(Lot.reservation))
        )
    ).scalar_one_or_none()
    if lot is None:
        raise NotFoundError("Lot not found")
    return lot


async def _parish_names(db: AsyncSession) -> dict[uuid.UUID, tuple[str, str]]:
    return {
        pid: (code, name)
        for pid, code, name in (await db.execute(select(Parish.id, Parish.dicofre, Parish.name))).all()
    }


def _summary(lot: Lot, parishes: dict[uuid.UUID, tuple[str, str]]) -> LotSummary:
    code, name = parishes.get(lot.parish_id, (None, None)) if lot.parish_id else (None, None)
    return LotSummary(
        code=lot.code,
        state=lot.state,
        parish_code=code,
        parish_name=name,
        dominant_fibre=lot.dominant_fibre,
        items=len(lot.items),
        weight_kg=round(sum(i.estimated_weight_g for i in lot.items) / 1000, 3),
        opened_at=lot.created_at,
    )


def _event(lot: Lot, kind: LotEventKind, user: User | None, note: str | None = None) -> None:
    lot.events.append(LotEvent(kind=kind, occurred_at=datetime.now(UTC), actor_id=user.id if user else None, note=note))


async def open_lot(db: AsyncSession, user: User, parish_code: str | None) -> LotSummary:
    parish_id = None
    if parish_code:
        parish = (await db.execute(select(Parish).where(Parish.dicofre == parish_code))).scalar_one_or_none()
        if parish is None:
            raise NotFoundError("Parish not found")
        parish_id = parish.id
    lot = Lot(code=new_code(), parish_id=parish_id, created_by_id=user.id, items=[], events=[])
    _event(lot, LotEventKind.OPENED, user)
    db.add(lot)
    await db.commit()
    return _summary(lot, await _parish_names(db))


async def add_item(db: AsyncSession, user: User, code: str, body: LotItemIn) -> LotItemOut:
    lot = await _load(db, code)
    if lot.state != LotState.COLLECTED:
        raise ConflictError("The lot is closed: no more items can be added")
    item = LotItem(
        garment_type=body.garment_type,
        condition=body.condition,
        composition=[p.model_dump(mode="json") for p in body.composition],
        dominant_fibre=dominant_fibre(body.composition),
        brand=_clean_brand(body.brand),
        estimated_weight_g=body.estimated_weight_g,
        confidence=body.confidence,
        prompt_version=body.prompt_version,
        confirmed_by_id=user.id,
    )
    lot.items.append(item)
    lot.dominant_fibre = dominant_fibre(aggregate_composition(lot.items))
    _event(lot, LotEventKind.ITEM_ADDED, user)
    await db.commit()
    return _item_out(item)


async def list_lots(
    db: AsyncSession, fibre: Fibre | None, state: LotState | None, parish_code: str | None
) -> list[LotSummary]:
    query = select(Lot).options(selectinload(Lot.items)).order_by(Lot.created_at.desc())
    if fibre:
        query = query.where(Lot.dominant_fibre == fibre)
    if state:
        query = query.where(Lot.state == state)
    parishes = await _parish_names(db)
    if parish_code:
        ids = [pid for pid, (code, _) in parishes.items() if code == parish_code]
        query = query.where(Lot.parish_id.in_(ids))
    lots = (await db.execute(query)).scalars().all()
    return [_summary(lot, parishes) for lot in lots]


def _destination_kg(lot: Lot) -> dict[TextileDestination, float]:
    kg = dict.fromkeys(TextileDestination, 0.0)
    for i in lot.items:
        kg[i.condition] += i.estimated_weight_g / 1000
    return kg


async def get_lot(db: AsyncSession, code: str) -> LotDetail:
    lot = await _load(db, code)
    parishes = await _parish_names(db)
    kg = _destination_kg(lot)
    return LotDetail(
        **_summary(lot, parishes).model_dump(),
        composition=aggregate_composition(lot.items),
        reuse_kg=round(kg[TextileDestination.REUSE], 3),
        recycle_kg=round(kg[TextileDestination.RECYCLE], 3),
        reject_kg=round(kg[TextileDestination.REJECT], 3),
        item_list=[_item_out(i) for i in sorted(lot.items, key=lambda i: i.created_at, reverse=True)],
        events=[LotEventOut(kind=e.kind, occurred_at=e.occurred_at, note=e.note) for e in lot.events],
        reservation=ReservationOut(
            recycler_name=lot.reservation.recycler_name,
            contact=lot.reservation.contact,
            note=lot.reservation.note,
            created_at=lot.reservation.created_at,
        )
        if lot.reservation
        else None,
    )


async def passport(db: AsyncSession, code: str) -> Passport:
    """Dados públicos do lote. Sem reserva nem contactos: só o que o reciclador e a câmara precisam de ver."""
    lot = await _load(db, code)
    parishes = await _parish_names(db)
    kg = _destination_kg(lot)
    total = sum(kg.values()) or 1.0
    brands = Counter(i.brand for i in lot.items if i.brand)
    return Passport(
        code=lot.code,
        state=lot.state,
        parish_name=parishes[lot.parish_id][1] if lot.parish_id in parishes else None,
        dominant_fibre=lot.dominant_fibre,
        composition=aggregate_composition(lot.items),
        weight_kg=round(sum(kg.values()), 3),
        items=len(lot.items),
        reuse_pct=round(kg[TextileDestination.REUSE] / total * 100, 1),
        recycle_pct=round(kg[TextileDestination.RECYCLE] / total * 100, 1),
        reject_pct=round(kg[TextileDestination.REJECT] / total * 100, 1),
        brands=[BrandCount(brand=b, items=n) for b, n in brands.most_common(8)],
        events=[LotEventOut(kind=e.kind, occurred_at=e.occurred_at, note=None) for e in lot.events],
        opened_at=lot.created_at,
    )


def qr_svg(code: str) -> bytes:
    """QR em SVG que aponta para o passaporte público."""
    url = f"{get_settings().app_url.rstrip('/')}/passport/{code}"
    buffer = io.BytesIO()
    segno.make(url, error="m").save(buffer, kind="svg", scale=8, border=2, dark="#14211D", light=None, xmldecl=False)
    return buffer.getvalue()


async def change_state(db: AsyncSession, user: User, code: str, state: LotState) -> LotDetail:
    lot = await _load(db, code)
    order = [LotState.COLLECTED, LotState.SORTED, LotState.RESERVED, LotState.DELIVERED]
    if state == LotState.RESERVED:
        raise ConflictError("Reservations are made through the fibre exchange")
    if order.index(state) < order.index(lot.state):
        raise ConflictError("A lot cannot go back to an earlier state")
    if state == LotState.SORTED and not lot.items:
        raise ConflictError("An empty lot cannot be closed")
    if lot.state == state:
        return await get_lot(db, code)
    lot.state = state
    kind = {LotState.SORTED: LotEventKind.SORTED, LotState.DELIVERED: LotEventKind.DELIVERED}[state]
    _event(lot, kind, user)
    await db.commit()
    return await get_lot(db, code)


async def market(db: AsyncSession, fibre: Fibre | None) -> list[MarketEntry]:
    query = select(Lot).where(Lot.state.in_([LotState.SORTED, LotState.RESERVED])).options(selectinload(Lot.items))
    if fibre:
        query = query.where(Lot.dominant_fibre == fibre)
    lots = (await db.execute(query.order_by(Lot.created_at.desc()))).scalars().all()
    parishes = await _parish_names(db)
    groups: dict[Fibre, list[Lot]] = defaultdict(list)
    for lot in lots:
        groups[lot.dominant_fibre].append(lot)
    entries = []
    for f, group in groups.items():
        names = sorted({parishes[lot.parish_id][1] for lot in group if lot.parish_id in parishes})
        entries.append(
            MarketEntry(
                fibre=f,
                lots=len(group),
                weight_kg=round(sum(i.estimated_weight_g for lot in group for i in lot.items) / 1000, 3),
                parishes=names,
                items=[
                    MarketLot(
                        code=lot.code,
                        parish_name=parishes[lot.parish_id][1] if lot.parish_id in parishes else None,
                        weight_kg=round(sum(i.estimated_weight_g for i in lot.items) / 1000, 3),
                        state=lot.state,
                        dominant_fibre=lot.dominant_fibre,
                        composition=aggregate_composition(lot.items),
                    )
                    for lot in group
                ],
            )
        )
    return sorted(entries, key=lambda e: -e.weight_kg)


async def reserve(db: AsyncSession, user: User, code: str, body: ReserveRequest) -> LotDetail:
    lot = await _load(db, code)
    if lot.state != LotState.SORTED:
        raise ConflictError("Only sorted lots can be reserved")
    lot.reservation = LotReservation(recycler_name=body.recycler_name, contact=body.contact, note=body.note)
    lot.state = LotState.RESERVED
    _event(lot, LotEventKind.RESERVED, user, note=body.recycler_name)
    await db.commit()
    return await get_lot(db, code)


async def brands(db: AsyncSession) -> BrandsOut:
    items = (await db.execute(select(LotItem))).scalars().all()
    by_brand: dict[str, list[LotItem]] = defaultdict(list)
    for i in items:
        if i.brand:
            by_brand[i.brand.strip().title()].append(i)
    total_kg = sum(i.estimated_weight_g for i in items) / 1000
    stats = []
    for brand, rows in by_brand.items():
        kg = sum(i.estimated_weight_g for i in rows) / 1000
        fibres = Counter(i.dominant_fibre for i in rows)
        stats.append(
            BrandStat(
                brand=brand,
                items=len(rows),
                weight_kg=round(kg, 3),
                top_fibre=fibres.most_common(1)[0][0],
                share_pct=round(kg / total_kg * 100, 1) if total_kg else 0.0,
            )
        )
    return BrandsOut(
        brands=sorted(stats, key=lambda s: -s.weight_kg),
        sample_items=len(items),
        items_without_brand=sum(1 for i in items if not i.brand),
        total_kg=round(total_kg, 3),
    )
