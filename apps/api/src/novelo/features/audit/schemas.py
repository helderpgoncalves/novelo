import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AuditEntryOut(BaseModel):
    id: uuid.UUID
    created_at: datetime
    action: str = Field(description="Ex.: `invitation.create`, `user.delete`, `impersonation.start`")
    actor_id: uuid.UUID | None = Field(description="Pessoa real; nulo se a conta foi eliminada")
    actor_name: str | None
    actor_email: str | None
    effective_actor_id: uuid.UUID | None = Field(
        description="Conta em nome de quem agiu; difere de `actor_id` durante uma impersonação"
    )
    effective_actor_name: str | None
    effective_actor_email: str | None
    target_type: str | None = Field(description="`user`, `invitation` ou `request`")
    target_id: str | None
    target_label: str | None = Field(description="Email do alvo; apagado se o alvo for eliminado")
    ip: str | None
    user_agent: str | None
    details: dict[str, Any] = Field(description="Contexto sem segredos (papel anterior, motivo, caminho...)")


class AuditPage(BaseModel):
    items: list[AuditEntryOut]
    total: int
    offset: int
    limit: int
