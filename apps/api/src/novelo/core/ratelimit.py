"""Limite de pedidos em memória (janela deslizante). Suficiente para uma instância."""

import time
from collections import defaultdict, deque

from fastapi import Request

from novelo.core.errors import AppError


class RateLimitError(AppError):
    status_code = 429
    code = "rate_limited"


class RateLimiter:
    def __init__(self, limit: int, window_s: int, name: str) -> None:
        self.limit, self.window_s, self.name = limit, window_s, name
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > self.window_s:
            hits.popleft()
        if len(hits) >= self.limit:
            raise RateLimitError("Demasiadas tentativas. Tenta de novo dentro de alguns minutos.")
        hits.append(now)

    def reset(self) -> None:
        self._hits.clear()

    async def __call__(self, request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        self.check(f"{self.name}:{forwarded or ip}")


auth_limiter = RateLimiter(limit=10, window_s=60, name="auth")
reset_limiter = RateLimiter(limit=5, window_s=600, name="reset")
