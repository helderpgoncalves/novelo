import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.core.deps import CurrentUser
from novelo.features.datasets import service
from novelo.features.datasets.schemas import AlertUpdate, DataAlertOut, DataQuality

router = APIRouter()
Db = Annotated[AsyncSession, Depends(get_db)]


@router.get("/quality", response_model=DataQuality)
async def get_data_quality(db: Db) -> DataQuality:
    """Fontes de dados recebidas (com proveniência) e inconsistências a confirmar com a Vitrus."""
    return await service.get_quality(db)


@router.patch("/alerts/{alert_id}", response_model=DataAlertOut)
async def update_data_alert(alert_id: uuid.UUID, body: AlertUpdate, user: CurrentUser, db: Db) -> DataAlertOut:
    """Marca uma inconsistência como resolvida, ignorada ou volta a abri-la."""
    return await service.update_alert(db, alert_id, body, user)
