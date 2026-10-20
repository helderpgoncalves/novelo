"""Envio de email transacional via Resend. Em desenvolvimento, sem RESEND_API_KEY, o email vai para o log (dev).

Em produção NUNCA se escreve o corpo nem os links de um email nos logs: sem chave o envio responde 503.
`send()` devolve o id do fornecedor (ou `None`), que fica em `email_deliveries` para o webhook e a reconciliação.
"""

import logging
import uuid
from collections import deque
from typing import Protocol

import httpx

from novelo.core.config import Settings, get_settings
from novelo.core.errors import EmailUnavailableError, UpstreamError

log = logging.getLogger(__name__)
RESEND_URL = "https://api.resend.com/emails"


class EmailSendError(UpstreamError):
    """O fornecedor não aceitou o email. `error_code` é curto e sem segredos; `transient` = vale a pena repetir."""

    def __init__(self, error_code: str, *, transient: bool, retry_after_s: float | None = None) -> None:
        super().__init__("Could not send the email")
        self.error_code = error_code
        self.transient = transient
        self.retry_after_s = retry_after_s


class EmailSender(Protocol):
    async def send(
        self, *, to: str, subject: str, html: str, text: str, idempotency_key: str | None = None
    ) -> str | None: ...


class EmailStatusReader(Protocol):
    """Consulta o estado de um envio no fornecedor (precisa de uma chave de leitura)."""

    @property
    def configured(self) -> bool: ...

    async def last_event(self, provider_message_id: str) -> str | None: ...


MAX_RETRY_AFTER_S = 5.0


def _retry_after(raw: str | None) -> float | None:
    try:
        value = float(raw) if raw else None
    except ValueError:
        return None
    return None if value is None or value < 0 else min(value, MAX_RETRY_AFTER_S)


def classify_status(status: int, name: str = "", message: str = "", retry_after: str | None = None) -> EmailSendError:  # noqa: PLR0911
    """Traduz a resposta do Resend num código curto. `name`/`message` só servem para decidir: nunca são guardados."""
    name, message = name.lower(), message.lower()
    if status == 429 and "quota" in name:
        return EmailSendError("quota_exceeded", transient=False)
    if status == 429:
        return EmailSendError("rate_limited", transient=True, retry_after_s=_retry_after(retry_after))
    if status >= 500:
        return EmailSendError("provider_down", transient=True, retry_after_s=_retry_after(retry_after))
    if "domain" in message and ("verif" in message or "not found" in message):
        return EmailSendError("domain_not_verified", transient=False)
    if status in (401, 403):
        return EmailSendError("provider_auth", transient=False)
    if status in (400, 422) and (
        name == "invalid_to_address" or "recipient" in message or "to address" in message or "`to`" in message
    ):
        return EmailSendError("invalid_recipient", transient=False)
    return EmailSendError(f"provider_{status}", transient=False)


class ResendSender:
    def __init__(
        self,
        settings: Settings,
        transport: httpx.AsyncBaseTransport | None = None,
        timeout_s: float | None = None,
    ) -> None:
        self._s = settings
        self._transport = transport
        self._timeout = timeout_s if timeout_s is not None else settings.email_send_timeout_s

    async def send(
        self, *, to: str, subject: str, html: str, text: str, idempotency_key: str | None = None
    ) -> str | None:
        payload: dict[str, object] = {
            "from": self._s.email_from,
            "to": [to],
            "subject": subject,
            "html": html,
            "text": text,
            "reply_to": self._s.email_reply_to_effective,
        }
        headers = {"Authorization": f"Bearer {self._s.resend_api_key}"}
        if idempotency_key:
            # Um reenvio de rede com a mesma chave nunca duplica o email; o ref-id evita threading errado no Gmail.
            headers["Idempotency-Key"] = idempotency_key
            payload["headers"] = {"X-Entity-Ref-ID": idempotency_key}
        try:
            async with httpx.AsyncClient(timeout=self._timeout, transport=self._transport) as http:
                resp = await http.post(RESEND_URL, json=payload, headers=headers)
        except httpx.TimeoutException as exc:
            log.warning("Resend falhou: timeout")
            raise EmailSendError("timeout", transient=True) from exc
        except httpx.HTTPError as exc:
            log.warning("Resend falhou: %s", exc.__class__.__name__)  # sem URL nem corpo
            raise EmailSendError("network", transient=True) from exc
        if resp.status_code >= 400:
            name = message = ""
            try:
                body = resp.json()
                name, message = str(body.get("name", "")), str(body.get("message", ""))
            except (ValueError, AttributeError):
                pass
            err = classify_status(resp.status_code, name, message, resp.headers.get("retry-after"))
            log.warning("Resend recusou o email: HTTP %s (%s)", resp.status_code, err.error_code)
            raise err
        try:
            value = resp.json().get("id")
        except (ValueError, AttributeError):
            return None
        return value if isinstance(value, str) and value else None


class ResendReader:
    """`GET /emails/{id}` com a chave de leitura (acesso total: guardada só no servidor, nunca registada)."""

    def __init__(
        self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None, timeout_s: float = 4.0
    ) -> None:
        self._key = settings.resend_read_api_key
        self._transport = transport
        self._timeout = timeout_s

    @property
    def configured(self) -> bool:
        return bool(self._key)

    async def last_event(self, provider_message_id: str) -> str | None:
        if not self._key:
            return None
        try:
            async with httpx.AsyncClient(timeout=self._timeout, transport=self._transport) as http:
                resp = await http.get(
                    f"{RESEND_URL}/{provider_message_id}", headers={"Authorization": f"Bearer {self._key}"}
                )
        except httpx.HTTPError as exc:
            log.warning("Resend (leitura) falhou: %s", exc.__class__.__name__)
            return None
        if resp.status_code != 200:
            log.warning("Resend (leitura) respondeu HTTP %s", resp.status_code)
            return None
        try:
            value = resp.json().get("last_event")
        except (ValueError, AttributeError):
            return None
        return value if isinstance(value, str) else None


DEV_OUTBOX: deque[dict[str, str]] = deque(maxlen=50)


class LogSender:
    """Dev (sem chave ou EMAIL_TRANSPORT=log): o email vai para o log da API e para a caixa de saída de dev."""

    async def send(
        self, *, to: str, subject: str, html: str, text: str, idempotency_key: str | None = None
    ) -> str | None:
        log.info("EMAIL (sem RESEND_API_KEY) para=%s assunto=%s\n%s", to, subject, text)
        DEV_OUTBOX.append({"to": to, "subject": subject, "html": html, "text": text})
        return f"dev-{uuid.uuid4()}"


class UnavailableSender:
    """Produção sem chave do Resend (ou com `EMAIL_TRANSPORT=log`): recusa em vez de despejar links nos logs."""

    async def send(
        self, *, to: str, subject: str, html: str, text: str, idempotency_key: str | None = None
    ) -> str | None:
        raise EmailUnavailableError("Email delivery is not configured")


def warn_if_email_unavailable() -> None:
    """No arranque em produção: avisa quando não há como enviar emails."""
    s = get_settings()
    if s.environment == "production" and (s.email_transport == "log" or not s.resend_api_key):
        log.warning("RESEND_API_KEY em falta em produção: os emails NÃO são enviados (nem escritos no log)")
    elif s.environment == "production" and not s.webhook_configured:
        log.warning("RESEND_WEBHOOK_SECRET em falta: só se sabe que o Resend aceitou os emails, não se foram entregues")


def get_email_sender() -> EmailSender:
    settings = get_settings()
    if settings.email_transport == "log" or not settings.resend_api_key:
        return LogSender() if settings.environment == "development" else UnavailableSender()
    return ResendSender(settings)


def get_email_status_reader() -> EmailStatusReader:
    return ResendReader(get_settings())
