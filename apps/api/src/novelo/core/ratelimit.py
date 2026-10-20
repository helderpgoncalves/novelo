"""Limite de pedidos em memória (janela deslizante). Suficiente para uma instância."""

import time
from collections import defaultdict, deque

from fastapi import Request

from novelo.core.config import get_settings
from novelo.core.errors import RateLimitError


def client_ip(request: Request) -> str:
    ip = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return forwarded or ip


class RateLimiter:
    def __init__(self, limit: int, window_s: int, name: str) -> None:
        self.limit, self.window_s, self.name = limit, window_s, name
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, limit: int | None = None) -> None:
        if not get_settings().rate_limit_enabled:
            return
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > self.window_s:
            hits.popleft()
        if len(hits) >= (limit or self.limit):
            raise RateLimitError("Too many attempts. Try again in a few minutes.")
        hits.append(now)

    def is_blocked(self, key: str, limit: int | None = None) -> bool:
        """Já chegou ao limite? Não regista nenhum pedido."""
        if not get_settings().rate_limit_enabled:
            return False
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > self.window_s:
            hits.popleft()
        return len(hits) >= (limit or self.limit)

    def reset(self) -> None:
        self._hits.clear()

    async def __call__(self, request: Request) -> None:
        self.check(f"{self.name}:{client_ip(request)}")


auth_limiter = RateLimiter(limit=10, window_s=60, name="auth")
reset_limiter = RateLimiter(limit=5, window_s=600, name="reset")
triage_limiter = RateLimiter(limit=20, window_s=60, name="triage")  # cada chamada ao modelo de visão custa dinheiro
whatif_limiter = RateLimiter(limit=15, window_s=60, name="whatif")
copilot_limiter = RateLimiter(limit=12, window_s=60, name="copilot")  # chaves por utilizador (ver copilot/router.py)
alerts_limiter = RateLimiter(limit=10, window_s=60, name="alerts")

# Entrada sem password. Por IP (rota) e por email (chave explícita, ver features/auth/router.py).
magic_link_limiter = RateLimiter(limit=8, window_s=600, name="magic")
magic_verify_limiter = RateLimiter(limit=20, window_s=600, name="magic-verify")
magic_email_limiter = RateLimiter(limit=3, window_s=600, name="magic-email")
# Num evento muitos convidados partilham o mesmo IP (wifi): o limite por IP é largo; o por email é estrito.
quick_join_limiter = RateLimiter(limit=40, window_s=600, name="quick-join")
quick_join_email_limiter = RateLimiter(limit=3, window_s=600, name="quick-join-email")
quick_join_code_limiter = RateLimiter(limit=10, window_s=600, name="quick-join-code")  # só falhas de código
# Convidados: por utilizador, por hora (ver core/guest.py).
guest_ai_limiter = RateLimiter(limit=20, window_s=3600, name="guest-ai")
guest_solver_limiter = RateLimiter(limit=10, window_s=3600, name="guest-solver")
