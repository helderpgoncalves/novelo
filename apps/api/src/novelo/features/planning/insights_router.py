import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.core.deps import CurrentUser
from novelo.core.guest import SolverGuard
from novelo.domain.sensitivity import Criterion
from novelo.features.planning import benchmark_service, pilot_service, sensitivity_service
from novelo.features.planning.benchmark_schemas import BenchmarkOut, BenchmarkScenarioRequest
from novelo.features.planning.pilot_schemas import PilotOut, PilotRequest
from novelo.features.planning.schemas import ScenarioOut
from novelo.features.planning.sensitivity_schemas import RobustnessOut, SensitivityOut, SensitivityRequest

router = APIRouter()
Db = Annotated[AsyncSession, Depends(get_db)]


@router.post("/scenarios/{scenario_id}/sensitivity", response_model=SensitivityOut, dependencies=[SolverGuard])
async def run_scenario_sensitivity(scenario_id: uuid.UUID, body: SensitivityRequest, db: Db) -> SensitivityOut:
    """Tornado (±30% de cada parâmetro) e Monte Carlo (P10/P50/P90 de €/t e custo) sobre o plano do cenário."""
    return await sensitivity_service.scenario_sensitivity(db, scenario_id, body)


@router.get("/compare-robustness", response_model=RobustnessOut)
async def compare_scenario_robustness(
    db: Db,
    recommended_id: uuid.UUID,
    alternative_id: uuid.UUID,
    n_samples: Annotated[int, Query(ge=50, le=5000)] = 500,
    seed: int = 7,
    swing: Annotated[float, Query(ge=0.05, le=0.9)] = 0.3,
    criterion: Criterion = "eur_per_tonne",
    min_share: Annotated[float, Query(ge=0, le=1)] = 0.8,
) -> RobustnessOut:
    """Em que fração das amostras (emparelhadas) o cenário recomendado continua melhor que o alternativo."""
    return await sensitivity_service.compare_robustness(
        db,
        recommended_id,
        alternative_id,
        n_samples=n_samples,
        seed=seed,
        swing=swing,
        criterion=criterion,
        min_share=min_share,
    )


@router.get("/benchmarks", response_model=list[BenchmarkOut])
async def list_benchmarks(db: Db) -> list[BenchmarkOut]:
    """Cenários de referência externos, com pressupostos, fonte e o que implicam com os dados atuais."""
    return await benchmark_service.list_benchmarks(db)


@router.post("/benchmarks/{key}/scenario", response_model=ScenarioOut, status_code=201, dependencies=[SolverGuard])
async def create_benchmark_scenario(key: str, body: BenchmarkScenarioRequest, user: CurrentUser, db: Db) -> ScenarioOut:
    """Cria um cenário (como `create_scenario`) com a meta e a densidade do benchmark."""
    return await benchmark_service.create_benchmark_scenario(db, key, body, user)


@router.post("/pilot", response_model=PilotOut)
async def recommend_pilot(body: PilotRequest, db: Db) -> PilotOut:
    """Escolhe as freguesias do piloto de maior valor de aprendizagem e prevê os KPIs a medir."""
    return await pilot_service.recommend_pilot(db, body)
