"""Auxiliares dos testes de streaming: ler eventos SSE e gerar ficheiros de teste (sem rede)."""

import json
from typing import Any

import httpx

from novelo.ai.eval_fixtures import CSV, jpeg_with_exif, pdf_with_text, png, xlsx, zip_bytes


def parse_sse(text: str) -> list[dict[str, Any]]:
    events = []
    for block in text.split("\n\n"):
        data = [line[5:].strip() for line in block.splitlines() if line.startswith("data:")]
        if data:
            events.append(json.loads("".join(data)))
    return events


async def stream(c: httpx.AsyncClient, path: str, body: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    resp = await c.post(path, json=body or {})
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"].startswith("text/event-stream")
    return parse_sse(resp.text)


def types(events: list[dict[str, Any]]) -> list[str]:
    return [e["type"] for e in events]


def text_of(events: list[dict[str, Any]]) -> str:
    """O texto final no ecrã: aplica `retract` como o web faz."""
    out = ""
    for e in events:
        if e["type"] == "retract":
            out = ""
        elif e["type"] == "text_delta":
            out += e["delta"]
    return out


__all__ = [
    "CSV",
    "jpeg_with_exif",
    "parse_sse",
    "pdf_with_text",
    "png",
    "stream",
    "text_of",
    "types",
    "xlsx",
    "zip_bytes",
]
