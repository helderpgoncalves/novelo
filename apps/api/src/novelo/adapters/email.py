"""Envio de email transacional via Resend. Sem RESEND_API_KEY escreve o email no log (dev)."""

import logging
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


class LogSender:
    """Dev: o link de recuperação aparece no log da API (`just logs api`)."""

    async def send(self, *, to: str, subject: str, html: str, text: str) -> None:
        log.info("EMAIL (sem RESEND_API_KEY) para=%s assunto=%s\n%s", to, subject, text)


def get_email_sender() -> EmailSender:
    settings = get_settings()
    return ResendSender(settings) if settings.resend_api_key else LogSender()
