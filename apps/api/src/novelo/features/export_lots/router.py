from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.core.deps import CurrentUser
from novelo.core.guest import NotGuestDep
from novelo.domain.taxonomy import Colour, FineState, Gender, Season, SizeBand
from novelo.domain.vocab import GarmentType
from novelo.features.export_lots import service
from novelo.features.export_lots.schemas import (
    ExportLotDetail,
    ExportLotItemsIn,
    ExportLotKeyIn,
    ExportLotSummary,
)

router = APIRouter()
Db = Annotated[AsyncSession, Depends(get_db)]


@router.post("", response_model=ExportLotDetail, status_code=201, dependencies=[NotGuestDep])
async def create_export_lot(body: ExportLotKeyIn, user: CurrentUser, db: Db) -> ExportLotDetail:
    """Fecha um lote de escoamento por (estado fino, tipologia, estação, género): agrega todas as peças
    triadas que apanham a chave e ainda não têm lote. Cor e tamanho ficam fora, para filtros."""
    return await service.create_export_lot(db, user, body)


@router.get("", response_model=list[ExportLotSummary])
async def list_export_lots(
    db: Db,
    fine_state: FineState | None = None,
    garment_type: GarmentType | None = None,
    season: Season | None = None,
    gender: Gender | None = None,
    colour: Annotated[
        Colour | None, Query(description="Lotes com pelo menos uma peça desta cor (filtro, não chave)")
    ] = None,
    size_band: Annotated[
        SizeBand | None, Query(description="Lotes com pelo menos uma peça desta banda (filtro, não chave)")
    ] = None,
) -> list[ExportLotSummary]:
    """Lotes de escoamento, mais recentes primeiro; os filtros da chave e os de cor/tamanho combinam."""
    return await service.list_export_lots(
        db,
        fine_state=fine_state,
        garment_type=garment_type,
        season=season,
        gender=gender,
        colour=colour,
        size_band=size_band,
    )


@router.get("/{code}", response_model=ExportLotDetail)
async def get_export_lot(code: str, db: Db) -> ExportLotDetail:
    """Detalhe com linhagem: peças com a paragem de origem e lotes de recolha, mais pesado primeiro."""
    return await service.get_export_lot(db, code)


@router.post("/{code}/items", response_model=ExportLotDetail, status_code=201, dependencies=[NotGuestDep])
async def add_export_lot_items(code: str, body: ExportLotItemsIn, user: CurrentUser, db: Db) -> ExportLotDetail:
    """Junta a um lote aberto peças triadas depois do fecho: a chave tem de bater certo e a peça não
    pode já pertencer a outro lote de escoamento."""
    return await service.add_items(db, user, code, body.item_ids)


@router.post("/{code}/close", response_model=ExportLotDetail, dependencies=[NotGuestDep])
async def close_export_lot(code: str, user: CurrentUser, db: Db) -> ExportLotDetail:
    """Sela o lote para o mercado: as peças nunca mais entram noutro lote e a chave fica livre."""
    return await service.close_export_lot(db, user, code)
