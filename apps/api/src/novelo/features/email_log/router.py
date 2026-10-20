import json
import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.dns import DnsResolver, get_dns_resolver
from novelo.adapters.email import EmailSender, EmailStatusReader, get_email_sender, get_email_status_reader
from novelo.core.config import get_settings
from novelo.core.database import get_db
from novelo.core.deps import require_role
from novelo.core.errors import AppError
from novelo.core.ratelimit import email_refresh_limiter, email_test_limiter, webhook_limiter
from novelo.core.request_meta import Meta
from novelo.features.audit import service as audit
from novelo.features.email_log import dns_health, monitor, service, webhook
from novelo.features.email_log.models import DeliveryStatus, EmailTemplate
from novelo.features.email_log.schemas import (
    EmailDeliveryOut,
    EmailDeliveryPage,
    EmailDnsHealth,
    EmailRefreshOut,
    EmailSummary,
    SuppressionCreate,
    SuppressionOut,
    SuppressionPage,
    WebhookAck,
)
from novelo.features.users.models import User

Db = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[User, Depends(require_role("admin"))]
Sender = Annotated[EmailSender, Depends(get_email_sender)]
Reader = Annotated[EmailStatusReader, Depends(get_email_status_reader)]
Dns = Annotated[DnsResolver, Depends(get_dns_resolver)]

webhook_router = APIRouter()
admin_router = APIRouter()


@webhook_router.post("/resend", response_model=WebhookAck, dependencies=[Depends(webhook_limiter)])
async def receive_resend_webhook(request: Request, db: Db) -> WebhookAck:
    """Eventos do Resend (sent, delivered, delivery_delayed, bounced, complained, failed). Sem sessão: a autenticação
    é a assinatura Svix (`svix-id`, `svix-timestamp`, `svix-signature`) sobre o corpo bruto. Sem
    `RESEND_WEBHOOK_SECRET` responde 503. Idempotente; eventos desconhecidos respondem 200 `ignored`."""
    secret = get_settings().resend_webhook_secret
    declared = request.headers.get("content-length", "0")
    if declared.isdigit() and int(declared) > webhook.MAX_BODY_BYTES:
        raise AppError("Request body too large")
    body = await request.body()
    if len(body) > webhook.MAX_BODY_BYTES:
        raise AppError("Request body too large")
    webhook.verify_signature(
        secret,
        message_id=request.headers.get("svix-id"),
        timestamp=request.headers.get("svix-timestamp"),
        signature=request.headers.get("svix-signature"),
        body=body,
    )
    try:
        event: Any = json.loads(body)
        kind = str(event.get("type", ""))
        data = event.get("data") or {}
        provider_id = str(data.get("email_id", ""))
        bounce = data.get("bounce") or {}
        bounce_type = str(bounce.get("type")) if isinstance(bounce, dict) and bounce.get("type") else None
    except (ValueError, AttributeError):
        return WebhookAck(status="ignored")
    if kind not in service.EVENT_STATUS or not provider_id:
        return WebhookAck(status="ignored")
    changed = await service.apply_event(db, provider_id, kind, bounce_type)
    return WebhookAck(status="updated" if changed else "ignored")


@admin_router.get("", response_model=EmailDeliveryPage)
async def list_emails(
    _: Admin,
    db: Db,
    reader: Reader,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    status: DeliveryStatus | None = None,
    template: EmailTemplate | None = None,
    q: Annotated[str | None, Query(max_length=100, description="Procura no email do destinatário")] = None,
) -> EmailDeliveryPage:
    """Envios de email (só metadados, sem corpos), do mais recente. Sincroniza o estado com o Resend se houver chave."""
    await monitor.reconcile(db, reader)
    return await monitor.list_deliveries(db, offset=offset, limit=limit, status=status, template=template, q=q)


@admin_router.get("/summary", response_model=EmailSummary)
async def get_email_summary(admin: Admin, db: Db, reader: Reader, sender: Sender) -> EmailSummary:
    """Contagens por estado (24 h e 7 dias), taxa de sucesso, falhas por código, o que sabemos da entrega
    (`delivery_tracking`) e os alertas ativos. Pode enviar, no máximo de 6 em 6 h, o email de alerta."""
    await monitor.reconcile(db, reader)
    await monitor.admin_tick(db, sender)
    return await monitor.summary(db)


@admin_router.get("/health", response_model=EmailDnsHealth)
async def get_email_dns_health(_: Admin, dns: Dns) -> EmailDnsHealth:
    """Verifica SPF, DKIM, return-path e DMARC do domínio do EMAIL_FROM (cache de 10 min)."""
    return await dns_health.check(dns)


@admin_router.post("/refresh", response_model=EmailRefreshOut)
async def refresh_email_status(admin: Admin, db: Db, reader: Reader) -> EmailRefreshOut:
    """«Atualizar estado»: consulta o Resend sobre os envios por confirmar (precisa de `RESEND_READ_API_KEY`)."""
    email_refresh_limiter.check(f"email-refresh:{admin.id}")
    result = await monitor.reconcile(db, reader, force=True)
    return EmailRefreshOut(
        checked=result.checked, updated=result.updated, delivery_tracking=monitor.tracking_mode(reader)
    )


@admin_router.post("/test", response_model=EmailDeliveryOut)
async def send_test_email(admin: Admin, db: Db, sender: Sender, meta: Meta) -> EmailDeliveryOut:
    """Envia um email de teste ao próprio administrador (3 por hora) e devolve o registo; consulta
    `GET /users/emails/{id}` para ver `sent` passar a `delivered`."""
    email_test_limiter.check(f"email-test:{admin.id}")
    out = await monitor.send_test(db, sender, admin)
    await audit.record_by(
        db,
        admin,
        "email.test",
        meta=meta,
        target_type="email",
        target_id=out.id,
        target_label=admin.email,
        details={"status": out.status, "error_code": out.error_code},
    )
    await db.commit()
    return out


@admin_router.get("/suppressions", response_model=SuppressionPage)
async def list_email_suppressions(
    _: Admin, db: Db, q: Annotated[str | None, Query(max_length=100)] = None
) -> SuppressionPage:
    """Endereços que não recebem emails (ressalto permanente, queixa de spam ou bloqueio manual)."""
    return await monitor.list_suppressions(db, q)


@admin_router.post("/suppressions", response_model=SuppressionOut, status_code=201)
async def create_email_suppression(body: SuppressionCreate, admin: Admin, db: Db, meta: Meta) -> SuppressionOut:
    """Bloqueia manualmente um endereço (`reason=manual`). 409 se já estiver bloqueado. Auditado."""
    row = await monitor.add_suppression(db, body.email)
    await audit.record_by(
        db, admin, "email.suppress", meta=meta, target_type="email", target_id=row.id, target_label=row.to_email
    )
    await db.commit()
    return monitor.suppression_out(row)


@admin_router.delete("/suppressions/{suppression_id}", status_code=204)
async def delete_email_suppression(suppression_id: uuid.UUID, admin: Admin, db: Db, meta: Meta) -> Response:
    """Volta a permitir emails para o endereço. Auditado."""
    row = await monitor.remove_suppression(db, suppression_id)
    await audit.record_by(
        db,
        admin,
        "email.unsuppress",
        meta=meta,
        target_type="email",
        target_id=suppression_id,
        target_label=row.to_email,
        details={"was": row.reason},
    )
    await db.commit()
    return Response(status_code=204)


@admin_router.get("/{delivery_id}", response_model=EmailDeliveryOut)
async def get_email(delivery_id: uuid.UUID, _: Admin, db: Db) -> EmailDeliveryOut:
    """Um envio (para acompanhar o email de teste até `delivered`)."""
    return await monitor.get_delivery(db, delivery_id)
