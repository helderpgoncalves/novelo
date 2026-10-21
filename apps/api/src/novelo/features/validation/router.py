from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.features.validation import service
from novelo.features.validation.schemas import ModelValidationOut

router = APIRouter()
Db = Annotated[AsyncSession, Depends(get_db)]


@router.get("/model", response_model=ModelValidationOut)
async def get_model_validation(db: Db) -> ModelValidationOut:
    """O que se pode testar do modelo com os dados de hoje: triangulação do potencial e validação cruzada espacial."""
    return await service.model_validation(db)
