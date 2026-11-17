import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, field_validator, model_validator

from novelo.domain.taxonomy import (
    Colour,
    FineState,
    Gender,
    Provenance,
    Season,
    SizeBand,
    TriageAxis,
    destination_for,
)
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
    """O que o modelo de visão devolve: a proposta nos seis eixos da taxonomia.

    A IA nunca devolve o destino: `fine_state` mapeia-se nos 3 destinos no servidor (`domain/taxonomy.py`),
    e o tamanho é lido só da etiqueta (`unknown` quando ilegível). Nunca inclui peso nem preço.
    """

    garment_type: GarmentType
    fine_state: FineState
    season: Season
    colour: Colour
    gender: Gender
    size_band: SizeBand = SizeBand.UNKNOWN
    composition: Annotated[list[CompositionPart], Field(max_length=6)]
    brand: str | None = Field(default=None, max_length=80)
    confidence: float = Field(ge=0, le=1)
    notes: str = Field(max_length=240)

    _composition = field_validator("composition")(_check_composition)


class TriageResult(BaseModel):
    analysis: TriageAnalysis
    destination: TextileDestination = Field(description="Destino derivado do estado fino (reuse/recycle/reject)")
    dominant_fibre: Fibre
    estimated_weight_g: int
    prompt_version: str
    model: str


class AttributeSource(BaseModel):
    """Selo de um atributo: «IA» (aceite tal e qual, com a confiança da proposta) ou «confirmado» (operador)."""

    origin: Provenance
    confidence: float = Field(ge=0, le=1)


class TriageProvenance(BaseModel):
    """Proveniência por eixo da taxonomia; um eixo sem selo é uma peça antiga ou sem valor."""

    fine_state: AttributeSource | None = None
    garment_type: AttributeSource | None = None
    season: AttributeSource | None = None
    colour: AttributeSource | None = None
    gender: AttributeSource | None = None
    size_band: AttributeSource | None = None


class TriageProposalValues(BaseModel):
    """O que a IA propôs em cada eixo (o que o cliente devolve no confirmar, para os rótulos dourados)."""

    garment_type: GarmentType | None = None
    fine_state: FineState | None = None
    season: Season | None = None
    colour: Colour | None = None
    gender: Gender | None = None
    size_band: SizeBand | None = None


class TriageProposal(BaseModel):
    """Proposta da IA que o operador acabou de rever (modelo, versão do prompt e valores)."""

    model: str = Field(max_length=120)
    prompt_version: str = Field(max_length=20)
    confidence: float = Field(ge=0, le=1)
    values: TriageProposalValues


def _check_destination(body: "LotItemIn") -> "LotItemIn":
    """O destino vem do estado fino; clientes antigos podem mandar só o destino (peça sem estado fino)."""
    if body.fine_state is not None and body.condition is not None:
        if destination_for(body.fine_state) is not body.condition:
            raise ValueError("O destino tem de ser o derivado do estado fino")
    elif body.fine_state is None and body.condition is None:
        raise ValueError("Há de vir o estado fino ou o destino (condition)")
    return body


class LotItemIn(BaseModel):
    """Peça confirmada pelo operador (pode corrigir o que o modelo sugeriu).

    O caminho novo manda `fine_state` (+ eixos da taxonomia e a proposta da IA); o destino (`condition`)
    é derivado no servidor. O caminho legado manda só `condition`: entra sem estado fino nem eixos.
    """

    garment_type: GarmentType
    fine_state: FineState | None = None
    condition: TextileDestination | None = Field(
        default=None, description="Destino (legado); derivado do estado fino quando este vem"
    )
    season: Season | None = None
    colour: Colour | None = None
    gender: Gender | None = None
    size_band: SizeBand | None = Field(default=None, description="Banda lida só da etiqueta")
    composition: Annotated[list[CompositionPart], Field(max_length=6)]
    brand: str | None = Field(default=None, max_length=80)
    estimated_weight_g: int = Field(gt=0, le=20000)
    confidence: float = Field(ge=0, le=1, default=1.0)
    prompt_version: str | None = None
    ai_proposal: TriageProposal | None = Field(
        default=None, description="Proposta da IA revista; gera rótulos dourados"
    )

    _composition = field_validator("composition")(_check_composition)
    _destination = model_validator(mode="after")(_check_destination)


class LotItemOut(BaseModel):
    id: uuid.UUID
    garment_type: GarmentType
    fine_state: FineState | None = None
    condition: TextileDestination
    season: Season | None = None
    colour: Colour | None = None
    gender: Gender | None = None
    size_band: SizeBand | None = None
    provenance: TriageProvenance | None = Field(default=None, description="Selo «confirmado»/«IA» por eixo")
    composition: list[CompositionPart]
    dominant_fibre: Fibre
    brand: str | None
    estimated_weight_g: int
    confidence: float
    created_at: datetime
    has_photo: bool = Field(default=False, description="Tem miniatura guardada e ainda não expirada")
    photo_url: str | None = Field(
        default=None, description="URL relativa (autenticada) da miniatura; nula sem foto ou depois de expirar"
    )
    photo_credit: str | None = Field(default=None, description="Atribuição da licença da foto (se for de terceiros)")


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


class PassportPhoto(BaseModel):
    """Miniatura pública de uma peça (sem metadados; apagada ao fim da retenção)."""

    item_id: uuid.UUID
    garment_type: GarmentType
    brand: str | None
    url: str = Field(description="URL relativa da rota pública da imagem (JPEG)")
    credit: str | None = Field(default=None, description="Atribuição da licença da foto (se for de terceiros)")


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
    photos: list[PassportPhoto] = Field(default_factory=list, description="Até 12 miniaturas não expiradas")


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


class GoldenLabelOut(BaseModel):
    """Rótulo dourado: uma correção do operador a um valor proposto pela IA (verdade-terreno por eixo)."""

    id: uuid.UUID
    axis: TriageAxis
    ai_value: str | None
    operator_value: str
    ai_confidence: float | None
    model: str | None
    prompt_version: str | None
    lot_code: str | None
    created_at: datetime
