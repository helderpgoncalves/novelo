"""Memória persistente do copiloto, ao estilo do Hermes Agent, adaptada a vários utilizadores em Postgres.

Duas memórias pequenas por utilizador, sempre presentes no prompt: `memory` (notas do copiloto) e `user` (perfil).
Entradas curtas; limites de caracteres; sem compactação automática (se passar do limite, erro e o modelo faz UM lote);
snapshot congelado por conversa; varrimento de segurança; aprovação opcional das escritas.
"""

import difflib
import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Literal

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.config import get_settings
from novelo.features.copilot import security
from novelo.features.copilot.models import CopilotMemoryEntry, CopilotMemoryPending
from novelo.features.copilot.tables import fold

log = logging.getLogger("novelo.copilot.memory")

Target = Literal["memory", "user"]
SEP = "\n§\n"
MAX_ENTRY_CHARS = 600


def limit_for(target: str) -> int:
    s = get_settings()
    return s.copilot_memory_char_limit if target == "memory" else s.copilot_user_char_limit


def total_chars(entries: list[str]) -> int:
    return sum(len(e) for e in entries) + (len(SEP) * (len(entries) - 1) if entries else 0)


def usage_text(used: int, limit: int) -> str:
    return f"{used:,}/{limit:,}".replace(",", " ")


@dataclass
class MemoryOp:
    action: Literal["add", "patch", "remove"]
    content: str = ""
    old_text: str = ""


class MemoryError_(Exception):
    """Falha de validação de um lote: a mensagem e os dados voltam ao modelo para ele corrigir."""

    def __init__(self, payload: dict[str, Any]) -> None:
        super().__init__(payload.get("error", "memory error"))
        self.payload = payload


@dataclass
class Plan:
    entries: list[tuple[uuid.UUID | None, str]]  # estado final: (id existente ou None se nova, texto)
    removed: list[uuid.UUID]
    patched: dict[uuid.UUID, tuple[str, str]]  # id -> (antes, depois)
    added: list[str]
    skipped_duplicates: int


async def load_entries(db: AsyncSession, user_id: uuid.UUID, target: str) -> list[CopilotMemoryEntry]:
    q = (
        select(CopilotMemoryEntry)
        .where(CopilotMemoryEntry.user_id == user_id, CopilotMemoryEntry.target == target)
        .order_by(CopilotMemoryEntry.created_at, CopilotMemoryEntry.id)
    )
    return list((await db.execute(q)).scalars().all())


def _closest(entries: list[str], needle: str) -> list[str]:
    return sorted(entries, key=lambda e: -difflib.SequenceMatcher(None, fold(needle), fold(e)).ratio())[:3]


def _scan_or_raise(text: str) -> None:
    if not text or len(text) > MAX_ENTRY_CHARS:
        raise MemoryError_({"error": f"An entry must have 1 to {MAX_ENTRY_CHARS} characters"})
    try:
        security.scan(text)
    except security.Blocked as exc:
        raise MemoryError_({"error": "blocked_by_security", "reason": security.EXPLANATION[exc.reason]}) from exc


class _Batch:
    """Estado de um lote a ser aplicado em memória (nada toca na base de dados até o lote inteiro ser válido)."""

    def __init__(self, rows: list[CopilotMemoryEntry]) -> None:
        self.state: list[tuple[uuid.UUID | None, str]] = [(r.id, r.content) for r in rows]
        self.originals = {r.id: r.content for r in rows}
        self.removed: list[uuid.UUID] = []
        self.patched: dict[uuid.UUID, tuple[str, str]] = {}
        self.added: list[str] = []
        self.dupes = 0

    def texts(self) -> list[str]:
        return [t for _, t in self.state]

    def add(self, op: MemoryOp) -> None:
        content = op.content.strip()
        _scan_or_raise(content)
        if content in self.texts():
            self.dupes += 1
            return
        self.state.append((None, content))
        self.added.append(content)

    def find(self, op: MemoryOp) -> int:
        needle = op.old_text.strip()
        texts = self.texts()
        exact = [i for i, t in enumerate(texts) if t == needle]
        hits = exact if len(exact) == 1 else [i for i, t in enumerate(texts) if needle and needle in t]
        if len(hits) != 1:
            why = "matches no entry" if not hits else "matches several entries; use a longer, unique old_text"
            raise MemoryError_({"error": f"old_text {why}", "closest_entries": _closest(texts, needle)})
        return hits[0]

    def remove(self, op: MemoryOp) -> None:
        entry_id, text = self.state.pop(self.find(op))
        if entry_id is not None:
            self.removed.append(entry_id)
        else:
            self.added.remove(text)

    def patch(self, op: MemoryOp) -> None:
        idx = self.find(op)
        entry_id, text = self.state[idx]
        needle = op.old_text.strip()
        if text.count(needle) != 1:
            raise MemoryError_({"error": "old_text appears more than once in that entry; add surrounding text"})
        new_text = text.replace(needle, op.content.strip(), 1).strip()
        _scan_or_raise(new_text)
        self.state[idx] = (entry_id, new_text)
        if entry_id is not None:
            self.patched[entry_id] = (self.patched.get(entry_id, (self.originals[entry_id], ""))[0], new_text)
        else:
            self.added[self.added.index(text)] = new_text


def plan_ops(rows: list[CopilotMemoryEntry], ops: list[MemoryOp], limit: int) -> Plan:
    """Aplica o lote em memória. Tudo ou nada: o limite verifica-se só no resultado final do lote."""
    batch = _Batch(rows)
    for op in ops:
        {"add": batch.add, "patch": batch.patch, "remove": batch.remove}[op.action](op)
    used = total_chars(batch.texts())
    if used > limit:
        over = used - limit
        raise MemoryError_(
            {
                "error": f"Memory would be {usage_text(used, limit)} chars, over the limit by {over}. Retry as ONE 'operations' "
                f"batch that removes or shortens (patch) stale entries from current_entries to free at least {over} chars "
                "AND applies this change; the limit is checked only on the batch result.",
                "current_entries": [r.content for r in rows],
                "usage": usage_text(sum(len(r.content) for r in rows), limit),
            }
        )
    return Plan(batch.state, batch.removed, batch.patched, batch.added, batch.dupes)


async def commit_plan(
    db: AsyncSession, user_id: uuid.UUID, target: str, plan: Plan, origin: str, thread_id: uuid.UUID | None
) -> list[tuple[uuid.UUID, str]]:
    """Grava o lote e devolve as entradas criadas (id, texto)."""
    if plan.removed:
        await db.execute(delete(CopilotMemoryEntry).where(CopilotMemoryEntry.id.in_(plan.removed)))
    for entry_id, (_before, after) in plan.patched.items():
        row = await db.get(CopilotMemoryEntry, entry_id)
        if row is not None:
            row.content, row.search_text = after, fold(after)
    created: list[tuple[uuid.UUID, str]] = []
    for content in plan.added:
        row = CopilotMemoryEntry(
            created_at=datetime.now(UTC),
            user_id=user_id,
            target=target,
            content=content,
            origin=origin,
            source_thread_id=thread_id,
            search_text=fold(content),
        )
        db.add(row)
        await db.flush()
        created.append((row.id, content))
    await db.commit()
    return created


def summarize_ops(target: str, ops: list[MemoryOp]) -> str:
    parts = []
    for op in ops:
        if op.action == "add":
            parts.append(f"+ {op.content[:120]}")
        elif op.action == "patch":
            parts.append(f"~ «{op.old_text[:60]}» → «{op.content[:80]}»")
        else:
            parts.append(f"- «{op.old_text[:80]}»")
    return f"[{target}] " + " | ".join(parts)


async def stage(
    db: AsyncSession, user_id: uuid.UUID, target: str, ops: list[MemoryOp], origin: str, thread_id: uuid.UUID | None
) -> CopilotMemoryPending:
    row = CopilotMemoryPending(
        user_id=user_id,
        target=target,
        ops=[{"action": o.action, "content": o.content, "old_text": o.old_text} for o in ops],
        summary=summarize_ops(target, ops),
        origin=origin,
        source_thread_id=thread_id,
        status="pending",
    )
    db.add(row)
    await db.commit()
    return row


def ops_from_json(raw: list[dict[str, Any]]) -> list[MemoryOp]:
    return [MemoryOp(action=o["action"], content=o.get("content", ""), old_text=o.get("old_text", "")) for o in raw]


def render_block(target: str, entries: list[str]) -> str:
    """Bloco para o prompt: cabeçalho com uso (%, caracteres) e entradas separadas por §."""
    limit = limit_for(target)
    used = total_chars(entries)
    pct = round(used / limit * 100) if limit else 0
    title = "MEMORY (your notes)" if target == "memory" else "USER PROFILE"
    head = f"[{title} · {pct}% · {usage_text(used, limit)}]"
    return f"{head}\n{SEP.join(entries)}"


async def render_snapshot(db: AsyncSession, user_id: uuid.UUID, *, memory_on: bool, user_on: bool) -> dict[str, str]:
    out: dict[str, str] = {}
    for target, on in (("memory", memory_on), ("user", user_on)):
        entries = [r.content for r in await load_entries(db, user_id, target)] if on else []
        if entries:  # blocos vazios não gastam tokens nem puxam o idioma da resposta
            out[target] = render_block(target, entries)
    return out


async def usage_meters(db: AsyncSession, user_id: uuid.UUID) -> dict[str, dict[str, int]]:
    meters = {}
    for target in ("memory", "user"):
        used = total_chars([r.content for r in await load_entries(db, user_id, target)])
        limit = limit_for(target)
        meters[target] = {"chars": used, "limit": limit, "pct": round(used / limit * 100) if limit else 0}
    return meters
