"""Freguesia (CAOP 2019) e coordenadas das localidades dos circuitos da Vitrus. Sem I/O: `build_processed.py` lê os
ficheiros e chama `resolve`.

Regras, por esta ordem (cada localidade fica com o método no CSV, nada se corrige em silêncio):

1. **Correção explícita pelo nome** (`CORRECTIONS`): a localidade é uma freguesia (ou freguesia antiga, hoje numa
   união) cujo nome aparece, sem ambiguidade, no nome oficial de UMA freguesia da CAOP 2019. O ETL confirma-o: o nome
   normalizado tem de estar contido no nome CAOP da freguesia indicada e em nenhuma outra (senão falha).
   Coordenadas: as do Nominatim se caírem dentro dessa freguesia; senão (ou se não houver) o centroide do polígono CAOP
   (`caop_centroid`).
2. **Ponto-em-polígono na CAOP 2019** para as restantes localidades com coordenadas do Nominatim.
3. **Por resolver** (`AMBIGUOUS` ou sem coordenadas e sem correção): sem freguesia; entram no alerta de qualidade.

`LOW_CONFIDENCE` lista as que ficam pela regra 2 mas cujo nome não decide a freguesia: também entram no alerta.
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from shapely.geometry import Point
from shapely.geometry.base import BaseGeometry

PARISH_BY_NAME = "name_caop"  # regra 1
PARISH_BY_POINT = "point_caop"  # regra 2
UNRESOLVED = "unresolved"  # regra 3
COORDS_NOMINATIM = "nominatim"
COORDS_CAOP_CENTROID = "caop_centroid"


@dataclass(frozen=True)
class Correction:
    code: str  # código da app (parishes.csv: INE; uniões 0308U1..5)
    parish_name: str  # freguesia (antiga) como aparece no nome CAOP 2019; o ETL verifica que é inequívoco
    reason: str


CORRECTIONS: dict[str, Correction] = {
    "Aldão (compactador)": Correction("030801", "Aldão", "freguesia Aldão; «compactador» é o equipamento"),
    "Briteiros S. Estevão": Correction(
        "030879",
        "Briteiros Santo Estêvão",
        "freguesia antiga na união CAOP; o Nominatim devolvera a Citânia de Briteiros, na união vizinha",
    ),
    "Creixomil (zona alta)": Correction("030813", "Creixomil", "parte da freguesia Creixomil"),
    "Creixomil (zona baixa)": Correction("030813", "Creixomil", "parte da freguesia Creixomil"),
    "Donin": Correction("030879", "Donim", "grafia «Donin» de Donim, freguesia antiga na união CAOP"),
    "Figueiredo": Correction("0308U3", "Figueiredo", "freguesia antiga na união CAOP"),
    "Gondomar": Correction("0308U5", "Gondomar", "freguesia antiga na união CAOP"),
    "Nacional Selho São Lourenço": Correction(
        "030888", "Selho São Lourenço", "estrada nacional em Selho São Lourenço (freguesia antiga na união CAOP)"
    ),
    "Oleiros": Correction("0308U3", "Oleiros", "freguesia antiga na união CAOP"),
    "Santa Leocadia de Briteiros": Correction(
        "030880", "Briteiros Santa Leocádia", "freguesia antiga na união CAOP"
    ),
    "Santiago Candoso": Correction("0308U2", "Candoso São Tiago", "freguesia antiga na união CAOP"),
    "Souto": Correction("0308U5", "Souto", "as duas freguesias Souto estão na mesma união CAOP"),
    "Souto Santa Maria": Correction("0308U5", "Souto Santa Maria", "freguesia antiga na união CAOP"),
    "Souto São Salvador": Correction("0308U5", "Souto São Salvador", "freguesia antiga na união CAOP"),
    "São Clemente Rua Estreitas": Correction(
        "030887", "Sande São Clemente", "ruas estreitas de Sande São Clemente (freguesia antiga na união CAOP)"
    ),
    "São Salvador de Briteiros": Correction(
        "030880",
        "Briteiros São Salvador",
        "freguesia antiga na união CAOP; o Nominatim devolvera uma empresa em Barco",
    ),
    "Urgezess(5ª)": Correction("030871", "Urgezes", "grafia de Urgezes com o dia da semana"),
    "Vila Nova Ruas Estreitas": Correction(
        "030887", "Sande Vila Nova", "ruas estreitas de Sande Vila Nova (freguesia antiga na união CAOP)"
    ),
}

AMBIGUOUS: dict[str, str] = {
    "Ruas Estreitas": "o nome não indica a freguesia",
    "Selho Ruas Estreitas": "«Selho» são três freguesias (Selho São Cristóvão, Selho São Jorge, Selho São Lourenço)",
    "São Torcato Rua Estreitas Vermil Creixomil (5ª)": "junta três freguesias (São Torcato, Vermil, Creixomil)",
}

LOW_CONFIDENCE: dict[str, str] = {
    "Santo Eufémia": (
        "pode ser Prazins (Santa Eufémia) ou Prazins Santo Tirso; o ponto do Nominatim (Avenida Santo Tirso) cai na "
        "União de Prazins Santo Tirso e Corvite"
    ),
    "Selho": "«Selho» são três freguesias; o ponto do Nominatim cai em Selho (São Cristóvão)",
}


@dataclass(frozen=True)
class ParishShape:
    code: str  # código da app
    name: str  # nome CAOP 2019
    geometry: BaseGeometry  # WGS84 (lon, lat)


def norm(text: str) -> str:
    plain = "".join(c for c in unicodedata.normalize("NFD", text.lower()) if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", plain).strip()


def check_corrections(parishes: Sequence[ParishShape], corrections: dict[str, Correction] = CORRECTIONS) -> None:
    """Cada correção tem de apontar para a ÚNICA freguesia CAOP cujo nome contém `parish_name`."""
    for locality, c in corrections.items():
        want = f" {norm(c.parish_name)} "
        hits = [p.code for p in parishes if want in f" {norm(p.name)} "]
        if hits != [c.code]:
            raise ValueError(f"correção ambígua ou errada para {locality!r}: {c.parish_name!r} está em {hits}")


def centroid(geometry: BaseGeometry) -> Point:
    """Centroide do polígono; se cair fora (forma côncava), o ponto representativo, que está sempre dentro."""
    c = geometry.centroid
    return c if geometry.contains(c) else geometry.representative_point()


def resolve(
    located: Sequence[dict[str, Any]],
    parishes: Sequence[ParishShape],
    corrections: dict[str, Correction] = CORRECTIONS,
    ambiguous: dict[str, str] = AMBIGUOUS,
) -> list[dict[str, Any]]:
    """`located`: linhas de `localities_geocoded.json` (`locality`, `lat`, `lon`). Devolve as linhas de
    `localities_geo.csv` com `parish_method`, `coord_method` e `note`."""
    check_corrections(parishes, corrections)
    by_code = {p.code: p for p in parishes}
    out = []
    for x in located:
        name = x["locality"]
        point = Point(x["lon"], x["lat"]) if x.get("lat") is not None and x.get("lon") is not None else None
        row: dict[str, Any] = {"locality": name, "latitude": "", "longitude": "", "dicofre": ""}
        fix = corrections.get(name)
        if fix is not None:
            shape = by_code[fix.code]
            if point is not None and shape.geometry.contains(point):
                lat, lon, coord_method = x["lat"], x["lon"], COORDS_NOMINATIM
            else:
                c = centroid(shape.geometry)
                lat, lon, coord_method = round(c.y, 6), round(c.x, 6), COORDS_CAOP_CENTROID
            row |= {
                "latitude": lat,
                "longitude": lon,
                "dicofre": fix.code,
                "parish_method": PARISH_BY_NAME,
                "coord_method": coord_method,
                "note": f"{fix.parish_name}: {fix.reason}",
            }
        elif point is not None and name not in ambiguous:
            hit = next((p for p in parishes if p.geometry.contains(point)), None)
            row |= {
                "latitude": x["lat"],
                "longitude": x["lon"],
                "dicofre": hit.code if hit else "",
                "parish_method": PARISH_BY_POINT if hit else UNRESOLVED,
                "coord_method": COORDS_NOMINATIM,
                "note": LOW_CONFIDENCE.get(name, "" if hit else "ponto fora das freguesias CAOP"),
            }
        else:
            row |= {
                "parish_method": UNRESOLVED,
                "coord_method": "",
                "note": ambiguous.get(name, "sem coordenadas e sem freguesia no nome"),
            }
        out.append(row)
    return out


def alerts(
    rows: Sequence[dict[str, Any]],
    circuits_of: dict[str, str],
    first_id: int,
    corrections: dict[str, Correction] = CORRECTIONS,
) -> list[dict[str, Any]]:
    """Alertas de qualidade (formato de data_alerts.csv): correções pelo nome e localidades por resolver/confirmar."""

    def label(r: dict[str, Any]) -> str:
        where = circuits_of.get(r["locality"], "")
        return f"{r['locality']} ({where})" if where else r["locality"]

    fixed = [r for r in rows if r["parish_method"] == PARISH_BY_NAME]
    open_ = [r for r in rows if r["parish_method"] == UNRESOLVED]
    doubtful = [r for r in rows if r["locality"] in LOW_CONFIDENCE and r["parish_method"] == PARISH_BY_POINT]
    out = []
    if fixed:
        moved = [r for r in fixed if r["coord_method"] == COORDS_CAOP_CENTROID]
        out.append(
            {
                "id": first_id,
                "type_key": "normalized_spelling",
                "detail": (
                    "Localidades atribuídas pelo nome da freguesia na CAOP 2019: "
                    + "; ".join(f"{label(r)} → {corrections[r['locality']].parish_name}" for r in fixed)
                    + ". Com o centroide CAOP como coordenadas (sem ponto do Nominatim dentro da freguesia): "
                    + ", ".join(r["locality"] for r in moved)
                    + "."
                ),
                "suggestion": "Confirmar com a Vitrus a freguesia de cada localidade e usar o nome oficial no ficheiro.",
            }
        )
    if open_ or doubtful:
        parts = [f"{label(r)}: {r['note']}" for r in open_]
        parts += [f"{label(r)} (por confirmar): {r['note']}" for r in doubtful]
        out.append(
            {
                "id": first_id + 1,
                "type_key": "incomplete_circuit",
                "detail": "Localidades sem freguesia inequívoca: " + "; ".join(parts) + ".",
                "suggestion": (
                    "Indicar a freguesia (ou as ruas) de cada uma; até lá as por resolver não contam nas passagens "
                    "dos circuitos por freguesia."
                ),
            }
        )
    return out
