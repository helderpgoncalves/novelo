"""Limites do role `guest` (convidados do evento): IA, solver e orçamento de IA por convidado.

Dependências FastAPI para as rotas que gastam dinheiro ou CPU. Operadores e administradores passam sem limite
extra (têm os limites gerais de cada rota).
"""

import threading
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.config import get_settings
from novelo.core.database import get_db
from novelo.core.deps import CurrentUser
from novelo.core.errors import AiBudgetExceededError, ForbiddenError, RateLimitError
from novelo.core.ratelimit import guest_ai_limiter, guest_solver_limiter, pdf_user_limiter, solver_user_limiter
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


async def guests_ai_spent_usd(db: AsyncSession) -> float:
    """Gasto de IA de TODOS os convidados nas últimas 24 h (teto global do evento)."""
    since = datetime.now(UTC) - timedelta(hours=24)
    total = await db.scalar(
        select(func.coalesce(func.sum(AiUsage.cost_usd), 0))
        .join(User, User.id == AiUsage.user_id)
        .where(User.role == "guest", AiUsage.created_at >= since)
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
    if s.guest_ai_global_budget_usd and await guests_ai_spent_usd(db) >= s.guest_ai_global_budget_usd:
        raise AiBudgetExceededError("The event AI allowance is used up")


class Slots:
    """Concorrência máxima de trabalho caro neste processo. Sem fila: quando está cheio, recusa (429)."""

    def __init__(self, size: Callable[[], int]) -> None:
        self._size, self._busy, self._lock = size, 0, threading.Lock()

    def acquire(self) -> bool:
        with self._lock:
            if self._busy >= self._size():
                return False
            self._busy += 1
            return True

    def release(self) -> None:
        with self._lock:
            self._busy = max(self._busy - 1, 0)

    @property
    def busy(self) -> int:
        return self._busy


solver_slots = Slots(lambda: get_settings().solver_max_concurrency)
pdf_slots = Slots(lambda: get_settings().pdf_max_concurrency)


@contextmanager
def solver_budget(user: User) -> Iterator[None]:
    """Gasta uma execução do otimizador (CPU): por utilizador e minuto, por hora para convidados, e concorrência global.

    Usa-se à volta do cálculo a sério, para que um resultado servido da cache não gaste o limite de ninguém.
    """
    s = get_settings()
    if user.role == "guest":
        guest_solver_limiter.check(f"guest-solver:{user.id}", s.guest_solver_per_hour)
    solver_user_limiter.check(f"solver:{user.id}", s.solver_runs_per_minute)
    if not solver_slots.acquire():
        raise RateLimitError("The server is busy running other simulations. Try again in a few seconds.")
    try:
        yield
    finally:
        solver_slots.release()


def solver_guard(user: CurrentUser) -> Iterator[None]:
    """Otimizador (CPU) como dependência de uma rota: ver `solver_budget`."""
    with solver_budget(user):
        yield


def pdf_guard(user: CurrentUser) -> Iterator[None]:
    """Geração de PDF (CPU e memória): por utilizador e por minuto, e concorrência global."""
    pdf_user_limiter.check(f"pdf:{user.id}", get_settings().solver_runs_per_minute)
    if not pdf_slots.acquire():
        raise RateLimitError("The server is busy generating other reports. Try again in a few seconds.")
    try:
        yield
    finally:
        pdf_slots.release()


async def forbid_guest(user: CurrentUser) -> User:
    """Convidados são só de leitura nos dados partilhados (apagar, criar, alterar)."""
    if user.role == "guest":
        raise ForbiddenError("Guests cannot change shared data")
    return user


NotGuest = Annotated[User, Depends(forbid_guest)]
NotGuestDep = Depends(forbid_guest)
AiGuard = Depends(guest_ai_guard)
SolverGuard = Depends(solver_guard)
PdfGuard = Depends(pdf_guard)
