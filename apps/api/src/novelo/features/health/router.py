from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.config import get_settings
from novelo.core.database import get_db
from novelo.features.email_log.monitor import email_health
from novelo.features.email_log.schemas import EmailHealth

router = APIRouter()


class Health(BaseModel):
    status: Literal["ok"] = "ok"


class Readiness(BaseModel):
    status: Literal["ok", "degraded"]
    database: bool
    llm_enabled: bool
    email: EmailHealth = Field(
        description="`not_configured`: sem fornecedor de email em produção; `failing`: 3 ou mais falhas na última hora"
    )


@router.get("/health", response_model=Health)
def health() -> Health:
    """Liveness: o processo responde. Usado pelo healthcheck do Docker/Coolify."""
    return Health()


@router.get("/ready", response_model=Readiness)
async def ready(db: Annotated[AsyncSession, Depends(get_db)]) -> Readiness:
    """Readiness: a base de dados responde e diz se a IA está ligada."""
    email: EmailHealth = "ok"
    try:
        await db.execute(text("SELECT 1"))
        database = True
        email = await email_health(db)
    except Exception:
        database = False
    return Readiness(
        status="ok" if database else "degraded",
        database=database,
        llm_enabled=get_settings().llm_enabled,
        email=email,
    )
