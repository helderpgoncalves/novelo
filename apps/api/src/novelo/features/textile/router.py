from datetime import UTC, datetime
from datetime import date as Date
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.features.datasets.versioning import ReferenceCache
from novelo.features.textile import overview, service
from novelo.features.textile.schemas import Flows, Overview, TextileBaseline, WasteComposition

router = APIRouter()
Db = Annotated[AsyncSession, Depends(get_db)]


def get_today() -> Date:
    """Relógio do servidor (UTC); os testes substituem-no com `dependency_overrides`."""
    return datetime.now(UTC).date()


Today = Annotated[Date, Depends(get_today)]


@router.get("/baseline", response_model=TextileBaseline)
async def get_textile_baseline(db: Db, cache: ReferenceCache) -> TextileBaseline | Response:
    """Têxtil recolhido em 2025 por entidade e destino, face à procura estimada."""
    if cache.fresh:
        return cache.not_modified()
    return cache.stamp(await service.get_baseline(db))


@router.get("/flows", response_model=Flows)
async def get_observed_flows(db: Db, cache: ReferenceCache) -> Flows | Response:
    """Fluxo observado entidade → destino em toneladas (Sankey do ponto de partida)."""
    if cache.fresh:
        return cache.not_modified()
    return cache.stamp(await service.get_observed_flows(db))


@router.get("/waste", response_model=WasteComposition)
async def get_waste_composition(db: Db, cache: ReferenceCache) -> WasteComposition | Response:
    """Composição dos resíduos urbanos: onde os têxteis pesam face ao resto."""
    if cache.fresh:
        return cache.not_modified()
    return cache.stamp(await service.get_waste_composition(db))


@router.get("/overview", response_model=Overview)
async def get_overview(db: Db, today: Today) -> Overview:
    """Página inicial: lacuna, referências, prazos regulatórios, freguesias, fronteira de cenários e manchetes."""
    return await overview.get_overview(db, today)
