"""Exportação dos locais e dos contentores municipais: CSV e GeoJSON em streaming (lotes por cursor), XLSX em memória.

Os nomes de produtores só entram no ficheiro (e a coluna só existe) para admins com `show_names=true`.
"""

import csv
import io
import json
from collections.abc import AsyncIterator, Callable
from enum import StrEnum
from typing import Any

from openpyxl import Workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.features.municipal import mappers
from novelo.features.municipal.filters import ContainerFilters, SiteFilters, apply_container_filters, apply_site_filters
from novelo.features.municipal.models import MunicipalContainer, MunicipalSite
from novelo.features.municipal.schemas import MunicipalContainerOut, MunicipalSiteOut

BATCH = 500
LIST_SEPARATOR = "|"
BOM = "﻿"  # o Excel em português só reconhece UTF-8 com esta marca


class ExportFormat(StrEnum):
    CSV = "csv"
    XLSX = "xlsx"
    GEOJSON = "geojson"


class ExportScope(StrEnum):
    SITES = "sites"
    CONTAINERS = "containers"


MEDIA_TYPES = {
    ExportFormat.CSV: "text/csv; charset=utf-8",
    ExportFormat.XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ExportFormat.GEOJSON: "application/geo+json",
}

Row = dict[str, Any]


def site_row(s: MunicipalSiteOut, *, names: bool) -> Row:
    row: Row = {
        "site_id": s.site_id,
        "latitude": s.latitude,
        "longitude": s.longitude,
        "parish_dicofre": s.parish_dicofre,
        "parish_code": s.parish_code,
        "parish_name": s.parish_name,
        "site_class": s.site_class.value,
        "containers": s.containers,
        "units_declared": s.units_declared,
        "capacity_litres_total": s.capacity_litres_total,
        "capacity_unknown": s.capacity_unknown,
        **{f"n_{k}": v for k, v in s.by_kind.model_dump().items()},
        **{f"n_stream_{k}": v for k, v in s.by_stream.model_dump().items()},
        "kinds": LIST_SEPARATOR.join(k.value for k in s.kinds),
        "producer_types": LIST_SEPARATOR.join(p.value for p in s.producer_types),
        "streets": LIST_SEPARATOR.join(s.streets),
        "coord_precision": s.coord_precision.value,
        "organic_collective_within_15m": s.organic_collective_within_15m,
        "nn_distance_m": s.nn_distance_m,
        "textile_candidate": s.textile_candidate,
        "candidate_reason": s.candidate_reason,
        "coord_suspect_containers": s.coord_suspect_containers,
    }
    if names:
        row["producer_names"] = LIST_SEPARATOR.join(s.producer_names or [])
    return row


def container_row(c: MunicipalContainerOut, *, names: bool) -> Row:
    row = c.model_dump(mode="json", exclude={"producer_name"})
    if names:
        row["producer_name"] = c.producer_name
    return row


async def _batches(
    db: AsyncSession,
    scope: ExportScope,
    f: SiteFilters,
    names: bool,
) -> AsyncIterator[list[Row]]:
    """Linhas planas em lotes, por cursor sobre o identificador (sem OFFSET)."""
    last: str | None = None
    while True:
        if scope == ExportScope.SITES:
            S = MunicipalSite
            stmt = apply_site_filters(select(S), f).order_by(S.site_id).limit(BATCH)
            if last is not None:
                stmt = stmt.where(S.site_id > last)
            sites = list((await db.execute(stmt)).scalars())
            rows = [site_row(mappers.site_out(s, names=names), names=names) for s in sites]
            last = sites[-1].site_id if sites else None
        else:
            C = MunicipalContainer
            cf = ContainerFilters(**f.__dict__)
            cstmt = apply_container_filters(select(C), cf).order_by(C.container_uid).limit(BATCH)
            if last is not None:
                cstmt = cstmt.where(C.container_uid > last)
            containers = list((await db.execute(cstmt)).scalars())
            rows = [container_row(mappers.container_out(c, names=names), names=names) for c in containers]
            last = containers[-1].container_uid if containers else None
        if not rows:
            return
        yield rows
        if len(rows) < BATCH:
            return


_FORMULA_START = ("=", "+", "-", "@", "\t", "\r")


def _cell(value: Any) -> Any:
    """Vazio para `None`; texto que o Excel/Calc interpretaria como fórmula leva o prefixo `'` (CSV injection)."""
    if value is None:
        return ""
    if isinstance(value, str) and value.startswith(_FORMULA_START):
        return f"'{value}"
    return value


async def stream_csv(db: AsyncSession, scope: ExportScope, f: SiteFilters, names: bool) -> AsyncIterator[bytes]:
    header_done = False
    async for batch in _batches(db, scope, f, names):
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=list(batch[0]), extrasaction="ignore")
        if not header_done:
            buf.write(BOM)
            writer.writeheader()
            header_done = True
        for row in batch:
            writer.writerow({k: _cell(v) for k, v in row.items()})
        yield buf.getvalue().encode()
    if not header_done:  # sem linhas: ficheiro só com a marca UTF-8, para o Excel não protestar
        yield BOM.encode()


def _feature(row: Row, scope: ExportScope) -> Row | None:
    lat, lon = row.get("latitude"), row.get("longitude")
    if lat is None or lon is None:
        return None  # contentores pendentes (sem coordenadas) não têm geometria
    key = "site_id" if scope == ExportScope.SITES else "container_uid"
    props = {k: v for k, v in row.items() if k not in {"latitude", "longitude"}}
    return {
        "type": "Feature",
        "id": row[key],
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": props,
    }


async def stream_geojson(db: AsyncSession, scope: ExportScope, f: SiteFilters, names: bool) -> AsyncIterator[bytes]:
    yield b'{"type":"FeatureCollection","features":['
    first = True
    async for batch in _batches(db, scope, f, names):
        for row in batch:
            feature = _feature(row, scope)
            if feature is None:
                continue
            yield (("" if first else ",") + json.dumps(feature, ensure_ascii=False, separators=(",", ":"))).encode()
            first = False
    yield b"]}"


async def build_xlsx(db: AsyncSession, scope: ExportScope, f: SiteFilters, names: bool) -> AsyncIterator[bytes]:
    """XLSX é um zip: constrói-se por inteiro (write-only, memória baixa) e envia-se em blocos."""
    wb = Workbook(write_only=True)
    ws = wb.create_sheet("locais" if scope == ExportScope.SITES else "contentores")
    header_done = False
    async for batch in _batches(db, scope, f, names):
        if not header_done:
            ws.append(list(batch[0]))
            header_done = True
        for row in batch:
            ws.append([_cell(v) for v in row.values()])
    out = io.BytesIO()
    wb.save(out)
    data = out.getvalue()
    for i in range(0, len(data), 64 * 1024):
        yield data[i : i + 64 * 1024]


STREAMERS: dict[ExportFormat, Callable[[AsyncSession, ExportScope, SiteFilters, bool], AsyncIterator[bytes]]] = {
    ExportFormat.CSV: stream_csv,
    ExportFormat.GEOJSON: stream_geojson,
    ExportFormat.XLSX: build_xlsx,
}
