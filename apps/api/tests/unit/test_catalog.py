import httpx
import pytest

from novelo.ai.catalog import ModelCatalog, parse_model
from novelo.core.errors import UpstreamError

ITEMS = {
    "data": [
        {
            "id": "openai/gpt-6-luna",
            "name": "GPT-6 Luna",
            "context_length": 1050000,
            "pricing": {"prompt": "0.0000001", "completion": "0.0000005"},
            "architecture": {"input_modalities": ["text", "image"], "output_modalities": ["text"]},
            "supported_parameters": ["tools", "structured_outputs", "reasoning"],
        },
        {
            "id": "typesafe/jev-router",
            "name": "JEV Router",
            "pricing": {"prompt": "-1", "completion": "-1"},
            "architecture": {"input_modalities": ["text"]},
            "supported_parameters": ["structured_outputs"],
        },
    ]
}


def _catalog(handler: httpx.MockTransport, ttl: float = 3600) -> ModelCatalog:
    return ModelCatalog(url="https://catalog.test/models", ttl_s=ttl, transport=handler)


def test_parse_prices_per_million_and_capabilities() -> None:
    luna = parse_model(ITEMS["data"][0])
    router = parse_model(ITEMS["data"][1])
    assert luna and luna.input_per_m_usd == 0.1 and luna.output_per_m_usd == 0.5
    assert luna.supports_image and luna.supports_tools and luna.supports_structured_outputs
    assert router and router.dynamic_pricing and router.input_per_m_usd is None and not router.supports_image


async def test_catalog_is_cached_and_etag_revalidated() -> None:
    calls: list[str | None] = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req.headers.get("if-none-match"))
        if req.headers.get("if-none-match") == '"v1"':
            return httpx.Response(304)
        return httpx.Response(200, json=ITEMS, headers={"etag": '"v1"'})

    cat = _catalog(httpx.MockTransport(handler))
    await cat.snapshot()
    await cat.snapshot()
    assert calls == [None]  # a segunda leitura vem da memória
    cat._snap.fetched_at -= 7200  # type: ignore[union-attr]  # expirou: revalida com ETag
    snap = await cat.snapshot()
    assert calls == [None, '"v1"'] and "openai/gpt-6-luna" in snap.models and not snap.stale
    assert (
        cat.price_of("openai/gpt-6-luna") == pytest.approx((1e-7, 5e-7)) and cat.price_of("typesafe/jev-router") is None
    )


async def test_stale_while_error_and_cold_failure() -> None:
    state = {"ok": True}

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=ITEMS) if state["ok"] else httpx.Response(500)

    cat = _catalog(httpx.MockTransport(handler))
    await cat.snapshot()
    cat._snap.fetched_at -= 7200  # type: ignore[union-attr]
    state["ok"] = False
    snap = await cat.snapshot()
    assert snap.stale and "openai/gpt-6-luna" in snap.models  # serve a cópia anterior

    cold = _catalog(httpx.MockTransport(handler))
    try:
        await cold.snapshot()
    except UpstreamError:
        return
    raise AssertionError("sem cópia anterior devia falhar")
