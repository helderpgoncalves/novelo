"""Guarda Turnstile reutilizável: `dependencies=[Depends(captcha("login"))]` numa rota pública de escrita.

O token vem no cabeçalho `X-Turnstile-Token` (uma só convenção, não polui os schemas). Cada token é de uso
único: a Cloudflare recusa a segunda utilização, por isso o web pede um token novo a cada tentativa.

Estado do serviço (ver `Settings.turnstile_enabled`):
- desligado: passa (só em dev/testes, ou produção sem secret e sem `TURNSTILE_REQUIRED`; o arranque avisa);
- ativo sem secret (só produção): fail-closed, 503 `captcha_unavailable`;
- ativo: sem token 400 `captcha_required`; token recusado 403 `captcha_failed`; Cloudflare em baixo
  503 `captcha_unavailable`.
"""

import logging
from collections.abc import Awaitable, Callable
from typing import Annotated
from urllib.parse import urlparse

from fastapi import Depends, Header, Request

from novelo.adapters.turnstile import TurnstileUnavailableError, TurnstileVerifier, get_turnstile
from novelo.core.config import TURNSTILE_TEST_SECRET_FAIL, TURNSTILE_TEST_SECRET_PASS, get_settings
from novelo.core.errors import CaptchaFailedError, CaptchaRequiredError, CaptchaUnavailableError
from novelo.core.ratelimit import client_ip

log = logging.getLogger(__name__)
TURNSTILE_HEADER = "X-Turnstile-Token"
MAX_TOKEN_LENGTH = 2048  # limite documentado pela Cloudflare


def warn_if_unprotected() -> None:
    """No arranque: avisa quando as rotas públicas ficam sem Turnstile."""
    s = get_settings()
    if not s.turnstile_enabled:
        log.warning("Turnstile DESLIGADO: registo, login e restantes rotas públicas ficam sem proteção anti-bots")
    elif not s.turnstile_secret:
        log.warning("Turnstile obrigatório mas sem TURNSTILE_SECRET_KEY: as rotas públicas respondem 503")


def captcha(action: str) -> Callable[..., Awaitable[None]]:
    """Cria a dependência para uma ação (`login`, `register`...). O `action` tem de coincidir com o do widget."""

    async def guard(
        request: Request,
        verifier: Annotated[TurnstileVerifier, Depends(get_turnstile)],
        token: Annotated[
            str | None,
            Header(alias=TURNSTILE_HEADER, description="Token do widget Cloudflare Turnstile (uso único)"),
        ] = None,
    ) -> None:
        s = get_settings()
        if not s.turnstile_enabled:
            return
        if not s.turnstile_secret:
            raise CaptchaUnavailableError("Human verification is not configured")
        if not token or len(token) > MAX_TOKEN_LENGTH:
            raise CaptchaRequiredError("Human verification token is required")
        try:
            result = await verifier.verify(token, client_ip(request))
        except TurnstileUnavailableError as exc:
            log.warning("Turnstile indisponível: %s", exc)
            raise CaptchaUnavailableError("Human verification is temporarily unavailable") from exc
        if not result.success:
            log.info("Turnstile recusado (%s) em %s", ",".join(result.error_codes), action)
            raise CaptchaFailedError("Human verification failed")
        # Só com chaves reais: as de teste devolvem hostname/action fictícios.
        if s.turnstile_secret not in (TURNSTILE_TEST_SECRET_PASS, TURNSTILE_TEST_SECRET_FAIL):
            expected_host = urlparse(s.app_url).hostname
            if result.hostname and expected_host and result.hostname != expected_host:
                raise CaptchaFailedError("Human verification failed")
        if result.action and result.action != action:
            raise CaptchaFailedError("Human verification failed")

    return guard
