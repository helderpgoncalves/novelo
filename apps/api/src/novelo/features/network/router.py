from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.features.network import service
from novelo.features.network.schemas import CircuitsSummary, ContainerList, FleetSummary, LocalityOut

router = APIRouter()
Db = Annotated[AsyncSession, Depends(get_db)]


@router.get("/circuits", response_model=CircuitsSummary)
async def list_circuits(db: Db) -> CircuitsSummary:
    """Circuitos de recolha atuais da Vitrus, com localidades, dias e viaturas."""
    return await service.list_circuits(db)


@router.get("/fleet", response_model=FleetSummary)
async def get_fleet(db: Db) -> FleetSummary:
    """Frota e turnos: ocupação por tipologia e turno, e o horário de cada viatura."""
    return await service.get_fleet(db)


@router.get("/localities", response_model=list[LocalityOut])
async def list_localities(db: Db) -> list[LocalityOut]:
    """Cobertura por localidade: que circuitos passam e em que dias (base da recolha a pedido)."""
    return await service.list_localities(db)


@router.get("/containers", response_model=ContainerList)
async def list_containers(
    db: Db,
    limit: Annotated[int, Query(ge=1, le=1000)] = 200,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ContainerList:
    """Contentores georreferenciados (vazio até chegarem as localizações)."""
    return await service.list_containers(db, limit, offset)
