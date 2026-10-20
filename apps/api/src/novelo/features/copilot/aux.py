"""Chamadas baratas à volta de uma resposta: título da conversa e sugestões de seguimento (com alternativa fixa)."""

import asyncio
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


TITLE_TIMEOUT_S = 8.0
_TITLE_MAX_WORDS = 8
_TITLE_MAX_CHARS = 60


def clean_title(raw: str) -> str | None:
    """Normaliza o título do modelo; `None` se não servir (vazio, longo, com números ou várias linhas)."""
    title = re.sub(r"\s+", " ", raw).strip().strip("\"'«»“”`*# ").rstrip(".!?;:… ").strip()
    if not title or len(title) > _TITLE_MAX_CHARS or re.search(r"\d", title):
        return None
    words = title.split(" ")
    if not 2 <= len(words) <= _TITLE_MAX_WORDS:
        return None
    return title[0].upper() + title[1:]


async def make_title(llm: OpenRouterClient, user_text: str) -> str | None:
    """Título criativo a partir da PRIMEIRA mensagem. `None` quando falha ou o resultado não é aceitável.

    O chamador mantém o título provisório nesse caso. O orçamento esgotado e a IA desligada também dão `None`:
    o título nunca pode estragar nem atrasar a resposta.
    """
    system, _ = load("copilot_title")
    try:
        out = await asyncio.wait_for(
            llm.structured(
                system=system,
                user=json.dumps({"first_message": user_text[:400]}, ensure_ascii=False),
                schema=_ThreadTitle,
                task=AiTask.COPILOT_AUX,
                retries=0,
            ),
            timeout=TITLE_TIMEOUT_S,
        )
    except (AiBudgetExceededError, FeatureDisabledError):
        return None
    except Exception:
        log.info("thread title falls back to the provisional one")
        return None
    return clean_title(out.title)


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
