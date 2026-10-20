"""Cloudflare Turnstile: valida o token do widget no servidor (siteverify). Cada token só vale uma vez."""

import logging
from dataclasses import dataclass, field
from typing import Protocol

import httpx

from novelo.core.config import get_settings

log = logging.getLogger(__name__)
SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


class TurnstileUnavailableError(Exception):
    """A Cloudflare não respondeu a tempo ou devolveu um erro de servidor."""


@dataclass(frozen=True)
class TurnstileResult:
    success: bool
    hostname: str = ""
    action: str = ""
    error_codes: list[str] = field(default_factory=list)


class TurnstileVerifier(Protocol):
    async def verify(self, token: str, remote_ip: str | None) -> TurnstileResult: ...


class CloudflareTurnstile:
    def __init__(self, secret: str, timeout_s: float, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._secret, self._timeout_s, self._transport = secret, timeout_s, transport

    async def verify(self, token: str, remote_ip: str | None) -> TurnstileResult:
        data = {"secret": self._secret, "response": token}
        if remote_ip and remote_ip != "unknown":
            data["remoteip"] = remote_ip
        try:
            async with httpx.AsyncClient(timeout=self._timeout_s, transport=self._transport) as http:
                resp = await http.post(SITEVERIFY_URL, data=data)
            if resp.status_code >= 500:
                raise TurnstileUnavailableError(f"siteverify answered {resp.status_code}")
            body = resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise TurnstileUnavailableError(str(exc)) from exc
        if not isinstance(body, dict):
            raise TurnstileUnavailableError("siteverify returned an unexpected body")
        codes = [str(c) for c in body.get("error-codes", [])]
        # Erros do lado do servidor (secret errado, pedido malformado) não são culpa do visitante.
        if "internal-error" in codes:
            raise TurnstileUnavailableError("siteverify internal-error")
        if {"invalid-input-secret", "missing-input-secret"} & set(codes):
            log.error("Turnstile: secret rejeitado pela Cloudflare (%s)", codes)
            raise TurnstileUnavailableError("turnstile secret rejected")
        return TurnstileResult(
            success=body.get("success") is True,
            hostname=str(body.get("hostname") or ""),
            action=str(body.get("action") or ""),
            error_codes=codes,
        )


def get_turnstile() -> TurnstileVerifier:
    s = get_settings()
    return CloudflareTurnstile(s.turnstile_secret, s.turnstile_timeout_s)
