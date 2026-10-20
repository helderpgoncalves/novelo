"""Introdução guiada: estado por conta (vale em todos os dispositivos) e checklist «Primeiros passos».

«Correr um cenário» e «perguntar ao copiloto» deduzem-se dos dados (cenário criado pela pessoa, conversa sua); o resto
(`map`) é marcado pelo cliente. O estado vive em `users.onboarding_state` = `{"done": [...], "dismissed": bool}`.
"""

from datetime import UTC, datetime
from typing import cast, get_args

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.features.copilot.models import CopilotThread
from novelo.features.planning.models import Scenario
from novelo.features.users.models import User
from novelo.features.users.schemas import ChecklistItem, OnboardingOut, OnboardingUpdate

_ITEMS: tuple[str, ...] = get_args(ChecklistItem)


async def build(db: AsyncSession, user: User) -> OnboardingOut:
    state = user.onboarding_state or {}
    done = {i for i in state.get("done", []) if i in _ITEMS}
    if await db.scalar(select(exists().where(Scenario.created_by_id == user.id))):
        done.add("scenario")
    if await db.scalar(select(exists().where(CopilotThread.user_id == user.id))):
        done.add("copilot")
    return OnboardingOut(
        tour_seen_at=user.onboarding_seen_at,
        checklist_done=cast(list[ChecklistItem], [i for i in _ITEMS if i in done]),
        checklist_dismissed=bool(state.get("dismissed", False)),
    )


async def update(db: AsyncSession, user: User, body: OnboardingUpdate) -> OnboardingOut:
    state = dict(user.onboarding_state or {})
    if body.tour == "seen" and user.onboarding_seen_at is None:
        user.onboarding_seen_at = datetime.now(UTC)
    elif body.tour == "reset":
        user.onboarding_seen_at = None
    if body.mark is not None:
        done = [i for i in state.get("done", []) if i in _ITEMS]
        if body.mark not in done:
            done.append(body.mark)
        state["done"] = done
    if body.checklist_dismissed is not None:
        state["dismissed"] = body.checklist_dismissed
    user.onboarding_state = state  # nova referência: o SQLAlchemy só persiste JSON se o objeto mudar
    await db.commit()
    return await build(db, user)
