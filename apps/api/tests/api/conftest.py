"""Fixtures só dos testes de API."""

import pytest

from novelo.core.ratelimit import (
    RateLimiter,
    admin_approval_limiter,
    admin_delete_limiter,
    admin_impersonate_limiter,
    admin_invite_limiter,
    invite_accept_limiter,
    invite_email_limiter,
    invite_preview_limiter,
    invite_resend_limiter,
)


@pytest.fixture(autouse=True)
def _reset_admin_limiters() -> None:
    """Os limites da administração de utilizadores são por processo: cada teste começa do zero."""
    for limiter in (
        admin_delete_limiter,
        admin_impersonate_limiter,
        admin_invite_limiter,
        invite_accept_limiter,
        invite_email_limiter,
        invite_preview_limiter,
        invite_resend_limiter,
    ):
        limiter.reset()


@pytest.fixture(autouse=True)
def _reset_approval_throttle() -> None:
    admin_approval_limiter.reset()


@pytest.fixture(autouse=True)
def _reset_all_limiters() -> None:
    """Todos os limiters (em memória, por processo) começam vazios em cada teste."""
    RateLimiter.reset_all()


@pytest.fixture(autouse=True)
def _email_state(monkeypatch: pytest.MonkeyPatch) -> None:
    """Disjuntor, caches de monitorização e DNS começam limpos; os repetidores não esperam de verdade."""
    from novelo.features.email_log import dns_health, monitor, service  # noqa: PLC0415

    async def _no_sleep(_: float) -> None:
        return None

    monkeypatch.setattr(service, "sleep", _no_sleep)
    service.breaker.reset()
    monitor.reset_caches()
    dns_health.reset_cache()
