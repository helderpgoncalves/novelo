"""Definições do copiloto por utilizador (valores por omissão + diferenças gravadas)."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.config import get_settings
from novelo.core.errors import AppError
from novelo.features.copilot import memory_store, persona, security
from novelo.features.copilot.models import CopilotUserSettings
from novelo.features.copilot.schemas_memory import CopilotSettings, CopilotSettingsOut, MemoryMeter


class InvalidSettingError(AppError):
    status_code = 400
    code = "bad_request"


async def load(db: AsyncSession, user_id: uuid.UUID) -> CopilotSettings:
    row = (
        await db.execute(select(CopilotUserSettings).where(CopilotUserSettings.user_id == user_id))
    ).scalar_one_or_none()
    return CopilotSettings.model_validate(row.values if row else {})


def effective_retention(settings: CopilotSettings) -> int | None:
    system = get_settings().copilot_max_retention_days or None
    own = settings.retention_days
    if own and system:
        return min(own, system)
    return own or system


async def out(db: AsyncSession, user_id: uuid.UUID, settings: CopilotSettings | None = None) -> CopilotSettingsOut:
    s = settings or await load(db, user_id)
    meters = {k: MemoryMeter(**v) for k, v in (await memory_store.usage_meters(db, user_id)).items()}
    return CopilotSettingsOut(
        **s.model_dump(),
        memory_usage=meters,
        max_retention_days=get_settings().copilot_max_retention_days or None,
        effective_retention_days=effective_retention(s),
        personas=persona.catalog(),
        default_persona=get_settings().copilot_default_persona,
    )


async def save(db: AsyncSession, user_id: uuid.UUID, new: CopilotSettings) -> CopilotSettingsOut:
    if new.persona == "custom" and new.persona_text.strip():
        try:
            persona.check_custom_text(new.persona_text)
        except security.Blocked as exc:
            raise InvalidSettingError(f"The custom persona was refused: {security.EXPLANATION[exc.reason]}") from exc
    row = (
        await db.execute(select(CopilotUserSettings).where(CopilotUserSettings.user_id == user_id))
    ).scalar_one_or_none()
    defaults = CopilotSettings().model_dump()
    diff = {k: v for k, v in new.model_dump().items() if defaults[k] != v}
    if row is None:
        db.add(CopilotUserSettings(user_id=user_id, values=diff))
    else:
        row.values = diff
    await db.commit()
    return await out(db, user_id, new)
