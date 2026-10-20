"""Definições do utilizador, memória (memory/user), pesquisa de sessões e personalidade do copiloto."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

MemoryTarget = Literal["memory", "user"]
PersonaKey = Literal["default", "analyst", "mentor", "executive", "storyteller", "custom"]


class CopilotSettings(BaseModel):
    """O que cada utilizador controla. Modelos, orçamento e retenção máxima são do sistema (/admin/ai e .env)."""

    memory_enabled: bool = Field(default=True, description="Notas do copiloto (memory) ligadas")
    user_profile_enabled: bool = Field(default=True, description="Perfil do utilizador (user) ligado")
    write_approval: Literal["auto", "ask"] = Field(
        default="auto", description="ask: as escritas de memória ficam em fila"
    )
    memory_notifications: Literal["off", "on", "verbose"] = "on"
    background_review: bool = Field(default=True, description="Revisão automática da memória depois de algumas voltas")
    persona: PersonaKey = "default"
    persona_text: str = Field(default="", max_length=1500, description="Texto da personalidade personalizada")
    verbosity: Literal["short", "balanced", "detailed"] = "balanced"
    formality: Literal["informal", "neutral", "formal"] = "neutral"
    emoji: bool = False
    preferred_language: Literal["auto", "pt-PT", "en"] = "auto"
    show_tool_steps: bool = True
    follow_up_suggestions: bool = True
    auto_compact_pct: int = Field(default=65, ge=50, le=90)
    save_history: bool = Field(default=True, description="Falso: conversas efémeras, apagadas ao fim de 24 h")
    retention_days: Literal[30, 90, 365] | None = Field(
        default=None, description="Nulo = sem limite (até ao máximo do sistema)"
    )
    web_search: Literal["auto", "off"] = Field(
        default="auto",
        description="auto: o copiloto pesquisa na web só quando o assunto é externo ao Novelo; off: nunca (`/websearch off`)",
    )
    confirm_writes: bool = Field(default=False, description="Pedir confirmação antes de criar cenários ou relatórios")
    auto_approve_low_risk: bool = Field(
        default=False, description="Executar sozinhas as ações reversíveis de baixo risco"
    )


class MemoryMeter(BaseModel):
    chars: int
    limit: int
    pct: int


class PersonaInfo(BaseModel):
    key: PersonaKey
    label_pt: str
    label_en: str
    description: str


class CopilotSettingsOut(CopilotSettings):
    memory_usage: dict[str, MemoryMeter] = Field(description="Uso da memória por alvo: memory e user")
    max_retention_days: int | None = Field(description="Máximo imposto pelo sistema; nulo = sem máximo")
    effective_retention_days: int | None
    web_search_available: bool = Field(
        description="O sistema oferece pesquisa na web a este utilizador (flag, região, papel)"
    )
    web_search_unavailable_reason: Literal["disabled_by_system", "region", "guest"] | None = None
    personas: list[PersonaInfo]
    default_persona: PersonaKey


class MemoryEntryOut(BaseModel):
    id: uuid.UUID
    target: MemoryTarget
    content: str
    origin: Literal["auto", "manual", "tool"]
    pinned: bool
    source_thread_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class MemoryEntryCreate(BaseModel):
    target: MemoryTarget
    content: str = Field(min_length=3, max_length=600)
    pinned: bool = False


class MemoryEntryUpdate(BaseModel):
    content: str | None = Field(default=None, min_length=3, max_length=600)
    pinned: bool | None = None


class MemoryEntryList(BaseModel):
    items: list[MemoryEntryOut]
    usage: dict[str, MemoryMeter]


class PendingMemoryOut(BaseModel):
    id: uuid.UUID
    target: MemoryTarget
    summary: str
    ops: list[dict[str, str]]
    origin: Literal["auto", "manual", "tool"]
    source_thread_id: uuid.UUID | None
    status: Literal["pending", "approved", "rejected"]
    created_at: datetime


class PendingApprove(BaseModel):
    content: str | None = Field(
        default=None, min_length=3, max_length=600, description="Editar o texto antes de aprovar um `add`"
    )


class SessionHit(BaseModel):
    thread_id: uuid.UUID
    thread_title: str
    message_id: uuid.UUID
    role: Literal["user", "assistant"]
    snippet: str
    occurred_at: datetime


class SessionSearchOut(BaseModel):
    query: str
    hits: list[SessionHit]
    total: int


class PersonaPreviewIn(BaseModel):
    persona: PersonaKey
    persona_text: str = Field(default="", max_length=1500)
    verbosity: Literal["short", "balanced", "detailed"] = "balanced"
    formality: Literal["informal", "neutral", "formal"] = "neutral"
    emoji: bool = False
    language: Literal["pt-PT", "en"] = "pt-PT"
    sample: str = Field(default="Explica-me o que é a captura de têxtil.", min_length=3, max_length=200)


class PersonaPreviewOut(BaseModel):
    text: str
    persona: PersonaKey
