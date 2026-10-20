"""Revisão da memória em segundo plano: depois de algumas voltas, um passo barato propõe 0-3 operações.

Passa pelos mesmos controlos que o modelo principal (limites, segurança, aprovação). É idempotente: só olha para as
mensagens novas desde a última revisão e não corre em conversas efémeras.
"""

import json
import logging
import re
import uuid
from typing import Literal

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.openrouter import OpenRouterClient
from novelo.ai.prompts import load
from novelo.ai.tasks import AiTask
from novelo.core.config import get_settings
from novelo.core.errors import AiBudgetExceededError, FeatureDisabledError
from novelo.features.copilot import memory_service, memory_store
from novelo.features.copilot.memory import message_text
from novelo.features.copilot.models import CopilotMessage, CopilotThread
from novelo.features.copilot.schemas import CopilotMemoryEvent
from novelo.features.copilot.schemas_memory import CopilotSettings

log = logging.getLogger("novelo.copilot.review")
_CUE = re.compile(
    r"\b(lembra-te|lembra|remember|prefiro|prefer|sempre que|always|esquece|forget|a partir de agora)\b", re.IGNORECASE
)


class ReviewOp(BaseModel):
    target: Literal["memory", "user"]
    action: Literal["add", "patch", "remove"]
    content: str = Field(default="", max_length=400)
    old_text: str = Field(default="", max_length=300)


class _MemoryReview(BaseModel):
    operations: list[ReviewOp] = Field(default_factory=list, max_length=3)


def due(settings: CopilotSettings, thread: CopilotThread, messages: list[CopilotMessage]) -> bool:
    if (
        thread.ephemeral
        or not settings.background_review
        or not (settings.memory_enabled or settings.user_profile_enabled)
    ):
        return False
    users = [m for m in messages if m.role == "user"]
    new = [m for m in users if m.created_at and messages.index(m) >= thread.reviewed_upto]
    if not new:
        return False
    return len(new) >= get_settings().copilot_review_every_turns or bool(_CUE.search(message_text(new[-1])))


async def run(
    db: AsyncSession,
    llm: OpenRouterClient,
    user_id: uuid.UUID,
    thread: CopilotThread,
    settings: CopilotSettings,
    messages: list[CopilotMessage],
    answer: str = "",
) -> list[CopilotMemoryEvent]:
    events: list[CopilotMemoryEvent] = []
    entries = {t: [r.content for r in await memory_store.load_entries(db, user_id, t)] for t in ("memory", "user")}
    payload = {
        "memory": entries["memory"],
        "user": entries["user"],
        "usage": {
            t: memory_store.usage_text(memory_store.total_chars(entries[t]), memory_store.limit_for(t)) for t in entries
        },
        "latest_messages": [
            *[{"role": m.role, "text": message_text(m)[:500]} for m in messages[-8:]],
            *([{"role": "assistant", "text": answer[:500]}] if answer else []),
        ],
    }
    system, _ = load("memory_review")
    try:
        out = await llm.structured(
            system=system,
            user=json.dumps(payload, ensure_ascii=False),
            schema=_MemoryReview,
            task=AiTask.COPILOT_AUX,
            retries=0,
        )
    except (AiBudgetExceededError, FeatureDisabledError):
        raise
    except Exception:
        log.info("memory review skipped (model unavailable)")
        out = _MemoryReview()
    for target in ("memory", "user"):
        ops = [memory_store.MemoryOp(o.action, o.content, o.old_text) for o in out.operations if o.target == target]
        if ops:
            result = await memory_service.apply(db, user_id, settings, target, ops, origin="auto", thread_id=thread.id)
            events += result.events
            if not result.ok:
                log.info(
                    "memory review batch rejected target=%s reason=%s", target, str(result.payload.get("error"))[:80]
                )
    thread.reviewed_upto = len(messages) + (1 if answer else 0)
    await db.commit()
    return events
