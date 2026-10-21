import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class AppSettingsOut(BaseModel):
    open_registration: bool = Field(
        description=(
            "Registo aberto: quem se regista (password ou Google) ou entra com a conta por aprovar fica logo aprovado, "
            "com o papel por omissão (`operator`). Contas recusadas e emails já recusados nunca"
        )
    )
    pending_approvals: int = Field(description="Contas à espera de aprovação neste momento")
    updated_at: datetime | None = Field(description="Última alteração; nulo = nunca alterado (valores por omissão)")
    updated_by_id: uuid.UUID | None


class AppSettingsUpdate(BaseModel):
    open_registration: bool | None = Field(default=None, description="Omitido = mantém")
    approve_pending: bool = Field(
        default=False,
        description=(
            "Aprova também agora as contas `pending` (só com o registo aberto; 409 se ficar fechado). Os emails já "
            "recusados ficam à espera. Auditado por conta"
        ),
    )


class AppSettingsUpdated(AppSettingsOut):
    approved_pending: int = Field(description="Contas pendentes aprovadas por `approve_pending`")
    skipped_previously_rejected: int = Field(
        description="Contas pendentes que ficaram à espera porque o email já foi recusado antes"
    )
