"""Contrato da pré-recolha: o conselho «vai no saco?» para quem prepara o saco."""

from typing import Literal

from pydantic import BaseModel, Field

from novelo.domain.vocab import TextileDestination


class PreCheckAnalysis(BaseModel):
    """O que o modelo de visão devolve: só o estado e o motivo. Nunca números, marcas nem composição."""

    condition: TextileDestination = Field(description="reuse, recycle ou reject")
    reason: str = Field(max_length=240)
    confidence: float = Field(ge=0, le=1)


class PreCollectionAdvice(BaseModel):
    """O conselho devolvido a quem prepara o saco. Aconselha, não condiciona; nada é guardado."""

    decision: Literal["in_bag", "keep_out"] = Field(
        description="in_bag se a peça vai no saco; keep_out se fica em casa (indiferenciado)"
    )
    condition: TextileDestination = Field(description="reuse/recycle quando vai; reject quando não vai")
    reason: str = Field(max_length=240, description="Uma frase curta, no idioma pedido")
    confidence: float = Field(ge=0, le=1)
    prompt_version: str
    model: str
