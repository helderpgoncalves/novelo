from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.features.textile import service
from novelo.features.textile.schemas import Flows, TextileBaseline, WasteComposition

router = APIRouter()
Db = Annotated[AsyncSession, Depends(get_db)]


@router.get("/baseline", response_model=TextileBaseline)
async def get_textile_baseline(db: Db) -> TextileBaseline:
    """Têxtil recolhido em 2025 por entidade e destino, face à procura estimada."""
    return await service.get_baseline(db)


@router.get("/flows", response_model=Flows)
async def get_observed_flows(db: Db) -> Flows:
    """Fluxo observado entidade → destino em toneladas (Sankey do ponto de partida)."""
    return await service.get_observed_flows(db)


@router.get("/waste", response_model=WasteComposition)
async def get_waste_composition(db: Db) -> WasteComposition:
    """Composição dos resíduos urbanos: onde os têxteis pesam face ao resto."""
    return await service.get_waste_composition(db)
