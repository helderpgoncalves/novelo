"""Histórico unificado do copiloto: conversas, ações, artefactos, memórias e anexos numa cronologia só."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from novelo.features.copilot.schemas_artifacts import Artifact

HistoryKind = Literal["conversation", "action", "artifact", "memory", "attachment"]


class HistoryItem(BaseModel):
    id: str
    kind: HistoryKind
    title: str
    snippet: str | None
    status: str | None
    occurred_at: datetime
    thread_id: uuid.UUID | None
    ref_id: uuid.UUID
    route: str | None = None


class HistoryPage(BaseModel):
    items: list[HistoryItem]
    next_cursor: str | None


class ArtifactOut(BaseModel):
    id: uuid.UUID
    title: str
    artifact_type: str
    thread_id: uuid.UUID | None
    message_id: uuid.UUID | None
    pinned: bool
    refreshable: bool
    created_at: datetime
    refreshed_at: datetime | None
    sources: list[dict[str, str | None]]
    artifact: Artifact


class ArtifactPage(BaseModel):
    items: list[ArtifactOut]
    next_cursor: str | None


class TimelineEvent(BaseModel):
    at: datetime
    kind: Literal["thread", "message", "tool", "memory", "attachment", "action", "artifact"]
    label: str
    detail: str | None = None
    ref_id: uuid.UUID | None = None
