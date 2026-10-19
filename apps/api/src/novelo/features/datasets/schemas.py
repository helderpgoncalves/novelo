import uuid
from datetime import date, datetime

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
