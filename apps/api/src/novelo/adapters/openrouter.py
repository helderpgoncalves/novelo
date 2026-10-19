"""Cliente do OpenRouter (API compatível com OpenAI) com saída estruturada validada por Pydantic.

Regra do projeto: o modelo nunca faz contas. Devolve JSON que um modelo Pydantic valida;
os números vêm sempre do otimizador ou da base de dados (ver docs/engenharia/ia.md).
"""

import json
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from novelo.core.config import Settings, get_settings
from novelo.core.errors import FeatureDisabledError, UpstreamError

T = TypeVar("T", bound=BaseModel)


class OpenRouterClient:
    def __init__(self, settings: Settings | None = None, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._s = settings or get_settings()
        self._http = httpx.AsyncClient(
            base_url=self._s.openrouter_base_url,
            timeout=self._s.llm_timeout_s,
            transport=transport,
            headers={
                "Authorization": f"Bearer {self._s.openrouter_api_key}",
                "HTTP-Referer": "https://novelo.bitsapiens.io",
                "X-Title": "Novelo",
            },
        )

    async def structured(
        self,
        *,
        system: str,
        user: str | list[dict[str, Any]],
        schema: type[T],
        model: str | None = None,
        retries: int = 1,
    ) -> T:
        """Pede JSON que cumpra `schema`; volta a pedir `retries` vezes se não validar."""
        if not self._s.llm_enabled:
            raise FeatureDisabledError("AI is disabled: OPENROUTER_API_KEY is not set")
        payload = {
            "model": model or self._s.llm_model_text,
            "temperature": 0,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": schema.__name__,
                    "strict": True,
                    "schema": schema.model_json_schema(),
                },
            },
        }
        last_error: Exception | None = None
        for _ in range(retries + 1):
            try:
                resp = await self._http.post("/chat/completions", json=payload)
                resp.raise_for_status()
                content = resp.json()["choices"][0]["message"]["content"]
                return schema.model_validate(json.loads(content))
            except (httpx.HTTPError, KeyError, json.JSONDecodeError, ValidationError) as exc:
                last_error = exc
        raise UpstreamError(f"The model did not return a valid response: {last_error}")

    async def aclose(self) -> None:
        await self._http.aclose()
