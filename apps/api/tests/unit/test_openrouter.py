import json

import httpx
import pytest
from pydantic import BaseModel

from novelo.adapters.openrouter import OpenRouterClient
from novelo.core.config import Settings
from novelo.core.errors import FeatureDisabledError, UpstreamError


class Delta(BaseModel):
    zones: list[str]


def _client(handler: httpx.MockTransport, key: str = "k") -> OpenRouterClient:
    return OpenRouterClient(Settings(OPENROUTER_API_KEY=key), transport=handler)


def _reply(content: str) -> httpx.Response:
    return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})


async def test_structured_validates_json() -> None:
    client = _client(httpx.MockTransport(lambda _: _reply(json.dumps({"zones": ["Serzedelo"]}))))
    assert (await client.structured(system="s", user="u", schema=Delta)).zones == ["Serzedelo"]


async def test_structured_retries_then_fails() -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return _reply("não é json")

    with pytest.raises(UpstreamError):
        await _client(httpx.MockTransport(handler)).structured(system="s", user="u", schema=Delta)
    assert calls == 2


async def test_disabled_without_key() -> None:
    with pytest.raises(FeatureDisabledError):
        await _client(httpx.MockTransport(lambda _: _reply("{}")), key="").structured(
            system="s", user="u", schema=Delta
        )
