"""Cache em memória (TTL) das respostas do modelo a entradas idênticas. Uma instância; sem persistência."""

import hashlib
import json
import time
from typing import Any


def fingerprint(*parts: Any) -> str:
    """Hash estável de uma entrada determinística (modelo, prompt, dados)."""
    raw = json.dumps(parts, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


class TtlCache:
    def __init__(self, ttl_s: float = 3600.0, max_entries: int = 256) -> None:
        self.ttl_s, self.max_entries = ttl_s, max_entries
        self._data: dict[str, tuple[float, str]] = {}

    def get(self, key: str) -> str | None:
        hit = self._data.get(key)
        if hit is None:
            return None
        stored_at, value = hit
        if time.monotonic() - stored_at > self.ttl_s:
            del self._data[key]
            return None
        return value

    def put(self, key: str, value: str) -> None:
        if len(self._data) >= self.max_entries:
            self._data.pop(next(iter(self._data)))  # o mais antigo
        self._data[key] = (time.monotonic(), value)

    def clear(self) -> None:
        self._data.clear()


response_cache = TtlCache()
