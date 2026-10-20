"""Envio de email transacional via Resend. Em desenvolvimento, sem RESEND_API_KEY, o email vai para o log (dev).

Em produção NUNCA se escreve o corpo nem os links de um email nos logs: sem chave o envio responde 503."""

import logging
from collections import deque
from typing import Protocol

import httpx

from novelo.core.config import Settings, get_settings
from novelo.core.errors import FeatureDisabledError, UpstreamError

log = logging.getLogger(__name__)
RESEND_URL = "https://api.resend.com/emails"


class EmailSender(Protocol):
    async def send(self, *, to: str, subject: str, html: str, text: str) -> None: ...


class ResendSender:
    def __init__(self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._s = settings
        self._transport = transport

    async def send(self, *, to: str, subject: str, html: str, text: str) -> None:
        payload = {
            "from": self._s.email_from,
            "to": [to],
            "subject": subject,
            "html": html,
            "text": text,
        }
        headers = {"Authorization": f"Bearer {self._s.resend_api_key}"}
        try:
            async with httpx.AsyncClient(timeout=10, transport=self._transport) as http:
                resp = await http.post(RESEND_URL, json=payload, headers=headers)
                resp.raise_for_status()
        except httpx.HTTPError as exc:
            log.warning("Resend falhou: %s", exc.__class__.__name__)  # sem URL nem corpo
            raise UpstreamError("Could not send the email") from exc


DEV_OUTBOX: deque[dict[str, str]] = deque(maxlen=50)


class LogSender:
    """Dev (sem chave ou EMAIL_TRANSPORT=log): o email vai para o log da API e para a caixa de saída de dev."""

    async def send(self, *, to: str, subject: str, html: str, text: str) -> None:
        log.info("EMAIL (sem RESEND_API_KEY) para=%s assunto=%s\n%s", to, subject, text)
        DEV_OUTBOX.append({"to": to, "subject": subject, "html": html, "text": text})


class UnavailableSender:
    """Produção sem chave do Resend (ou com `EMAIL_TRANSPORT=log`): recusa em vez de despejar links nos logs."""

    async def send(self, *, to: str, subject: str, html: str, text: str) -> None:
        raise FeatureDisabledError("Email delivery is not configured")


def warn_if_email_unavailable() -> None:
    """No arranque em produção: avisa quando não há como enviar emails."""
    s = get_settings()
    if s.environment == "production" and (s.email_transport == "log" or not s.resend_api_key):
        log.warning("RESEND_API_KEY em falta em produção: os emails NÃO são enviados (nem escritos no log)")


def get_email_sender() -> EmailSender:
    settings = get_settings()
    if settings.email_transport == "log" or not settings.resend_api_key:
        return LogSender() if settings.environment == "development" else UnavailableSender()
    return ResendSender(settings)
