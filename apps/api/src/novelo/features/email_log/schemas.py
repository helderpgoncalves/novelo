import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from novelo.features.email_log.models import DeliveryStatus, EmailTemplate

DeliveryStatusOrNone = Literal[
    "queued", "sent", "delivered", "delayed", "bounced", "complained", "failed", "skipped", "none"
]
DeliveryTracking = Literal["api+webhook", "webhook", "api", "provider_accepted_only"]
EmailAlertKind = Literal[
    "provider_not_configured",
    "provider_auth_invalid",
    "domain_not_verified",
    "failures_last_hour",
    "high_failure_rate",
    "webhook_silent",
    "no_admin_recipients",
]
SuppressionReasonOut = Literal["bounced", "complained", "manual"]
DnsStatus = Literal["ok", "warn", "fail", "unknown"]
EmailHealth = Literal["ok", "not_configured", "failing"]


class EmailDeliveryOut(BaseModel):
    """Um envio. Só metadados: o assunto, o corpo e os links nunca são guardados."""

    id: uuid.UUID
    to_email: str
    to_name: str | None = Field(
        default=None, description="Nome da pessoa se existir uma conta com este email; nulo caso contrário"
    )
    template: EmailTemplate
    status: DeliveryStatus = Field(
        description="`sent` = o Resend aceitou (não é entregue); `delivered` só com webhook ou chave de leitura"
    )
    error_code: str | None = Field(description="Código curto da falha (`timeout`, `provider_5xx`, `not_configured`...)")
    attempts: int
    user_id: uuid.UUID | None
    invitation_id: uuid.UUID | None
    provider_message_id: str | None = Field(description="Para procurar o email em resend.com/emails")
    created_at: datetime
    sent_at: datetime | None
    delivered_at: datetime | None
    updated_at: datetime


class EmailDeliveryPage(BaseModel):
    items: list[EmailDeliveryOut]
    total: int
    offset: int
    limit: int


class StatusCounts(BaseModel):
    queued: int = 0
    sent: int = 0
    delivered: int = 0
    delayed: int = 0
    bounced: int = 0
    complained: int = 0
    failed: int = 0
    skipped: int = 0
    total: int = 0


class FailureCount(BaseModel):
    error_code: str
    count: int


class EmailSummary(BaseModel):
    provider_configured: bool = Field(description="Há um fornecedor real (Resend com chave) para enviar")
    webhook_configured: bool = Field(description="`RESEND_WEBHOOK_SECRET` definido: o Resend pode confirmar entregas")
    read_key_configured: bool = Field(description="`RESEND_READ_API_KEY` definida: o estado pode ser consultado")
    delivery_tracking: DeliveryTracking = Field(
        description="O que sabemos: `provider_accepted_only` = só que o Resend aceitou o email"
    )
    last_24h: StatusCounts
    last_7d: StatusCounts
    last_failure_at: datetime | None
    failures_last_hour: int
    success_rate_24h_pct: float | None = Field(
        description="Aceites pelo Resend / (aceites + falhados + ressaltados) nas últimas 24 h; nulo sem envios"
    )
    failures_by_error_code: list[FailureCount] = Field(description="Falhas e ressaltos das últimas 24 h por código")
    avg_delivery_delay_s: float | None = Field(description="Atraso médio entre o envio e a entrega (24 h)")
    unconfirmed: int = Field(
        description="Em `sent` há mais de 15 min sem confirmação do webhook; 0 se não há como confirmar"
    )
    alerts: list[EmailAlertKind] = Field(description="Alertas ativos (o UI mostra um banner)")


class EmailTestResult(BaseModel):
    delivery: EmailDeliveryOut


class DnsCheck(BaseModel):
    key: Literal["dkim", "spf", "return_path", "dmarc"]
    status: DnsStatus
    detail: str = Field(description="Código curto do que foi encontrado (`found`, `missing`, `policy_none`...)")
    hint: str = Field(description="O que fazer, em inglês (o web traduz a partir de `key` e `detail`)")


class EmailDnsHealth(BaseModel):
    domain: str = Field(description="Domínio do EMAIL_FROM")
    checked_at: datetime
    overall: DnsStatus
    checks: list[DnsCheck]


class SuppressionOut(BaseModel):
    id: uuid.UUID
    to_email: str
    reason: SuppressionReasonOut
    source_delivery_id: uuid.UUID | None
    created_at: datetime


class SuppressionCreate(BaseModel):
    email: str = Field(min_length=3, max_length=255)


class SuppressionPage(BaseModel):
    items: list[SuppressionOut]
    total: int


class EmailRefreshOut(BaseModel):
    checked: int = Field(description="Envios consultados no fornecedor")
    updated: int = Field(description="Envios cujo estado mudou")
    delivery_tracking: DeliveryTracking


class WebhookAck(BaseModel):
    status: Literal["updated", "ignored"]


class EmailWarning(BaseModel):
    """O email da ação não saiu: a ação foi feita, mas a pessoa pode não ter sido avisada."""

    code: Literal["email_failed", "email_skipped"]
    template: EmailTemplate
    error_code: str | None


class ApprovalEmailOut(BaseModel):
    """O email que avisa a pessoa do pedido (pendentes) ou da decisão (aprovada/recusada)."""

    status: DeliveryStatusOrNone
    template: EmailTemplate | None
    at: datetime | None
    error_code: str | None
