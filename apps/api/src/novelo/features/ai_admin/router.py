from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.openrouter import OpenRouterClient
from novelo.ai.catalog import ModelCatalog, get_catalog
from novelo.ai.eval_triage import TriageEvalReport
from novelo.ai.tasks import AiTask
from novelo.core.database import get_db
from novelo.core.deps import require_role
from novelo.features.ai_admin import service
from novelo.features.ai_admin.schemas import (
    AiCreditsOut,
    AiModelsOut,
    AiSettingsOut,
    AiSettingsUpdate,
    AiUsageOut,
    ModelSort,
    TestModelOut,
    TestModelRequest,
)
from novelo.features.lots.router import get_llm
from novelo.features.users.models import User

router = APIRouter()  # prefixo /ai; todas as rotas são só para administradores
Db = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[User, Depends(require_role("admin"))]
Catalog = Annotated[ModelCatalog, Depends(get_catalog)]
Llm = Annotated[OpenRouterClient, Depends(get_llm)]
Capability = Literal["image", "tools", "structured_outputs"]


@router.get("/settings", response_model=AiSettingsOut)
async def get_ai_settings(_: Admin, db: Db) -> AiSettingsOut:
    """Configuração de IA por tarefa: modelo, reserva, tokens e raciocínio efetivos, com a origem de cada valor."""
    return await service.get_settings_out(db)


@router.put("/settings", response_model=AiSettingsOut)
async def update_ai_settings(body: AiSettingsUpdate, admin: Admin, db: Db, catalog: Catalog) -> AiSettingsOut:
    """Grava a configuração. Cada modelo tem de existir no catálogo e suportar o que as suas tarefas exigem."""
    return await service.update_settings(db, body, admin, catalog)


@router.get("/models", response_model=AiModelsOut)
async def list_ai_models(
    _: Admin,
    db: Db,
    catalog: Catalog,
    task: AiTask | None = None,
    capability: Annotated[list[Capability] | None, Query()] = None,
    q: Annotated[str | None, Query(max_length=80)] = None,
    sort: ModelSort = "name",
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> AiModelsOut:
    """Catálogo do OpenRouter (cache de 1 h). Com `task`, só modelos compatíveis e o custo por operação dessa tarefa."""
    return await service.list_models(
        db, catalog, task=task, capability=list(capability or []), q=q, sort=sort, limit=limit
    )


@router.get("/usage", response_model=AiUsageOut)
async def get_ai_usage(_: Admin, db: Db, days: Annotated[int, Query(ge=1, le=365)] = 30) -> AiUsageOut:
    """Chamadas, tokens, custo e latência por dia, tarefa e modelo; custo do mês contra o orçamento."""
    return await service.usage_report(db, days)


@router.get("/credits", response_model=AiCreditsOut)
async def get_ai_credits(_: Admin, llm: Llm) -> AiCreditsOut:
    """Saldo e limite da chave no OpenRouter. Se o fornecedor não responder, `available` é falso."""
    try:
        return await service.credits(llm)
    finally:
        await llm.aclose()


@router.post("/test", response_model=TestModelOut)
async def test_ai_model(body: TestModelRequest, _: Admin, llm: Llm, catalog: Catalog) -> TestModelOut:
    """Uma chamada mínima ao modelo: devolve latência e custo reais (conta para o orçamento)."""
    try:
        return await service.test_model(llm, catalog, body.model, body.task)
    finally:
        await llm.aclose()


@router.get("/eval/triage", response_model=TriageEvalReport)
async def get_triage_eval(_: Admin) -> TriageEvalReport:
    """Última avaliação da triagem por modelo (exatidão, custo e latência), gerada por `just eval-triage`."""
    return service.triage_eval()
