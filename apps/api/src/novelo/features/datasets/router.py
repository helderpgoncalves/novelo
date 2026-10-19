import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.openrouter import OpenRouterClient
from novelo.core.database import get_db
from novelo.core.deps import CurrentUser
from novelo.core.ratelimit import alerts_limiter
from novelo.features.datasets import ai, service
from novelo.features.datasets.schemas import AlertSuggestionOut, AlertUpdate, DataAlertOut, DataQuality
from novelo.features.lots.router import get_llm

router = APIRouter()
Db = Annotated[AsyncSession, Depends(get_db)]
Llm = Annotated[OpenRouterClient, Depends(get_llm)]


@router.get("/quality", response_model=DataQuality)
async def get_data_quality(db: Db) -> DataQuality:
    """Fontes de dados recebidas (com proveniência) e inconsistências a confirmar com a Vitrus."""
    return await service.get_quality(db)


@router.patch("/alerts/{alert_id}", response_model=DataAlertOut)
async def update_data_alert(alert_id: uuid.UUID, body: AlertUpdate, user: CurrentUser, db: Db) -> DataAlertOut:
    """Marca uma inconsistência como resolvida, ignorada ou volta a abri-la."""
    return await service.update_alert(db, alert_id, body, user)


@router.post("/alerts/{alert_id}/suggest", response_model=AlertSuggestionOut, dependencies=[Depends(alerts_limiter)])
async def suggest_alert_resolution(alert_id: uuid.UUID, db: Db, llm: Llm) -> AlertSuggestionOut:
    """A IA propõe como resolver o alerta (ação, justificação, campos a corrigir). Não aplica nada:
    quem confirma usa `PATCH /alerts/{id}` com o estado e a nota sugeridos."""
    try:
        return await ai.suggest(db, llm, alert_id)
    finally:
        await llm.aclose()
