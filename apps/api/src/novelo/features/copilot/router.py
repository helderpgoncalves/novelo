from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.openrouter import OpenRouterClient
from novelo.core.database import get_db
from novelo.core.deps import CurrentUser
from novelo.core.ratelimit import copilot_limiter
from novelo.features.copilot import service
from novelo.features.copilot.schemas import CopilotReply, CopilotRequest
from novelo.features.lots.router import get_llm

router = APIRouter()  # prefixo /copilot
Db = Annotated[AsyncSession, Depends(get_db)]
Llm = Annotated[OpenRouterClient, Depends(get_llm)]


async def _per_user_limit(user: CurrentUser) -> None:
    copilot_limiter.check(f"copilot:{user.id}")


@router.post("/chat", response_model=CopilotReply, dependencies=[Depends(_per_user_limit)])
async def copilot_chat(body: CopilotRequest, user: CurrentUser, db: Db, llm: Llm) -> CopilotReply:
    """Conversa em pt-PT/en. O modelo escolhe ferramentas; os números do texto são verificados contra os resultados."""
    try:
        return await service.chat(db, llm, user, body)
    finally:
        await llm.aclose()
