import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.openrouter import OpenRouterClient
from novelo.core.database import get_db
from novelo.core.deps import CurrentUser
from novelo.core.ratelimit import whatif_limiter
from novelo.features.lots.router import get_llm
from novelo.features.planning import whatif_service as service
from novelo.features.planning.whatif_schemas import WhatIfOut, WhatIfRequest
from novelo.features.users.schemas import Locale

router = APIRouter()
Db = Annotated[AsyncSession, Depends(get_db)]
Llm = Annotated[OpenRouterClient, Depends(get_llm)]


@router.post("", response_model=WhatIfOut, status_code=201, dependencies=[Depends(whatif_limiter)])
async def ask_what_if(body: WhatIfRequest, user: CurrentUser, db: Db, llm: Llm) -> WhatIfOut:
    """Passo 1: o modelo percebe a pergunta e descreve a alteração. Nada é calculado até o utilizador confirmar."""
    try:
        return await service.propose(db, llm, user, body)
    finally:
        await llm.aclose()


@router.post("/{run_id}/apply", response_model=WhatIfOut, dependencies=[Depends(whatif_limiter)])
async def apply_what_if(run_id: uuid.UUID, user: CurrentUser, db: Db, llm: Llm, locale: Locale = "pt-PT") -> WhatIfOut:
    """Passo 2: corre o otimizador com a alteração confirmada e explica o resultado, com números verificados."""
    try:
        return await service.apply(db, llm, user, run_id, locale)
    finally:
        await llm.aclose()


@router.get("", response_model=list[WhatIfOut])
async def list_what_ifs(scenario_id: uuid.UUID, db: Db) -> list[WhatIfOut]:
    """Perguntas feitas sobre um cenário (histórico auditável)."""
    return await service.list_runs(db, scenario_id)
