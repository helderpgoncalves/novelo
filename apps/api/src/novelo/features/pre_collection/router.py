"""Pré-recolha: rota pública do conselho «vai no saco?». Sem sessão e sem escrita na base de dados."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.openrouter import OpenRouterClient
from novelo.ai.images import MAX_BYTES
from novelo.core.database import get_db
from novelo.core.ratelimit import precheck_limiter
from novelo.features.pre_collection import precheck
from novelo.features.pre_collection.schemas import PreCollectionAdvice
from novelo.features.users.schemas import Locale

public_router = APIRouter()
Db = Annotated[AsyncSession, Depends(get_db)]


async def get_public_llm(db: Db) -> OpenRouterClient:
    """Cliente do OpenRouter sem sessão: a rota é pública e o uso fica registado sem utilizador."""
    from novelo.features.ai_admin.service import build_client  # noqa: PLC0415  (evita import circular)

    return await build_client(db, None)


@public_router.post(
    "/pre-collection/check",
    response_model=PreCollectionAdvice,
    dependencies=[Depends(precheck_limiter)],
)
async def check_pre_collection(
    llm: Annotated[OpenRouterClient, Depends(get_public_llm)],
    photo: Annotated[UploadFile, File(description="Foto da peça antes de a pôr no saco")],
    locale: Locale = "pt-PT",
) -> PreCollectionAdvice:
    """Aconselha quem prepara o saco: «vai no saco» ou «não vai». Não grava nada e não precisa de sessão."""
    try:
        return await precheck.check(llm, await photo.read(MAX_BYTES + 1), locale=locale)
    finally:
        await llm.aclose()
