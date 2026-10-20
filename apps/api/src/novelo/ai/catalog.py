"""Catálogo de modelos do OpenRouter (público) com cache em memória de 1 h, ETag e stale-while-error."""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any

import httpx
from pydantic import BaseModel, Field

from novelo.ai.tasks import IMAGE, STRUCTURED, TOOLS
from novelo.core.errors import UpstreamError

log = logging.getLogger("novelo.llm.catalog")

CATALOG_URL = "https://openrouter.ai/api/v1/models"
TTL_S = 3600.0


class CatalogModel(BaseModel):
    id: str
    name: str
    context_length: int | None
    input_per_m_usd: float | None = Field(description="USD por milhão de tokens de entrada; nulo se o preço é dinâmico")
    output_per_m_usd: float | None
    dynamic_pricing: bool = Field(description="Preço variável (o fornecedor escolhe o modelo por baixo)")
    input_modalities: list[str]
    output_modalities: list[str]
    supports_image: bool
    supports_tools: bool
    supports_structured_outputs: bool

    def capabilities(self) -> frozenset[str]:
        caps = set[str]()
        if self.supports_image:
            caps.add(IMAGE)
        if self.supports_tools:
            caps.add(TOOLS)
        if self.supports_structured_outputs:
            caps.add(STRUCTURED)
        return frozenset(caps)


def _per_million(raw: Any) -> float | None:
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return None if value < 0 else round(value * 1_000_000, 6)


def parse_model(item: dict[str, Any]) -> CatalogModel | None:
    try:
        model_id = str(item["id"])
    except KeyError:
        return None
    pricing = item.get("pricing") or {}
    arch = item.get("architecture") or {}
    params = set(item.get("supported_parameters") or [])
    inputs = [str(m) for m in arch.get("input_modalities") or ["text"]]
    prompt, completion = _per_million(pricing.get("prompt")), _per_million(pricing.get("completion"))
    return CatalogModel(
        id=model_id,
        name=str(item.get("name") or model_id),
        context_length=item.get("context_length") if isinstance(item.get("context_length"), int) else None,
        input_per_m_usd=prompt,
        output_per_m_usd=completion,
        dynamic_pricing=prompt is None or completion is None,
        input_modalities=inputs,
        output_modalities=[str(m) for m in arch.get("output_modalities") or ["text"]],
        supports_image="image" in inputs,
        supports_tools="tools" in params,
        supports_structured_outputs="structured_outputs" in params,
    )


@dataclass
class CatalogSnapshot:
    models: dict[str, CatalogModel]
    fetched_at: float
    etag: str | None = None
    stale: bool = False


@dataclass
class ModelCatalog:
    url: str = CATALOG_URL
    ttl_s: float = TTL_S
    transport: httpx.AsyncBaseTransport | None = None
    _snap: CatalogSnapshot | None = field(default=None, repr=False)
    _lock: asyncio.Lock | None = field(default=None, repr=False)

    async def snapshot(self) -> CatalogSnapshot:
        snap = self._snap
        if snap and time.monotonic() - snap.fetched_at < self.ttl_s:
            return snap
        if self._lock is None:
            self._lock = asyncio.Lock()
        async with self._lock:
            snap = self._snap
            if snap and time.monotonic() - snap.fetched_at < self.ttl_s:
                return snap
            return await self._refresh(snap)

    async def _refresh(self, previous: CatalogSnapshot | None) -> CatalogSnapshot:
        headers = {"If-None-Match": previous.etag} if previous and previous.etag else {}
        try:
            async with httpx.AsyncClient(timeout=10.0, transport=self.transport) as http:
                resp = await http.get(self.url, headers=headers)
            if resp.status_code == 304 and previous:
                previous.fetched_at, previous.stale = time.monotonic(), False
                return previous
            resp.raise_for_status()
            items = resp.json().get("data", [])
            parsed = (parse_model(i) for i in items if isinstance(i, dict))
            models = {m.id: m for m in parsed if m}
            if not models:
                raise ValueError("empty catalog")
        except (httpx.HTTPError, ValueError, AttributeError) as exc:
            if previous:  # stale-while-error: serve o que há e volta a tentar daqui a pouco
                log.warning("model catalog refresh failed, serving stale copy: %s", type(exc).__name__)
                previous.stale = True
                previous.fetched_at = time.monotonic() - self.ttl_s + 60
                return previous
            raise UpstreamError("The model catalog is unavailable right now") from exc
        self._snap = CatalogSnapshot(models, time.monotonic(), resp.headers.get("etag"))
        return self._snap

    def price_of(self, model_id: str) -> tuple[float, float] | None:
        """USD por token (entrada, saída) a partir da última cópia em memória; sem pedido de rede."""
        m = self._snap.models.get(model_id) if self._snap else None
        if not m or m.input_per_m_usd is None or m.output_per_m_usd is None:
            return None
        return m.input_per_m_usd / 1e6, m.output_per_m_usd / 1e6

    def clear(self) -> None:
        self._snap = None


catalog = ModelCatalog()


def get_catalog() -> ModelCatalog:
    return catalog
