import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, field_validator

from novelo.domain.vocab import Fibre, GarmentType, LotEventKind, LotState, TextileDestination


class CompositionPart(BaseModel):
    fibre: Fibre
    pct: float = Field(ge=0, le=100)


def _check_composition(parts: list[CompositionPart]) -> list[CompositionPart]:
    total = sum(p.pct for p in parts)
    if parts and abs(total - 100) > 1:
        raise ValueError("A composição tem de somar 100%")
    return parts


class TriageAnalysis(BaseModel):
    """O que o modelo de visão devolve. Nunca inclui peso nem preço: isso calcula-se do lado do servidor."""

    garment_type: GarmentType
    condition: TextileDestination = Field(description="reuse, recycle ou reject")
    composition: Annotated[list[CompositionPart], Field(max_length=6)]
    brand: str | None = Field(default=None, max_length=80)
    confidence: float = Field(ge=0, le=1)
    notes: str = Field(max_length=240)

    _composition = field_validator("composition")(_check_composition)


class TriageResult(BaseModel):
    analysis: TriageAnalysis
    dominant_fibre: Fibre
    estimated_weight_g: int
    prompt_version: str
    model: str


class LotItemIn(BaseModel):
    """Peça confirmada pelo operador (pode corrigir o que o modelo sugeriu)."""

    garment_type: GarmentType
    condition: TextileDestination
    composition: Annotated[list[CompositionPart], Field(max_length=6)]
    brand: str | None = Field(default=None, max_length=80)
    estimated_weight_g: int = Field(gt=0, le=20000)
    confidence: float = Field(ge=0, le=1, default=1.0)
    prompt_version: str | None = None

    _composition = field_validator("composition")(_check_composition)


class LotItemOut(BaseModel):
    id: uuid.UUID
    garment_type: GarmentType
    condition: TextileDestination
    composition: list[CompositionPart]
    dominant_fibre: Fibre
    brand: str | None
    estimated_weight_g: int
    confidence: float
    created_at: datetime


class LotOpen(BaseModel):
    parish_code: str | None = Field(default=None, description="Freguesia do ponto de recolha (código INE)")


class LotEventOut(BaseModel):
    kind: LotEventKind
    occurred_at: datetime
    note: str | None


class ReservationOut(BaseModel):
    recycler_name: str
    contact: str
    note: str | None
    created_at: datetime


class LotSummary(BaseModel):
    code: str
    state: LotState
    parish_code: str | None
    parish_name: str | None
    dominant_fibre: Fibre
    items: int
    weight_kg: float
    opened_at: datetime


class LotDetail(LotSummary):
    composition: list[CompositionPart] = Field(description="Composição agregada, ponderada pelo peso")
    reuse_kg: float
    recycle_kg: float
    reject_kg: float
    item_list: list[LotItemOut]
    events: list[LotEventOut]
    reservation: ReservationOut | None


class BrandCount(BaseModel):
    brand: str
    items: int


class Passport(BaseModel):
    """Página pública do lote (o QR aponta para aqui): origem, composição, peso e histórico. Sem dados pessoais."""

    code: str
    state: LotState
    parish_name: str | None
    dominant_fibre: Fibre
    composition: list[CompositionPart]
    weight_kg: float
    items: int
    reuse_pct: float
    recycle_pct: float
    reject_pct: float
    brands: list[BrandCount]
    events: list[LotEventOut]
    opened_at: datetime


class LotStateChange(BaseModel):
    state: LotState


class MarketLot(BaseModel):
    code: str
    parish_name: str | None
    weight_kg: float
    state: LotState
    dominant_fibre: Fibre
    composition: list[CompositionPart]


class MarketEntry(BaseModel):
    """Bolsa de fibra: lotes triados e agregados por fibra dominante."""

    fibre: Fibre
    lots: int
    weight_kg: float
    parishes: list[str]
    items: list[MarketLot]


class ReserveRequest(BaseModel):
    recycler_name: str = Field(min_length=2, max_length=120)
    contact: str = Field(min_length=3, max_length=160)
    note: str | None = Field(default=None, max_length=500)


class BrandStat(BaseModel):
    brand: str
    items: int
    weight_kg: float
    top_fibre: Fibre
    share_pct: float


class BrandsOut(BaseModel):
    """Evidência por marca para a RAP: quilos e composição, com o tamanho da amostra para não concluir de pouco."""

    brands: list[BrandStat]
    sample_items: int
    items_without_brand: int
    total_kg: float
