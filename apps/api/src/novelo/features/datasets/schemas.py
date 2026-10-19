import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from novelo.domain.vocab import AlertKind, AlertStatus


class DataSourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    title: str
    provider: str
    file_name: str
    file_sha256: str
    received_on: date | None
    period_start: date | None
    period_end: date | None
    notes: str | None
    imported_at: datetime


class DataAlertOut(BaseModel):
    id: uuid.UUID
    number: int
    kind: AlertKind
    detail: str = Field(description="Texto original da Vitrus (em português)")
    suggestion: str
    status: AlertStatus
    resolution_note: str | None
    resolved_at: datetime | None
    source_key: str


class AlertUpdate(BaseModel):
    status: AlertStatus
    resolution_note: str | None = Field(default=None, max_length=1000)


class DataQuality(BaseModel):
    sources: list[DataSourceOut]
    alerts: list[DataAlertOut]
    open_alerts: int


AlertAction = Literal["confirm_with_vitrus", "correct_data", "accept_as_is", "ignore"]


class FieldFix(BaseModel):
    field: str = Field(max_length=80)
    current_value: str | None = Field(default=None, max_length=200)
    proposed_value: str | None = Field(default=None, max_length=200, description="Só valores escritos no alerta")


class AlertSuggestion(BaseModel):
    """O que o modelo devolve: uma proposta. Nada é aplicado até uma pessoa a confirmar."""

    action: AlertAction
    suggested_status: AlertStatus
    justification: str = Field(max_length=500, description="Porquê esta ação (inglês, 1 a 3 frases)")
    fields_to_fix: list[FieldFix] = Field(default_factory=list, max_length=6)
    question_for_vitrus: str | None = Field(default=None, max_length=400, description="Em português")
    resolution_note: str = Field(max_length=300, description="Nota em português para guardar ao confirmar")
    confidence: float = Field(ge=0, le=1)


class AlertSuggestionOut(AlertSuggestion):
    alert_id: uuid.UUID
    source: Literal["model", "fallback"] = Field(description="fallback = regra determinística, sem IA")
    verified: bool = Field(description="Os números e os valores propostos existem no texto do alerta")
    applied: Literal[False] = Field(
        default=False, description="Sempre falso. Para aplicar: PATCH /datasets/alerts/{id} com suggested_status e nota"
    )
    prompt_version: str | None
    model: str | None
