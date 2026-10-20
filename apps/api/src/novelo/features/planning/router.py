import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.core.deps import CurrentUser, require_role
from novelo.core.guest import NotGuest, NotGuestDep, SolverGuard
from novelo.features.datasets.versioning import PlanningCache
from novelo.features.planning import service
from novelo.features.planning.schemas import (
    ParametersOut,
    PlanningParams,
    ScenarioOut,
    ScenarioRequest,
    ScenarioSummary,
    ZoneOut,
)
from novelo.features.textile.schemas import Flows
from novelo.features.users.models import User

router = APIRouter()
Db = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[User, Depends(require_role("admin"))]


class ScenarioRename(BaseModel):
    label: str = Field(min_length=1, max_length=80)


@router.get("/parameters", response_model=ParametersOut)
async def get_planning_parameters(db: Db, cache: PlanningCache) -> ParametersOut | Response:
    """Pressupostos ativos do simulador, com a origem de cada um (plano, dados da Vitrus ou pressuposto)."""
    if cache.fresh:
        return cache.not_modified()
    return cache.stamp(await service.get_parameters(db))


@router.put("/parameters", response_model=ParametersOut)
async def update_planning_parameters(body: PlanningParams, admin: Admin, db: Db) -> ParametersOut:
    """Atualiza os pressupostos ativos (só administradores). Os cenários já gravados mantêm os seus."""
    return await service.update_parameters(db, body, admin)


@router.get("/zones", response_model=list[ZoneOut])
async def list_zones(db: Db, cache: PlanningCache) -> list[ZoneOut] | Response:
    """Freguesias com população (INE, Censos 2021), procura estimada e serviço atual da Vitrus."""
    if cache.fresh:
        return cache.not_modified()
    return cache.json_response(await service.list_zones(db))


@router.post("/scenarios", response_model=ScenarioOut, status_code=201, dependencies=[SolverGuard])
async def create_scenario(body: ScenarioRequest, user: CurrentUser, db: Db) -> ScenarioOut:
    """Corre o otimizador (localização e modo por freguesia, mais rotas) e guarda o cenário."""
    return await service.run_scenario(db, body, user)


@router.get("/scenarios", response_model=list[ScenarioSummary])
async def list_scenarios(db: Db) -> list[ScenarioSummary]:
    return await service.list_scenarios(db)


@router.get("/scenarios/{scenario_id}", response_model=ScenarioOut)
async def get_scenario(scenario_id: uuid.UUID, db: Db) -> ScenarioOut:
    return await service.get_scenario(db, scenario_id)


@router.patch("/scenarios/{scenario_id}", response_model=ScenarioSummary, dependencies=[NotGuestDep])
async def rename_scenario(scenario_id: uuid.UUID, body: ScenarioRename, db: Db) -> ScenarioSummary:
    return await service.rename_scenario(db, scenario_id, body.label)


@router.delete("/scenarios/{scenario_id}", status_code=204)
async def delete_scenario(scenario_id: uuid.UUID, _: NotGuest, db: Db) -> Response:
    await service.delete_scenario(db, scenario_id)
    return Response(status_code=204)


@router.get("/scenarios/{scenario_id}/flows", response_model=Flows)
async def get_scenario_flows(scenario_id: uuid.UUID, db: Db) -> Flows:
    """Fluxo previsto do cenário: freguesia, modo de recolha e destino, em toneladas."""
    return await service.scenario_flows(db, scenario_id)
