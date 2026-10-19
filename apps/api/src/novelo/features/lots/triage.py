"""Triagem por foto: valida as imagens, pede a análise ao modelo de visão e calcula o peso do lado do servidor.

As fotografias vivem só em memória durante o pedido e nunca são guardadas (privacidade).
"""

import base64
from typing import Literal

from novelo.adapters.openrouter import OpenRouterClient
from novelo.ai.prompts import load
from novelo.core.config import get_settings
from novelo.core.errors import AppError
from novelo.features.lots.schemas import TriageAnalysis, TriageResult
from novelo.features.lots.service import dominant_fibre, estimate_weight_g

MAX_BYTES = 5 * 1024 * 1024
_MAGIC = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"RIFF": "image/webp",  # confirmado abaixo com "WEBP"
}


class InvalidImageError(AppError):
    status_code = 400
    code = "bad_request"


def sniff_mime(data: bytes) -> Literal["image/jpeg", "image/png", "image/webp"]:
    """Confirma o formato pelos primeiros bytes: o Content-Type enviado pelo cliente não é de fiar."""
    for magic, mime in _MAGIC.items():
        if data.startswith(magic):
            if mime == "image/webp" and data[8:12] != b"WEBP":
                break
            return mime  # type: ignore[return-value]
    raise InvalidImageError("Only JPEG, PNG or WebP images are accepted")


def _data_url(data: bytes) -> str:
    if not data:
        raise InvalidImageError("Empty image")
    if len(data) > MAX_BYTES:
        raise InvalidImageError("Each photo must be at most 5 MB")
    return f"data:{sniff_mime(data)};base64,{base64.b64encode(data).decode()}"


async def analyse(client: OpenRouterClient, item_photo: bytes, label_photo: bytes | None) -> TriageResult:
    system, version = load("triage")
    content: list[dict[str, object]] = [
        {"type": "text", "text": "Photo 1: the garment."},
        {"type": "image_url", "image_url": {"url": _data_url(item_photo)}},
    ]
    if label_photo:
        content += [
            {"type": "text", "text": "Photo 2: the care/composition label."},
            {"type": "image_url", "image_url": {"url": _data_url(label_photo)}},
        ]
    model = get_settings().llm_model_vision
    analysis = await client.structured(system=system, user=content, schema=TriageAnalysis, model=model)
    return TriageResult(
        analysis=analysis,
        dominant_fibre=dominant_fibre(analysis.composition),
        estimated_weight_g=estimate_weight_g(analysis.garment_type.value),
        prompt_version=version,
        model=model,
    )
