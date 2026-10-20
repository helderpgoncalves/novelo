"""Filtros e paginação por cursor dos locais e dos contentores municipais. Sem FastAPI: o router só os preenche."""

import base64
import binascii
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import ColumnElement, Select, and_, or_, select

from novelo.core.errors import AppError
from novelo.domain.municipal import BBox, fold
from novelo.domain.vocab import (
    CoordPrecision,
    CoordStatus,
    MunicipalKind,
    MunicipalStream,
    ParishMatch,
    ProducerType,
    SiteClass,
)
from novelo.features.municipal.models import MunicipalContainer, MunicipalSite

MAX_SEARCH_TERMS = 6

_KIND_COLUMN = {
    MunicipalKind.UNDERGROUND: MunicipalSite.n_underground,
    MunicipalKind.SURFACE: MunicipalSite.n_surface,
    MunicipalKind.PLATFORM: MunicipalSite.n_platform,
    MunicipalKind.ORGANIC_COLLECTIVE: MunicipalSite.n_organic_collective,
    MunicipalKind.ORGANIC_PRODUCER: MunicipalSite.n_organic_producer,
    MunicipalKind.GREEN_WASTE: MunicipalSite.n_green_waste,
}
_STREAM_COLUMN = {
    MunicipalStream.ORGANIC: MunicipalSite.n_stream_organic,
    MunicipalStream.GREEN: MunicipalSite.n_stream_green,
    MunicipalStream.UNKNOWN: MunicipalSite.n_stream_unknown,
}


class BadCursorError(AppError):
    status_code = 400


def encode_cursor(value: str | int) -> str:
    return base64.urlsafe_b64encode(str(value).encode()).decode().rstrip("=")


def decode_cursor(cursor: str) -> str:
    try:
        return base64.b64decode(cursor + "=" * (-len(cursor) % 4), altchars=b"-_", validate=True).decode()
    except (binascii.Error, UnicodeDecodeError, ValueError):
        raise BadCursorError("Invalid cursor") from None


def decode_offset(cursor: str | None) -> int:
    if cursor is None:
        return 0
    raw = decode_cursor(cursor)
    if not raw.isdigit():
        raise BadCursorError("Invalid cursor")
    return int(raw)


@dataclass
class SiteFilters:
    kind: list[MunicipalKind] = field(default_factory=list)
    stream: list[MunicipalStream] = field(default_factory=list)
    parish: list[str] = field(default_factory=list)  # dicofre (app ou CAOP)
    producer_type: list[ProducerType] = field(default_factory=list)
    site_class: list[SiteClass] = field(default_factory=list)
    textile_candidate: bool | None = None
    coord_suspect: bool | None = None
    coord_precision: CoordPrecision | None = None
    q: str | None = None
    bbox: BBox | None = None
    search_names: bool = False  # só admins com show_names: sem isto a pesquisa não toca nos nomes dos produtores


@dataclass
class ContainerFilters(SiteFilters):
    located: bool | None = None
    parish_match: list[ParishMatch] = field(default_factory=list)
    brand: str | None = None


def _terms(q: str | None) -> list[str]:
    return fold(q).split()[:MAX_SEARCH_TERMS] if q else []


def _search(columns: list[Any], terms: list[str]) -> list[ColumnElement[bool]]:
    """Cada termo tem de aparecer numa das colunas (sem acentos nem maiúsculas)."""
    return [or_(*(c.contains(t, autoescape=True) for c in columns)) for t in terms]


def apply_site_filters[S: Select[*tuple[Any, ...]]](stmt: S, f: SiteFilters) -> S:
    S = MunicipalSite
    conds: list[ColumnElement[bool]] = []
    if f.kind:
        conds.append(or_(*(_KIND_COLUMN[k] > 0 for k in f.kind)))
    if f.stream:
        conds.append(or_(*(_STREAM_COLUMN[s] > 0 for s in f.stream)))
    if f.parish:
        conds.append(or_(S.parish_code.in_(f.parish), S.parish_dicofre.in_(f.parish)))
    if f.producer_type:
        conds.append(S.producer_type_keys.overlap([p.value for p in f.producer_type]))
    if f.site_class:
        conds.append(S.site_class.in_(f.site_class))
    if f.textile_candidate is not None:
        conds.append(S.textile_candidate.is_(f.textile_candidate))
    if f.coord_suspect is not None:
        conds.append(S.coord_suspect_containers > 0 if f.coord_suspect else S.coord_suspect_containers == 0)
    if f.coord_precision is not None:
        conds.append(S.coord_precision == f.coord_precision)
    if f.bbox is not None:
        conds.append(
            and_(
                S.latitude.between(f.bbox.min_lat, f.bbox.max_lat), S.longitude.between(f.bbox.min_lon, f.bbox.max_lon)
            )
        )
    terms = _terms(f.q)
    if terms:
        columns: list[Any] = [S.search_text, S.search_names] if f.search_names else [S.search_text]
        conds.extend(_search(columns, terms))
    return stmt.where(*conds)


def apply_container_filters[S: Select[*tuple[Any, ...]]](stmt: S, f: ContainerFilters) -> S:  # noqa: PLR0912
    C = MunicipalContainer
    conds: list[ColumnElement[bool]] = []
    if f.kind:
        conds.append(C.kind.in_(f.kind))
    if f.stream:
        conds.append(C.stream.in_(f.stream))
    if f.parish:
        conds.append(or_(C.parish_code.in_(f.parish), C.parish_dicofre.in_(f.parish)))
    if f.producer_type:
        conds.append(C.producer_type_key.in_(f.producer_type))
    if f.site_class:
        conds.append(C.site_id.in_(select(MunicipalSite.site_id).where(MunicipalSite.site_class.in_(f.site_class))))
    if f.textile_candidate is not None:
        sub = select(MunicipalSite.site_id).where(MunicipalSite.textile_candidate.is_(True))
        conds.append(C.site_id.in_(sub) if f.textile_candidate else C.site_id.not_in(sub) | C.site_id.is_(None))
    if f.coord_suspect is not None:
        conds.append(C.coord_suspect.is_(f.coord_suspect))
    if f.coord_precision is not None:
        conds.append(C.coord_precision == f.coord_precision)
    if f.located is not None:
        conds.append(C.coord_status == (CoordStatus.OK if f.located else CoordStatus.PENDING))
    if f.parish_match:
        conds.append(C.parish_match.in_(f.parish_match))
    if f.brand:
        conds.append(C.brand == f.brand.lower())
    if f.bbox is not None:
        conds.append(
            and_(
                C.latitude.between(f.bbox.min_lat, f.bbox.max_lat), C.longitude.between(f.bbox.min_lon, f.bbox.max_lon)
            )
        )
    terms = _terms(f.q)
    if terms:
        columns: list[Any] = [C.search_text, C.search_names] if f.search_names else [C.search_text]
        conds.extend(_search(columns, terms))
    return stmt.where(*conds)
