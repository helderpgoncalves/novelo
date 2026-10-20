"""Limites do role `guest` (convidados do evento): IA, solver e orçamento de IA por convidado.

Dependências FastAPI para as rotas que gastam dinheiro ou CPU. Operadores e administradores passam sem limite
extra (têm os limites gerais de cada rota).
"""

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.config import get_settings
from novelo.core.database import get_db
from novelo.core.deps import CurrentUser
from novelo.core.errors import AiBudgetExceededError, ForbiddenError
from novelo.core.ratelimit import guest_ai_limiter, guest_solver_limiter
from novelo.features.ai_admin.models import AiUsage
from novelo.features.users.models import User


async def guest_ai_spent_usd(db: AsyncSession, user_id: object) -> float:
    since = datetime.now(UTC) - timedelta(hours=24)
    total = await db.scalar(
        select(func.coalesce(func.sum(AiUsage.cost_usd), 0)).where(
            AiUsage.user_id == user_id, AiUsage.created_at >= since
        )
    )
    return float(total or 0)


async def guest_ai_guard(user: CurrentUser, db: Annotated[AsyncSession, Depends(get_db)]) -> None:
    """Pedidos ao modelo por hora e gasto por convidado nas últimas 24 h."""
    if user.role != "guest":
        return
    s = get_settings()
    guest_ai_limiter.check(f"guest-ai:{user.id}", s.guest_ai_per_hour)
    if s.guest_ai_budget_usd and await guest_ai_spent_usd(db, user.id) >= s.guest_ai_budget_usd:
        raise AiBudgetExceededError("The guest AI allowance is used up")


async def guest_solver_guard(user: CurrentUser) -> None:
    """Execuções do otimizador por hora."""
    if user.role == "guest":
        guest_solver_limiter.check(f"guest-solver:{user.id}", get_settings().guest_solver_per_hour)


async def forbid_guest(user: CurrentUser) -> User:
    """Apagar dados não é permitido a convidados."""
    if user.role == "guest":
        raise ForbiddenError("Guests cannot delete data")
    return user


NotGuest = Annotated[User, Depends(forbid_guest)]
AiGuard = Depends(guest_ai_guard)
SolverGuard = Depends(guest_solver_guard)
