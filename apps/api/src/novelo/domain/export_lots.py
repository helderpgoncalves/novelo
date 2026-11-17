"""Chave e linhagem dos lotes de escoamento (bilhete #57). Funções puras, sem I/O.

O lote de escoamento («lote vendável») fecha-se por (estado fino, tipologia, estação, género) — os
quatro eixos de `EXPORT_KEY_AXES`. Cor e tamanho ficam FORA da chave (só filtros para o pedido do
comprador). Uma peça só entra se tiver os quatro eixos definidos: peças anteriores à taxonomia ou
parciais ficam fora até re-triagem. A linhagem agrega as peças escolhidas até aos lotes de recolha
de origem (um por paragem) e aos locais onde nasceram.
"""

import uuid
from collections import defaultdict
from dataclasses import dataclass

from novelo.domain.taxonomy import FineState, Gender, Season
from novelo.domain.vocab import GarmentType


@dataclass(frozen=True)
class ExportKey:
    """A chave fechada do lote de escoamento (taxonomia v1): quatro eixos, nenhum opcional."""

    fine_state: FineState
    garment_type: GarmentType
    season: Season
    gender: Gender


@dataclass(frozen=True)
class ExportCandidate:
    """O que a chave e a linhagem precisam de saber sobre uma peça triada (o resto fica na peça)."""

    id: uuid.UUID
    fine_state: FineState | None
    garment_type: GarmentType
    season: Season | None
    gender: Gender | None
    colour: str | None = None  # só para filtros; nunca na chave
    size_band: str | None = None  # só para filtros; nunca na chave
    weight_g: int = 0


def export_key_of(
    fine_state: str | FineState | None,
    garment_type: str | GarmentType,
    season: str | Season | None,
    gender: str | Gender | None,
) -> ExportKey | None:
    """Chave completa ou nada: um eixo em falta e a peça fica fora do escoamento (re-triagem)."""
    if fine_state is None or season is None or gender is None:
        return None
    return ExportKey(
        fine_state=FineState(fine_state),
        garment_type=GarmentType(garment_type),
        season=Season(season),
        gender=Gender(gender),
    )


def key_of(piece: ExportCandidate) -> ExportKey | None:
    return export_key_of(piece.fine_state, piece.garment_type, piece.season, piece.gender)


def group_by_export_key(pieces: list[ExportCandidate]) -> dict[ExportKey, list[ExportCandidate]]:
    """Agrupa as peças pela chave do escoamento; as sem chave (legadas ou parciais) ficam de fora."""
    groups: dict[ExportKey, list[ExportCandidate]] = defaultdict(list)
    for piece in pieces:
        if (key := key_of(piece)) is not None:
            groups[key].append(piece)
    return dict(groups)


# --- Linhagem ----------------------------------------------------------------------------------------


@dataclass(frozen=True)
class LineageRow:
    """Um elo da linhagem: a peça no escoamento e o lote de recolha (com a paragem) donde veio."""

    item_id: uuid.UUID
    weight_g: int
    lot_code: str
    locality_name: str | None  # a paragem (local) onde o lote de recolha nasceu
    parish_name: str | None


@dataclass(frozen=True)
class LineageLot:
    """Um lote de recolha de origem: quantas peças do escoamento vêm dele e quanto pesam."""

    lot_code: str
    locality_name: str | None
    parish_name: str | None
    items: int
    weight_kg: float


@dataclass(frozen=True)
class LineageSummary:
    """A linhagem do lote de escoamento: lotes de origem por peso, locais distintos e peso total."""

    lots: list[LineageLot]  # mais pesado primeiro; empate por código, para a ordem ser estável
    localities: int  # paragens distintas com nome conhecido
    weight_kg: float


def lineage_summary(rows: list[LineageRow]) -> LineageSummary:
    """Agrega as peças por lote de recolha de origem. 400+400 g no NOV-AAA, 350 g no NOV-CCC,
    250 g no NOV-BBB → lotes por essa ordem, 2 locais, 1,4 kg no total."""
    by_lot: dict[str, list[LineageRow]] = defaultdict(list)
    for row in rows:
        by_lot[row.lot_code].append(row)
    lots = [
        LineageLot(
            lot_code=code,
            locality_name=rows_[0].locality_name,
            parish_name=rows_[0].parish_name,
            items=len(rows_),
            weight_kg=round(sum(r.weight_g for r in rows_) / 1000, 3),
        )
        for code, rows_ in by_lot.items()
    ]
    lots.sort(key=lambda lot: (-lot.weight_kg, lot.lot_code))
    return LineageSummary(
        lots=lots,
        localities=len({r.locality_name for r in rows if r.locality_name}),
        weight_kg=round(sum(r.weight_g for r in rows) / 1000, 3),
    )
