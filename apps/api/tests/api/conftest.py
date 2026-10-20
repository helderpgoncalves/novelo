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
    from novelo.features.users import approvals  # noqa: PLC0415

    approvals.reset_notice_throttle()
    admin_approval_limiter.reset()


@pytest.fixture(autouse=True)
def _reset_all_limiters() -> None:
    """Todos os limiters (em memória, por processo) começam vazios em cada teste."""
    RateLimiter.reset_all()
