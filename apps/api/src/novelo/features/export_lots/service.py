"""Lotes de escoamento: fechar por chave com linhagem até às paragens de origem."""

import secrets
import uuid
from datetime import UTC, datetime

from sqlalchemy import exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.errors import ConflictError, NotFoundError
from novelo.domain.export_lots import LineageRow, lineage_summary
from novelo.domain.taxonomy import Colour, FineState, Gender, Season, SizeBand
from novelo.domain.vocab import ExportLotState, GarmentType
from novelo.features.export_lots.models import ExportLot, ExportLotItem
from novelo.features.export_lots.schemas import (
    ExportLotDetail,
    ExportLotItemOut,
    ExportLotKeyIn,
    ExportLotSummary,
    LineageLotOut,
)
from novelo.features.lots.models import Lot, LotItem
from novelo.features.lots.schemas import TriageProvenance
from novelo.features.lots.service import aggregate_composition
from novelo.features.network.models import Locality, Parish
from novelo.features.users.models import User

# Mesmo alfabeto dos lotes de recolha (sem 0/O/1/I/L): o código lê-se bem impresso.
_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"


def new_code() -> str:
    """«EXP-» seguido de 6 caracteres: distingue o lote de escoamento do lote de recolha («NOV-»)."""
    return "EXP-" + "".join(secrets.choice(_ALPHABET) for _ in range(6))


async def _load(db: AsyncSession, code: str) -> ExportLot:
    lot = (await db.execute(select(ExportLot).where(ExportLot.code == code.upper()))).scalar_one_or_none()
    if lot is None:
        raise NotFoundError("Export lot not found")
    return lot


OriginRow = tuple[ExportLotItem, LotItem, str, str | None, str | None]


async def _origin_rows(db: AsyncSession, lot_id: uuid.UUID) -> list[OriginRow]:
    """Peças do lote com o lote de recolha de origem e a paragem (local e freguesia) de cada uma."""
    rows = await db.execute(
        select(ExportLotItem, LotItem, Lot.code, Locality.name, Parish.name)
        .join(LotItem, LotItem.id == ExportLotItem.item_id)
        .join(Lot, Lot.id == LotItem.lot_id)
        .outerjoin(Locality, Locality.id == Lot.locality_id)
        .outerjoin(Parish, Parish.id == Lot.parish_id)
        .where(ExportLotItem.export_lot_id == lot_id)
        .order_by(ExportLotItem.created_at)
    )
    return [row._tuple() for row in rows.all()]


def _item_out(
    membership: ExportLotItem, piece: LotItem, lot_code: str, locality: str | None, parish: str | None
) -> ExportLotItemOut:
    return ExportLotItemOut(
        id=piece.id,
        garment_type=piece.garment_type,
        fine_state=piece.fine_state,
        season=piece.season,
        gender=piece.gender,
        colour=piece.colour,
        size_band=piece.size_band,
        brand=piece.brand,
        provenance=TriageProvenance.model_validate(piece.provenance) if piece.provenance else None,
        estimated_weight_g=piece.estimated_weight_g,
        lot_code=lot_code,
        locality_name=locality,
        parish_name=parish,
        added_at=membership.created_at,
    )


async def get_export_lot(db: AsyncSession, code: str) -> ExportLotDetail:
    lot = await _load(db, code)
    rows = await _origin_rows(db, lot.id)
    lineage = lineage_summary(
        [
            LineageRow(
                item_id=piece.id,
                weight_g=piece.estimated_weight_g,
                lot_code=code_,
                locality_name=locality,
                parish_name=parish,
            )
            for _, piece, code_, locality, parish in rows
        ]
    )
    pieces = [piece for _, piece, _, _, _ in rows]
    return ExportLotDetail(
        code=lot.code,
        state=lot.state,
        fine_state=lot.fine_state,
        garment_type=lot.garment_type,
        season=lot.season,
        gender=lot.gender,
        taxonomy_version=lot.taxonomy_version,
        items=len(rows),
        weight_kg=lineage.weight_kg,
        collection_lots=len(lineage.lots),
        localities=lineage.localities,
        created_at=lot.created_at,
        closed_at=lot.closed_at,
        composition=aggregate_composition(pieces),
        item_list=[
            _item_out(membership, piece, code_, locality, parish) for membership, piece, code_, locality, parish in rows
        ],
        lineage=[
            LineageLotOut(
                lot_code=origin.lot_code,
                locality_name=origin.locality_name,
                parish_name=origin.parish_name,
                items=origin.items,
                weight_kg=origin.weight_kg,
            )
            for origin in lineage.lots
        ],
    )


async def create_export_lot(db: AsyncSession, user: User, body: ExportLotKeyIn) -> ExportLotDetail:
    """Fecha um lote de escoamento por chave: agrega TODAS as peças triadas que apanham a chave e ainda
    não têm lote. 409 se já houver um lote aberto com a mesma chave ou se não houver peças."""
    open_lot = await db.scalar(
        select(ExportLot).where(
            ExportLot.state == ExportLotState.OPEN,
            ExportLot.fine_state == body.fine_state,
            ExportLot.garment_type == body.garment_type,
            ExportLot.season == body.season,
            ExportLot.gender == body.gender,
        )
    )
    if open_lot is not None:
        raise ConflictError("An open export lot already exists for this key")
    pieces = (
        (
            await db.execute(
                select(LotItem).where(
                    LotItem.fine_state == body.fine_state,
                    LotItem.garment_type == body.garment_type,
                    LotItem.season == body.season,
                    LotItem.gender == body.gender,
                    # Peças sem taxonomia completa ficam de fora (os == já excluem nulos);
                    # e uma peça só entra uma vez em toda a vida do escoamento:
                    ~exists(select(ExportLotItem.id).where(ExportLotItem.item_id == LotItem.id)),
                )
            )
        )
        .scalars()
        .all()
    )
    if not pieces:
        raise ConflictError("No triaged items match this key")
    lot = ExportLot(
        code=new_code(),
        created_by_id=user.id,
        **body.model_dump(),
        memberships=[ExportLotItem(item_id=piece.id, added_by_id=user.id) for piece in pieces],
    )
    db.add(lot)
    await db.commit()
    return await get_export_lot(db, lot.code)


async def add_items(db: AsyncSession, user: User, code: str, item_ids: list[uuid.UUID]) -> ExportLotDetail:
    """Junta a um lote ABERTO peças triadas depois do fecho: a chave tem de bater certo e a peça não
    pode já pertencer a outro lote de escoamento."""
    lot = await _load(db, code)
    if lot.state != ExportLotState.OPEN:
        raise ConflictError("The export lot is closed: no more items can be added")
    pieces = (await db.execute(select(LotItem).where(LotItem.id.in_(item_ids)))).scalars().all()
    found = {piece.id for piece in pieces}
    if len(found) < len(item_ids):
        raise NotFoundError("Lot item not found")
    key = (lot.fine_state, lot.garment_type, lot.season, lot.gender)
    for piece in pieces:
        if (piece.fine_state, piece.garment_type, piece.season, piece.gender) != key:
            raise ConflictError("Item taxonomy does not match this export lot's key")
    assigned = (await db.execute(select(ExportLotItem.item_id).where(ExportLotItem.item_id.in_(found)))).scalars().all()
    if assigned:
        raise ConflictError("Some items are already in an export lot")
    lot.memberships.extend(ExportLotItem(item_id=piece.id, added_by_id=user.id) for piece in pieces)
    await db.commit()
    return await get_export_lot(db, code)


async def close_export_lot(db: AsyncSession, user: User, code: str) -> ExportLotDetail:
    """Sela o lote: as peças seguem para o mercado e nunca mais entram noutro lote de escoamento."""
    lot = await _load(db, code)
    if lot.state == ExportLotState.CLOSED:
        raise ConflictError("The export lot is already closed")
    if not lot.memberships:
        raise ConflictError("An empty export lot cannot be closed")
    lot.state = ExportLotState.CLOSED
    lot.closed_at = datetime.now(UTC)
    await db.commit()
    return await get_export_lot(db, code)


async def list_export_lots(
    db: AsyncSession,
    *,
    fine_state: FineState | None,
    garment_type: GarmentType | None,
    season: Season | None,
    gender: Gender | None,
    colour: Colour | None,
    size_band: SizeBand | None,
) -> list[ExportLotSummary]:
    """Lista com contagens em SQL; cor e tamanho filtram os lotes que TÊM peças com esse atributo."""
    totals = (
        select(
            ExportLotItem.export_lot_id.label("lot_id"),
            func.count().label("n"),
            func.coalesce(func.sum(LotItem.estimated_weight_g), 0).label("grams"),
            func.count(func.distinct(LotItem.lot_id)).label("lots"),
            func.count(func.distinct(Lot.locality_id)).label("localities"),
        )
        .join(LotItem, LotItem.id == ExportLotItem.item_id)
        .join(Lot, Lot.id == LotItem.lot_id)
        .group_by(ExportLotItem.export_lot_id)
        .subquery()
    )
    query = (
        select(ExportLot, totals.c.n, totals.c.grams, totals.c.lots, totals.c.localities)
        .outerjoin(totals, totals.c.lot_id == ExportLot.id)
        .order_by(ExportLot.created_at.desc())
    )
    if fine_state:
        query = query.where(ExportLot.fine_state == fine_state)
    if garment_type:
        query = query.where(ExportLot.garment_type == garment_type)
    if season:
        query = query.where(ExportLot.season == season)
    if gender:
        query = query.where(ExportLot.gender == gender)
    for column, value in ((LotItem.colour, colour), (LotItem.size_band, size_band)):
        if value:
            query = query.where(
                exists(
                    select(ExportLotItem.id)
                    .join(LotItem, LotItem.id == ExportLotItem.item_id)
                    .where(ExportLotItem.export_lot_id == ExportLot.id, column == value)
                )
            )
    rows = (await db.execute(query)).all()
    return [
        ExportLotSummary(
            code=lot.code,
            state=lot.state,
            fine_state=lot.fine_state,
            garment_type=lot.garment_type,
            season=lot.season,
            gender=lot.gender,
            taxonomy_version=lot.taxonomy_version,
            items=int(n or 0),
            weight_kg=round(int(grams or 0) / 1000, 3),
            collection_lots=int(lots or 0),
            localities=int(localities or 0),
            created_at=lot.created_at,
            closed_at=lot.closed_at,
        )
        for lot, n, grams, lots, localities in rows
    ]
