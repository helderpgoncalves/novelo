"""Rotas dos pontos: saldo e histórico do doador, anulação em abuso para a equipa.

Routers finos — as regras estão no serviço. O saldo e o histórico são do PRÓPRIO (papel `donor` é o
portão, como no resto da área do cidadão); a anulação é de equipa (`admin`/`operator`), com motivo
obrigatório e trilha de auditoria. Lotes e passaportes continuam sem qualquer dado de doador.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.core.deps import require_role
from novelo.core.ratelimit import donor_bags_limiter
from novelo.core.request_meta import Meta
from novelo.features.points import service
from novelo.features.points.schemas import AnnulmentCreate, PointEntryOut, PointsBalanceOut, PointsHistoryOut
from novelo.features.users.models import User

router = APIRouter()
Db = Annotated[AsyncSession, Depends(get_db)]

# A área do doador: o papel é o portão (conta de cidadão, só o que é dele).
Donor = Annotated[User, Depends(require_role("donor"))]
# Anulação em abuso: decisão de equipa (interesse legítimo declarado, ADR RGPD da conta).
Team = Annotated[User, Depends(require_role("admin", "operator"))]


@router.get("/cidadao/saldo", response_model=PointsBalanceOut, dependencies=[Depends(donor_bags_limiter)])
async def get_donor_points_balance(user: Donor, db: Db) -> PointsBalanceOut:
    """O saldo de pontos do próprio, derivado do livro-razão (FIFO 12 meses): repartição flat/bónus,
    o que expira brevemente e o estado do teto mensal — valores configuráveis são «estimativa» no web."""
    return await service.balance(db, user.id)


@router.get("/cidadao/pontos", response_model=PointsHistoryOut, dependencies=[Depends(donor_bags_limiter)])
async def list_donor_points(
    user: Donor,
    db: Db,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PointsHistoryOut:
    """O livro-razão do próprio, o mais recente primeiro, paginado: cada ganho com o saco e o lote que
    o originou, cada anulação com o motivo — auditável, mas sem sair da conta."""
    return await service.history(db, user.id, limit=limit, offset=offset)


@router.post("/admin/points/annulments", response_model=PointEntryOut, status_code=201)
async def create_points_annulment(body: AnnulmentCreate, user: Team, db: Db, meta: Meta) -> PointEntryOut:
    """Anular pontos em abuso (interesse legítimo declarado): entrada NEGATIVA com motivo OBRIGATÓRIO
    no livro-razão — nunca se apaga nem se edita linha. Fica na trilha de auditoria com o autor."""
    return await service.annul(db, user.id, body, meta)
