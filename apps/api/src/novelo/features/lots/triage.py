"""Triagem por foto: valida as imagens, pede a análise ao modelo de visão e calcula o peso do lado do servidor.

As fotografias vivem só em memória durante o pedido e nunca são guardadas (privacidade).
A validação e a redução das fotos vivem em `ai/images.py`, partilhadas com a pré-recolha.
"""

from novelo.adapters.openrouter import OpenRouterClient
from novelo.ai.images import data_url
from novelo.ai.prompts import load
from novelo.ai.tasks import AiTask
from novelo.features.lots.schemas import TriageAnalysis, TriageResult
from novelo.features.lots.service import dominant_fibre, estimate_weight_g


async def analyse(
    client: OpenRouterClient,
    item_photo: bytes,
    label_photo: bytes | None,
    model: str | None = None,
    locale: str = "pt-PT",
) -> TriageResult:
    system, version = load("triage")
    content: list[dict[str, object]] = [
        {"type": "text", "text": f"Language for `notes`: {locale}."},
        {"type": "text", "text": "Photo 1: the garment."},
        {"type": "image_url", "image_url": {"url": data_url(item_photo)}},
    ]
    if label_photo:
        content += [
            {"type": "text", "text": "Photo 2: the care/composition label."},
            {"type": "image_url", "image_url": {"url": data_url(label_photo)}},
        ]
    chosen = model or client.model_for(AiTask.TRIAGE)
    analysis = await client.structured(
        system=system, user=content, schema=TriageAnalysis, model=model, task=AiTask.TRIAGE
    )
    return TriageResult(
        analysis=analysis,
        dominant_fibre=dominant_fibre(analysis.composition),
        estimated_weight_g=estimate_weight_g(analysis.garment_type.value),
        prompt_version=version,
        model=chosen,
    )
