"""Chamadas baratas à volta de uma resposta: título da conversa e sugestões de seguimento (com alternativa fixa)."""

import json
import logging
import re
from typing import Any

from pydantic import BaseModel, Field

from novelo.adapters.openrouter import OpenRouterClient
from novelo.ai.prompts import load
from novelo.ai.tasks import AiTask
from novelo.ai.verify import unsupported_rounded
from novelo.core.errors import AiBudgetExceededError, FeatureDisabledError

log = logging.getLogger("novelo.copilot")


class _ThreadTitle(BaseModel):
    title: str = Field(min_length=2, max_length=80)


class _Suggestions(BaseModel):
    items: list[str] = Field(min_length=1, max_length=5)


FALLBACK_SUGGESTIONS = {
    "pt-PT": [
        "Compara com outro cenário",
        "Qual é a cobertura atual?",
        "E se mudarmos uma freguesia para recolha a pedido?",
    ],
    "en": [
        "Compare with another scenario",
        "What is the current coverage?",
        "What if we switch one parish to on-demand?",
    ],
}


def first_message_title(user_text: str) -> str:
    """O título da conversa é a primeira mensagem do utilizador (sem chamar o modelo), cortada em fronteira de palavra."""
    text = re.sub(r"\s+", " ", user_text).strip()
    if len(text) <= 60:
        return text or "Conversa"
    return text[:60].rsplit(" ", 1)[0].rstrip(".,;:!?") + "…"


def fallback_title(user_text: str) -> str:
    words = re.sub(r"\s+", " ", user_text).strip().split(" ")
    return (" ".join(words[:7]).rstrip(".,;:!?") or "Conversa")[:80]


async def make_title(llm: OpenRouterClient, user_text: str, answer: str) -> str:
    system, _ = load("copilot_title")
    try:
        out = await llm.structured(
            system=system,
            user=json.dumps({"user": user_text[:400], "assistant": answer[:400]}, ensure_ascii=False),
            schema=_ThreadTitle,
            task=AiTask.COPILOT_AUX,
            retries=0,
        )
        title = out.title.strip().strip('"«»').rstrip(".")
        return title if title and not re.search(r"\d", title) else fallback_title(user_text)
    except (AiBudgetExceededError, FeatureDisabledError):
        raise
    except Exception:
        return fallback_title(user_text)


async def make_suggestions(
    llm: OpenRouterClient, locale: str, user_text: str, answer: str, tools: list[str]
) -> list[str]:
    system, _ = load("copilot_suggestions")
    payload: dict[str, Any] = {"language": locale, "user": user_text[:400], "assistant": answer[:500], "tools": tools}
    try:
        out = await llm.structured(
            system=system,
            user=json.dumps(payload, ensure_ascii=False),
            schema=_Suggestions,
            task=AiTask.COPILOT_AUX,
            retries=0,
        )
        items = [i.strip() for i in out.items if i.strip() and len(i) <= 90 and not unsupported_rounded(i, {})]
        if items:
            return items[:3]
    except (AiBudgetExceededError, FeatureDisabledError):
        raise
    except Exception:
        log.info("suggestions fall back to the fixed list")
    return FALLBACK_SUGGESTIONS.get(locale, FALLBACK_SUGGESTIONS["pt-PT"])[:3]
