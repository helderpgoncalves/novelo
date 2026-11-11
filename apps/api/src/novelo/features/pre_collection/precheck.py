"""Pré-triagem antes do saco: valida a foto, pede o veredicto ao modelo de visão e devolve o conselho.

A fotografia vive só em memória durante o pedido e nunca é guardada (privacidade). A decisão é
derivada do estado: `reject` fica em casa (indiferenciado); `reuse` e `recycle` vão no saco.
"""

from novelo.adapters.openrouter import OpenRouterClient
from novelo.ai.images import data_url
from novelo.ai.prompts import load
from novelo.ai.tasks import AiTask
from novelo.domain.vocab import TextileDestination
from novelo.features.pre_collection.schemas import PreCheckAnalysis, PreCollectionAdvice


async def check(client: OpenRouterClient, photo: bytes, locale: str = "pt-PT") -> PreCollectionAdvice:
    system, version = load("precheck")
    content: list[dict[str, object]] = [
        {"type": "text", "text": f"Language for `reason`: {locale}."},
        {"type": "text", "text": "Photo: the item someone is considering for the textile bag."},
        {"type": "image_url", "image_url": {"url": data_url(photo)}},
    ]
    analysis = await client.structured(system=system, user=content, schema=PreCheckAnalysis, task=AiTask.PRECHECK)
    return PreCollectionAdvice(
        decision="keep_out" if analysis.condition == TextileDestination.REJECT else "in_bag",
        condition=analysis.condition,
        reason=analysis.reason,
        confidence=analysis.confidence,
        prompt_version=version,
        model=client.model_for(AiTask.PRECHECK),
    )
