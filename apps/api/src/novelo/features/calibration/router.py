"""Painel «Calibração»: a tabela de agregados que o planeamento consome (leitura para a gestão).

Routers finos: a recomputação vive no serviço e só acontece ao recalcular um cenário — esta rota é
só leitura, e lê APENAS a tabela de agregados (nunca eventos individuais nem moradas).
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.core.deps import get_current_user
from novelo.features.calibration import service
from novelo.features.calibration.schemas import CalibrationOut
from novelo.features.users.models import User

router = APIRouter()
Db = Annotated[AsyncSession, Depends(get_db)]
Viewer = Annotated[User, Depends(get_current_user)]


@router.get("/calibration", response_model=CalibrationOut)
async def get_calibration(db: Db, user: Viewer) -> CalibrationOut:
    """O estado atual da calibração: por métrica e unidade, com n, rótulo, taxa corrente vs prior.

    Vazio até alguém recalcular um cenário (a recomputação é manual, nunca agendada — ADR: captura
    anual é derivada). A taxa de pedidos por freguesia está aqui como KPI de procura manifesta.
    """
    return service.panel_of_rows(await service.load_rows(db))
