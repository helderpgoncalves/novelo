"""Envio de email transacional via Resend. Sem RESEND_API_KEY escreve o email no log (dev)."""

import logging
from collections import deque
from typing import Protocol

import httpx

from novelo.core.config import Settings, get_settings
from novelo.core.errors import UpstreamError

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
            raise UpstreamError(f"Could not send the email: {exc}") from exc


DEV_OUTBOX: deque[dict[str, str]] = deque(maxlen=50)


class LogSender:
    """Dev: sem RESEND_API_KEY o email vai para o log da API e para a caixa de saída de desenvolvimento."""

    async def send(self, *, to: str, subject: str, html: str, text: str) -> None:
        log.info("EMAIL (sem RESEND_API_KEY) para=%s assunto=%s\n%s", to, subject, text)
        DEV_OUTBOX.append({"to": to, "subject": subject, "html": html, "text": text})


def get_email_sender() -> EmailSender:
    settings = get_settings()
    return ResendSender(settings) if settings.resend_api_key else LogSender()
