import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from novelo.features.users.schemas import Locale


class ReportRequest(BaseModel):
    scenario_ids: list[uuid.UUID] = Field(min_length=1, max_length=3, description="1 a 3 cenários a incluir")
    locale: Locale = "pt-PT"


class ReportOut(BaseModel):
    id: uuid.UUID
    title: str
    locale: Locale
    scenario_ids: list[uuid.UUID]
    size_bytes: int
    sha256: str
    created_at: datetime
