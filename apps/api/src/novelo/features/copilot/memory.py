"""Memória e orçamento de tokens do copiloto: janela por modelo, histórico, resumo das voltas antigas e digests."""

import json
import logging
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.openrouter import OpenRouterClient
from novelo.ai.catalog import ModelCatalog
from novelo.ai.prompts import load
from novelo.ai.tasks import AiTask
from novelo.core.config import get_settings
from novelo.core.errors import AiBudgetExceededError, FeatureDisabledError
from novelo.features.copilot.models import CopilotMessage, CopilotThread

log = logging.getLogger("novelo.copilot")

KEEP_RECENT_MESSAGES = 8  # últimas 4 voltas (utilizador + assistente) ficam intactas
DEFAULT_WINDOW = 128_000
IMAGE_TOKENS = 1500
TOOLS_SCHEMA_TOKENS = 3500


class _ThreadSummary(BaseModel):
    text: str = Field(min_length=10, max_length=1600)


def estimate_tokens(text: str) -> int:
    """Estimativa barata (~3,6 caracteres por token em pt/en). Só serve para decidir quando compactar."""
    return len(text) * 10 // 36 + 1


async def window_for(catalog: ModelCatalog, model: str) -> int:
    """Janela útil: o contexto do modelo no catálogo, limitado por `COPILOT_CONTEXT_CAP_TOKENS` (custo e latência)."""
    cap = get_settings().copilot_context_cap_tokens
    try:
        found = (await catalog.snapshot()).models.get(model)
    except Exception:  # catálogo em baixo: usa o valor por omissão
        found = None
    return min(found.context_length, cap) if found and found.context_length else min(DEFAULT_WINDOW, cap)


def message_text(m: CopilotMessage) -> str:
    return "\n".join(p.get("text", "") for p in m.parts if p.get("type") == "text").strip()


def attachment_notes(m: CopilotMessage) -> list[str]:
    return [
        f"[attachment id={p['id']} name={p.get('filename', '')!r} kind={p.get('kind', '')}]"
        for p in m.parts
        if p.get("type") == "attachment"
    ]


def history_messages(messages: list[CopilotMessage], summarized: int) -> list[dict[str, Any]]:
    """Mensagens ainda não resumidas, como o modelo as vê: texto e notas de anexos (id para `analyze_attachment`)."""
    out: list[dict[str, Any]] = []
    for m in messages[summarized:]:
        text = message_text(m)
        if m.role == "user":
            notes = attachment_notes(m)
            text = "\n".join([*notes, text]) if notes else text
        if text:
            out.append({"role": m.role, "content": text})
    return out


def recent_digests(messages: list[CopilotMessage], limit: int = 6) -> list[dict[str, Any]]:
    """Digests verificados dos resultados de ferramentas mais recentes (ids de cenários e KPIs principais)."""
    digests: list[dict[str, Any]] = []
    for m in reversed(messages):
        for t in reversed(m.tool_trace):
            if t.get("ok") and isinstance(t.get("digest"), dict):
                digests.append(t["digest"])
        if len(digests) >= limit:
            break
    return list(reversed(digests[:limit]))


def memo_block(thread: CopilotThread, digests: list[dict[str, Any]]) -> str:
    lines = []
    if thread.summary:
        lines.append(f"memo (older turns, summarised): {thread.summary}")
    if digests:
        lines.append("recent tool results (verified): " + json.dumps(digests, ensure_ascii=False, default=str))
    return "\n".join(lines)


def count_tokens(system: str, memo: str, history: list[dict[str, Any]], current: str, images: int = 0) -> int:
    body = sum(estimate_tokens(str(m["content"])) for m in history)
    return (
        estimate_tokens(system)
        + TOOLS_SCHEMA_TOKENS
        + estimate_tokens(memo)
        + body
        + estimate_tokens(current)
        + images * IMAGE_TOKENS
    )


def _fallback_summary(previous: str, old: list[CopilotMessage]) -> str:
    """Sem modelo: primeiras palavras de cada pergunta antiga. Perde detalhe, mas nunca inventa."""
    asked = [message_text(m)[:90] for m in old if m.role == "user" and message_text(m)]
    text = " | ".join(asked[-8:])
    return (f"{previous} || {text}" if previous else text)[:1500]


async def compact_thread(
    db: AsyncSession, llm: OpenRouterClient | None, thread: CopilotThread, *, force: bool = False
) -> int:
    """Resume as mensagens antigas em `thread.summary` e reduz os resultados de ferramentas a digests curtos.

    Mantém as últimas `KEEP_RECENT_MESSAGES` intactas. Devolve o nº de mensagens compactadas agora.
    """
    messages = list(
        (
            await db.execute(
                select(CopilotMessage).where(CopilotMessage.thread_id == thread.id).order_by(CopilotMessage.created_at)
            )
        )
        .scalars()
        .all()
    )
    keep = 2 if force else KEEP_RECENT_MESSAGES
    upto = max(thread.summarized_messages, len(messages) - keep)
    old = messages[thread.summarized_messages : upto]
    if not old:
        return 0
    payload = {
        "previous_memo": thread.summary,
        "messages": [
            {
                "role": m.role,
                "text": message_text(m)[:1200],
                "tools": [t.get("digest") for t in m.tool_trace if t.get("ok") and t.get("digest")][:6],
            }
            for m in old
        ],
    }
    summary = _fallback_summary(thread.summary, old)
    if llm is not None:
        system, _ = load("copilot_summary")
        try:
            out = await llm.structured(
                system=system,
                user=json.dumps(payload, ensure_ascii=False, default=str),
                schema=_ThreadSummary,
                task=AiTask.COPILOT_AUX,
            )
            summary = out.text
        except (AiBudgetExceededError, FeatureDisabledError):
            raise
        except Exception:
            log.info("thread summary falls back to a deterministic memo")
    thread.summary = summary
    thread.summarized_messages = upto
    for m in old:  # limpeza: os resultados de ferramentas antigos ficam só com o digest
        m.digested = True
        m.tool_trace = [{k: v for k, v in t.items() if k != "result"} for t in m.tool_trace]
    await db.commit()
    await db.refresh(thread)  # updated_at é calculado pela base de dados: lê-lo depois sem refresh faria I/O implícito
    return len(old)
