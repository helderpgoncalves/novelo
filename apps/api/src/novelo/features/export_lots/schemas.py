"""Contrato dos lotes de escoamento (bilhete #57).

A chave são os quatro eixos de `EXPORT_KEY_AXES`; cor e tamanho aparecem nos payloads como atributos
de filtro, nunca como chave. Os payloads nunca trazem criador nem dados de doador.
"""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

from novelo.domain.taxonomy import Colour, FineState, Gender, Season, SizeBand
from novelo.domain.vocab import ExportLotState, GarmentType
from novelo.features.lots.schemas import CompositionPart, TriageProvenance


class ExportLotKeyIn(BaseModel):
    """A chave fechada do lote de escoamento: os quatro eixos, nenhum opcional."""

    fine_state: FineState
    garment_type: GarmentType
    season: Season
    gender: Gender


class ExportLotItemsIn(BaseModel):
    """Peças a juntar a um lote de escoamento aberto (triadas depois do fecho da chave)."""

    item_ids: Annotated[list[uuid.UUID], Field(min_length=1, max_length=500)]


class ExportLotItemOut(BaseModel):
    """Peça do escoamento com o elo de origem: o lote de recolha e a paragem donde veio."""

    id: uuid.UUID
    garment_type: GarmentType
    fine_state: FineState
    season: Season
    gender: Gender
    # Atributos de filtro (fora da chave):
    colour: Colour | None
    size_band: SizeBand | None
    brand: str | None
    provenance: TriageProvenance | None = Field(default=None, description="Selo «confirmado»/«IA» por eixo")
    estimated_weight_g: int
    lot_code: str = Field(description="Lote de recolha de origem")
    locality_name: str | None = Field(default=None, description="Paragem (local) donde a peça veio")
    parish_name: str | None = None
    added_at: datetime


class LineageLotOut(BaseModel):
    """Um lote de recolha de origem: quantas peças do escoamento vêm dele, de que paragem, e quanto pesam."""

    lot_code: str
    locality_name: str | None
    parish_name: str | None
    items: int
    weight_kg: float


class ExportLotSummary(BaseModel):
    code: str
    state: ExportLotState
    fine_state: FineState
    garment_type: GarmentType
    season: Season
    gender: Gender
    taxonomy_version: int = Field(description="Versão da taxonomia em que o lote foi fechado")
    items: int
    weight_kg: float
    collection_lots: int = Field(description="Lotes de recolha de origem distintos")
    localities: int = Field(description="Paragens (locais) distintas na linhagem")
    created_at: datetime
    closed_at: datetime | None


class ExportLotDetail(ExportLotSummary):
    composition: list[CompositionPart] = Field(description="Composição agregada, ponderada pelo peso")
    item_list: list[ExportLotItemOut]
    lineage: list[LineageLotOut] = Field(description="Lotes de recolha de origem, mais pesado primeiro")
