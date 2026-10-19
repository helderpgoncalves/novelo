# /// script
# requires-python = ">=3.12"
# dependencies = ["openpyxl>=3.1", "pyproj>=3.6"]
# ///
"""Contentores da Vitrus: ficheiros em data/raw/ -> data/processed/containers.csv + relatório de qualidade.

Uso: `just etl` (corre depois do ETL principal) ou `uv run scripts/etl/containers.py`.

Aceita .xlsx, .csv e .geojson em data/raw/ cujo nome contenha "contentor", "container" ou "ecoponto". O formato
exato só se conhece a 20 out 2026, por isso nada está fixo: as colunas são detetadas pelo nome (sem acentos nem
maiúsculas), as coordenadas podem vir como latitude/longitude (vírgula ou ponto decimal), X/Y em PT-TM06/ETRS89
(convertidas com pyproj), uma coluna única "lat, lon", ou geometria GeoJSON. Linhas só com morada/freguesia ficam
"pendentes" (sem coordenadas). Nunca se inventa nada: o que não bate certo é rejeitado e explicado.

Saídas (em data/processed/):
  containers.csv          uma linha por contentor aceite (coord_status = ok | pending)
  containers_rejected.csv uma linha por linha rejeitada, com o motivo
  containers_alerts.csv   alertas agregados para o ecrã "Qualidade dos dados" (mesmo formato que data_alerts.csv)
Sem ficheiro de contentores não escreve nada (e remove saídas antigas); o resto do ETL segue.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from collections.abc import Iterable, Iterator
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"

SOURCE_KEY = "vitrus_containers"
NAME_HINTS = ("contentor", "container", "ecoponto")
EXTENSIONS = {".xlsx", ".csv", ".geojson", ".json"}

# Caixa envolvente aproximada do concelho de Guimarães (WGS84), com margem. Fora dela a linha é rejeitada.
BBOX = {"lat_min": 41.30, "lat_max": 41.62, "lon_min": -8.60, "lon_max": -8.00}
DEFAULT_PROJECTED_EPSG = 3763  # PT-TM06 / ETRS89, o sistema oficial em Portugal continental
EXAMPLE_LIMIT = 8  # linhas citadas por alerta

COLUMNS = [
    "external_ref",
    "kind",
    "status",
    "latitude",
    "longitude",
    "coord_status",
    "address",
    "parish",
    "locality",
    "operator",
    "capacity_litres",
    "installed_on",
    "source_file",
    "source_line",
]

# --- Dicionários de cabeçalhos (normalizados: minúsculas, sem acentos, só letras/dígitos separados por espaço) ---
HEADERS: dict[str, tuple[str, ...]] = {
    "ref": (
        "n o", "no", "id contentor", "cod contentor", "codigo contentor", "n contentor", "numero contentor", "ref contentor",
        "id", "codigo", "cod", "referencia", "ref", "identificador", "numero", "num", "n", "objectid", "fid", "gid",
    ),
    "lat": ("latitude", "lat", "latitud", "lat wgs84", "latitude wgs84", "coord lat", "coordenada lat"),
    "lon": ("longitude", "lon", "long", "lng", "longitud", "lon wgs84", "longitude wgs84", "coord lon", "coordenada lon"),
    "x": ("x", "coord x", "coordenada x", "coordx", "xcoord", "x m", "easting", "x pt tm06", "x etrs89"),
    "y": ("y", "coord y", "coordenada y", "coordy", "ycoord", "y m", "northing", "y pt tm06", "y etrs89"),
    "latlon": ("coordenadas", "coordenada", "coords", "gps", "posicao gps", "localizacao gps", "lat lon", "lat long"),
    "kind": (
        "tipo contentor", "tipo de contentor", "tipologia", "tipo", "fluxo", "material", "categoria", "fileira",
        "tipo de residuo", "residuo", "kind",
    ),
    "status": ("estado", "situacao", "status", "estado contentor", "situacao contentor", "ativo", "operacional"),
    "address": ("morada", "endereco", "arruamento", "rua", "local", "localizacao", "designacao", "address"),
    "parish": ("freguesia", "uniao de freguesias", "freguesia concelho", "parish"),
    "locality": ("localidade", "lugar", "povoacao", "locality"),
    "operator": ("operador", "entidade", "empresa", "gestor", "entidade gestora", "operator"),
    "capacity": ("capacidade", "capacidade l", "capacidade litros", "volume", "volume l", "litros"),
    "installed": ("data instalacao", "instalado em", "data de instalacao", "data colocacao", "data"),
}

KIND_RULES: tuple[tuple[tuple[str, ...], str], ...] = (
    (("textil", "texteis", "roupa", "vestuario", "calcado", "vitrus textil"), "textile"),
    (("indiferenciad", "rsu", "lixo", "resto", "nao reciclavel"), "undifferentiated"),
    (("organic", "biorresiduo", "bio", "compost"), "organic"),
    (("reciclav", "papel", "cartao", "vidro", "vidrao", "plastico", "embalagem", "metal", "ecoponto", "oleao"), "recyclable"),
)
STATUS_RULES: tuple[tuple[tuple[str, ...], str], ...] = (
    (("inativ", "desativ", "removid", "retirad", "fora de servico", "avariad", "encerrad", "nao"), "inactive"),
    (("planea", "previst", "propost", "a instalar", "futuro", "em projeto"), "planned"),
    (("ativ", "operacional", "funcionamento", "instalad", "em servico", "sim", "ok"), "active"),
)

REASONS = {
    "bad_coordinates": "Coordenadas ilegíveis (não são números)",
    "outside_municipality": "Coordenadas fora do concelho de Guimarães",
    "no_location": "Sem coordenadas, morada, localidade nem freguesia",
    "not_a_point": "Geometria que não é um ponto",
    "duplicate_ref": "Referência repetida (mantida a primeira ocorrência)",
    "unknown_crs": "Sistema de coordenadas não suportado",
}


# --- Normalização de texto e números ---


def norm(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value if value is not None else ""))
    text = "".join(c for c in text if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def blank(value: object) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def parse_number(value: object) -> float | None:
    """Número com ponto ou vírgula decimal, espaços e separador de milhares. None se não for número."""
    if isinstance(value, bool):
        return None
    if isinstance(value, int | float):
        return float(value)
    if not isinstance(value, str):
        return None
    text = re.sub(r"[\s ]", "", value).replace("−", "-")
    if not re.fullmatch(r"[+-]?[\d.,]+", text):
        return None
    if "," in text and "." in text:
        decimal = "," if text.rfind(",") > text.rfind(".") else "."
        thousands = "." if decimal == "," else ","
        text = text.replace(thousands, "").replace(decimal, ".")
    elif "," in text:
        text = text.replace(",", ".") if text.count(",") == 1 else text.replace(",", "")
    elif text.count(".") > 1:
        text = text.replace(".", "")
    try:
        return float(text)
    except ValueError:
        return None


def parse_date(value: object) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, str):
        text = value.strip()
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y"):
            try:
                return datetime.strptime(text[:10], fmt).date().isoformat()
            except ValueError:
                continue
    return ""


def text_of(value: object) -> str:
    if blank(value):
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return re.sub(r"\s+", " ", str(value)).strip()


# --- Leitura dos ficheiros ---


@dataclass
class RawRow:
    file: str
    line: int
    cells: dict[str, Any]  # cabeçalho original -> valor
    geometry: dict[str, Any] | None = None  # só GeoJSON
    epsg: int | None = None  # CRS declarado no GeoJSON


def find_inputs(raw_dir: Path) -> list[Path]:
    """Ficheiros de contentores em data/raw/ (só no topo; `public/` é outra coisa)."""
    if not raw_dir.is_dir():
        return []
    return sorted(
        p
        for p in raw_dir.iterdir()
        if p.is_file()
        and p.suffix.lower() in EXTENSIONS
        and not p.name.startswith(("~$", "."))
        and any(h in norm(p.stem) for h in NAME_HINTS)
    )


def _score(headers: Iterable[object]) -> int:
    known = {norm(h) for names in HEADERS.values() for h in names if len(h) > 1}
    return sum(1 for h in headers if norm(h) in known)


def _delimiter(lines: list[str]) -> str:
    """Separador com o número de colunas mais constante nas primeiras linhas (a vírgula decimal não engana)."""
    sample = [ln for ln in lines[:20] if ln.strip()]
    best, best_score = ";", (0, 0)
    for d in ";,\t|":
        counts = Counter(ln.count(d) for ln in sample)
        count, freq = max(((c, f) for c, f in counts.items() if c > 0), key=lambda cf: cf[1], default=(0, 0))
        if (freq, count) > best_score:
            best, best_score = d, (freq, count)
    return best


def _read_csv(path: Path) -> Iterator[RawRow]:
    raw = path.read_bytes()
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:  # pragma: no cover - cp1252 raramente falha; latin-1 nunca falha
        text = raw.decode("latin-1")
    lines = text.splitlines()
    delimiter = _delimiter(lines)
    rows = list(csv.reader(lines, delimiter=delimiter))
    if not rows:
        return
    header_index = max(range(min(15, len(rows))), key=lambda i: (_score(rows[i]), -i))
    headers = [h.strip() for h in rows[header_index]]
    for offset, row in enumerate(rows[header_index + 1 :], start=header_index + 2):
        if not any(c.strip() for c in row):
            continue
        yield RawRow(path.name, offset, {h: (row[i].strip() if i < len(row) else "") for i, h in enumerate(headers) if h})


def _read_xlsx(path: Path) -> Iterator[RawRow]:
    import openpyxl

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        for ws in wb.worksheets:
            rows = list(ws.iter_rows(values_only=True))
            if not rows:
                continue
            idx = max(range(min(15, len(rows))), key=lambda i: (_score(rows[i]), -i))
            if _score(rows[idx]) == 0:
                continue  # folha sem cabeçalhos reconhecíveis (notas, legendas)
            headers = [text_of(h) for h in rows[idx]]
            sheet = f"{path.name}:{ws.title}" if len(wb.worksheets) > 1 else path.name
            for n, row in enumerate(rows[idx + 1 :], start=idx + 2):
                if all(blank(c) for c in row):
                    continue
                yield RawRow(sheet, n, {h: row[i] for i, h in enumerate(headers) if h and i < len(row)})
    finally:
        wb.close()


def _epsg_from_crs(doc: dict[str, Any]) -> int | None:
    name = str((doc.get("crs") or {}).get("properties", {}).get("name", ""))
    match = re.search(r"EPSG:+(\d+)", name, re.IGNORECASE) or re.search(r"/EPSG/\d+/(\d+)", name)
    return int(match.group(1)) if match else None


def _read_geojson(path: Path) -> Iterator[RawRow]:
    doc = json.loads(path.read_bytes().decode("utf-8-sig"))
    features = doc.get("features", []) if doc.get("type") == "FeatureCollection" else [doc]
    epsg = _epsg_from_crs(doc)
    for n, feature in enumerate(features, start=1):
        if not isinstance(feature, dict):
            continue
        yield RawRow(path.name, n, dict(feature.get("properties") or {}), feature.get("geometry"), epsg)


def read_rows(path: Path) -> list[RawRow]:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return list(_read_csv(path))
    if suffix == ".xlsx":
        return list(_read_xlsx(path))
    return list(_read_geojson(path))


# --- Deteção de colunas ---


def detect_columns(headers: Iterable[str]) -> dict[str, str]:
    """campo lógico -> cabeçalho original. Para cada campo ganha o sinónimo mais específico (primeiro da lista)."""
    by_norm = {norm(h): h for h in headers}
    found: dict[str, str] = {}
    for field_name, names in HEADERS.items():
        for name in names:
            if name in by_norm:
                found[field_name] = by_norm[name]
                break
    return found


def map_kind(value: object) -> tuple[str, bool]:
    """(valor do enum, reconhecido?). Vazio -> ('other', True): ausência não é erro de mapeamento."""
    text = norm(value)
    if not text:
        return "other", True
    for stems, kind in KIND_RULES:
        if any(re.search(rf"\b{re.escape(s)}", text) for s in stems):
            return kind, True
    return "other", False


def map_status(value: object) -> tuple[str, bool]:
    if isinstance(value, bool):
        return ("active" if value else "inactive"), True
    text = norm(value)
    if not text:
        return "active", False
    for stems, status in STATUS_RULES:
        if any(re.search(rf"\b{re.escape(s)}", text) for s in stems):
            return status, True
    return "active", False


# --- Coordenadas ---


def in_bbox(lat: float, lon: float) -> bool:
    return BBOX["lat_min"] <= lat <= BBOX["lat_max"] and BBOX["lon_min"] <= lon <= BBOX["lon_max"]


_transformers: dict[int, Any] = {}


def to_wgs84(x: float, y: float, epsg: int) -> tuple[float, float]:
    """(x, y) projetados -> (lat, lon) WGS84."""
    from pyproj import Transformer

    if epsg not in _transformers:
        _transformers[epsg] = Transformer.from_crs(epsg, 4326, always_xy=True)
    lon, lat = _transformers[epsg].transform(x, y)
    return lat, lon


def _declared_epsg(headers: Iterable[str], fallback: int | None) -> int:
    """EPSG sugerido pelo nome das colunas/ficheiro (ex.: 'X_PT-TM06'); senão o declarado; senão PT-TM06."""
    text = " ".join(norm(h) for h in headers)
    for pattern, epsg in (
        (r"\b(3763|tm06|pt tm06)\b", 3763),
        (r"\b25829\b|utm 29|utm29", 25829),
        (r"\b3857\b", 3857),
        (r"\b27493\b|datum 73|hayford", 27493),
    ):
        if re.search(pattern, text):
            return epsg
    return fallback or DEFAULT_PROJECTED_EPSG


@dataclass
class Located:
    lat: float
    lon: float
    swapped: bool = False


def locate(lat_raw: float, lon_raw: float, epsg: int | None) -> Located | None:
    """Aceita (lat, lon) em graus ou projetados; devolve None se nenhuma leitura cair no concelho."""
    candidates: list[tuple[float, float, bool]] = []
    graus = abs(lat_raw) <= 90 and abs(lon_raw) <= 180
    if graus:
        candidates += [(lat_raw, lon_raw, False), (lon_raw, lat_raw, True)]
    else:  # valores grandes: metros num CRS projetado (x = lon_raw, y = lat_raw)
        code = epsg or DEFAULT_PROJECTED_EPSG
        for x, y, swapped in ((lon_raw, lat_raw, False), (lat_raw, lon_raw, True)):
            try:
                candidates.append((*to_wgs84(x, y, code), swapped))
            except Exception:  # noqa: BLE001 - pyproj levanta vários tipos; qualquer falha = candidato inválido
                continue
    for lat, lon, swapped in candidates:
        if in_bbox(lat, lon):
            return Located(round(lat, 6), round(lon, 6), swapped)
    return None


# --- Normalização de linhas ---


@dataclass
class Result:
    containers: list[dict[str, str]] = field(default_factory=list)
    rejected: list[dict[str, str]] = field(default_factory=list)
    unknown_kinds: Counter[str] = field(default_factory=Counter)
    unknown_statuses: Counter[str] = field(default_factory=Counter)
    synthetic_refs: int = 0
    swapped: int = 0
    untyped: int = 0
    kind_default: str = "other"
    files: list[str] = field(default_factory=list)


def _reject(res: Result, row: RawRow, reason: str, ref: str = "") -> None:
    res.rejected.append(
        {"file": row.file, "line": str(row.line), "reason_key": reason, "reason": REASONS[reason], "external_ref": ref}
    )


def _coords_from_row(row: RawRow, cols: dict[str, str]) -> tuple[str, Located | None]:
    """('ok', Located) | ('pending', None) | ('<motivo de rejeição>', None)."""
    epsg = row.epsg or _declared_epsg(
        [cols[k] for k in ("x", "y", "lat", "lon", "latlon") if k in cols] + [row.file], None
    )
    g = row.geometry
    if g is not None:
        if g.get("type") != "Point":
            return "not_a_point", None
        coords = g.get("coordinates") or []
        if len(coords) < 2 or parse_number(coords[0]) is None or parse_number(coords[1]) is None:
            return "bad_coordinates", None
        pair: tuple[float, float] | None = (float(coords[1]), float(coords[0]))  # GeoJSON é [lon, lat]
    else:
        pair = None
        cells = row.cells
        for lat_key, lon_key in (("lat", "lon"), ("y", "x")):
            if lat_key in cols and lon_key in cols:
                a, b = cells.get(cols[lat_key]), cells.get(cols[lon_key])
                if blank(a) and blank(b):
                    continue
                lat, lon = parse_number(a), parse_number(b)
                if lat is None or lon is None:
                    return "bad_coordinates", None
                pair = (lat, lon)
                break
        if pair is None and "latlon" in cols and not blank(row.cells.get(cols["latlon"])):
            nums = re.findall(r"[-+]?\d+(?:[.,]\d+)?", str(row.cells[cols["latlon"]]))
            parsed = [parse_number(n) for n in nums]
            if len(parsed) != 2 or None in parsed:
                return "bad_coordinates", None
            pair = (float(parsed[0] or 0), float(parsed[1] or 0))
    if pair is None:
        has_place = any(not blank(row.cells.get(cols[k])) for k in ("address", "parish", "locality") if k in cols)
        return ("pending", None) if has_place else ("no_location", None)
    located = locate(pair[0], pair[1], epsg)
    return ("ok", located) if located else ("outside_municipality", None)


def normalise(rows: list[RawRow], default_kind: str = "other") -> Result:
    res = Result(kind_default=default_kind)
    seen: set[str] = set()
    by_file: dict[str, list[RawRow]] = defaultdict(list)
    for r in rows:
        by_file[r.file].append(r)
    for file, file_rows in by_file.items():
        res.files.append(file)
        headers = list(dict.fromkeys(h for r in file_rows for h in r.cells))
        cols = detect_columns(headers)
        for row in file_rows:
            cells = row.cells
            ref = text_of(cells.get(cols["ref"])) if "ref" in cols else ""
            state, located = _coords_from_row(row, cols)
            if state not in ("ok", "pending"):
                _reject(res, row, state, ref)
                continue
            if not ref:
                ref = f"{file}#L{row.line}"
                res.synthetic_refs += 1
            if ref in seen:
                _reject(res, row, "duplicate_ref", ref)
                continue
            seen.add(ref)
            raw_kind = cells.get(cols["kind"]) if "kind" in cols else None
            kind, kind_ok = map_kind(raw_kind)
            if "kind" not in cols or blank(raw_kind):
                kind = default_kind
                res.untyped += 1
            elif not kind_ok:
                res.unknown_kinds[text_of(raw_kind)] += 1
            raw_status = cells.get(cols["status"]) if "status" in cols else None
            status, status_ok = map_status(raw_status)
            if not status_ok and not blank(raw_status):
                res.unknown_statuses[text_of(raw_status)] += 1
            if located and located.swapped:
                res.swapped += 1
            res.containers.append(
                {
                    "external_ref": ref,
                    "kind": kind,
                    "status": status,
                    "latitude": f"{located.lat:.6f}" if located else "",
                    "longitude": f"{located.lon:.6f}" if located else "",
                    "coord_status": "ok" if located else "pending",
                    "address": text_of(cells.get(cols["address"])) if "address" in cols else "",
                    "parish": text_of(cells.get(cols["parish"])) if "parish" in cols else "",
                    "locality": text_of(cells.get(cols["locality"])) if "locality" in cols else "",
                    "operator": text_of(cells.get(cols["operator"])) if "operator" in cols else "",
                    "capacity_litres": _capacity(cells.get(cols["capacity"])) if "capacity" in cols else "",
                    "installed_on": parse_date(cells.get(cols["installed"])) if "installed" in cols else "",
                    "source_file": file,
                    "source_line": str(row.line),
                }
            )
    return res


def _capacity(value: object) -> str:
    n = parse_number(value) if not isinstance(value, str) else parse_number(re.sub(r"[^\d.,]", "", value))
    return str(int(n)) if n is not None and n > 0 else ""


# --- Relatório de qualidade ---


def build_alerts(res: Result) -> list[dict[str, str]]:
    """Alertas agregados no formato de data_alerts.csv (id, type_key, detail, suggestion)."""
    alerts: list[tuple[str, str, str]] = []

    if res.rejected:
        by_reason: dict[str, list[dict[str, str]]] = defaultdict(list)
        for r in res.rejected:
            by_reason[r["reason_key"]].append(r)
        parts = []
        for key, items in sorted(by_reason.items(), key=lambda kv: -len(kv[1])):
            lines = ", ".join(f"{i['file']} linha {i['line']}" for i in items[:EXAMPLE_LIMIT])
            more = f" (e mais {len(items) - EXAMPLE_LIMIT})" if len(items) > EXAMPLE_LIMIT else ""
            parts.append(f"{REASONS[key]}: {len(items)} ({lines}{more})")
        alerts.append(
            (
                "container_rows_rejected",
                f"{len(res.rejected)} linhas do ficheiro de contentores foram rejeitadas e não entram na rede. "
                + "; ".join(parts)
                + ".",
                "Corrigir as linhas na origem ou confirmar com a Vitrus; o detalhe está em containers_rejected.csv.",
            )
        )

    pending = [c for c in res.containers if c["coord_status"] == "pending"]
    if pending:
        refs = ", ".join(c["external_ref"] for c in pending[:EXAMPLE_LIMIT])
        more = f" (e mais {len(pending) - EXAMPLE_LIMIT})" if len(pending) > EXAMPLE_LIMIT else ""
        alerts.append(
            (
                "container_pending_location",
                f"{len(pending)} contentores só têm morada ou freguesia, sem coordenadas: {refs}{more}. "
                "Ficam pendentes e não contam para a cobertura.",
                "Pedir coordenadas à Vitrus ou geocodificar as moradas e voltar a correr o ETL.",
            )
        )

    notes = []
    if res.synthetic_refs:
        notes.append(f"{res.synthetic_refs} linhas sem referência: usada 'ficheiro#Llinha'")
    if res.unknown_kinds:
        notes.append("tipos não reconhecidos (contam como 'outro'): " + _top(res.unknown_kinds))
    if res.unknown_statuses:
        notes.append("estados não reconhecidos (contam como 'ativo'): " + _top(res.unknown_statuses))
    if res.swapped:
        notes.append(f"{res.swapped} linhas com latitude/longitude (ou X/Y) trocadas, corrigidas por cairem no concelho")
    if res.untyped and res.kind_default == "other":
        notes.append(f"{res.untyped} contentores sem tipo no ficheiro ficam como 'outro'")
    if notes:
        alerts.append(
            (
                "container_assumed_values",
                "Valores assumidos na importação de contentores: " + "; ".join(notes) + ".",
                "Confirmar o mapeamento de tipos e estados com a Vitrus.",
            )
        )
    return [
        {"id": str(i), "type_key": key, "detail": detail, "suggestion": suggestion}
        for i, (key, detail, suggestion) in enumerate(alerts, start=1)
    ]


def _top(counter: Counter[str], n: int = 6) -> str:
    return ", ".join(f"'{v}' ({c})" for v, c in counter.most_common(n))


# --- Escrita ---


def _write_csv(out: Path, name: str, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    with (out / name).open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def _update_manifest(out: Path, entry: dict[str, Any] | None) -> None:
    path = out / "sources.json"
    manifest: list[dict[str, Any]] = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    manifest = [m for m in manifest if m.get("key") != SOURCE_KEY]
    if entry:
        manifest.append(entry)
    if manifest or path.exists():
        path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def _digest(paths: list[Path]) -> str:
    h = hashlib.sha256()
    if len(paths) == 1:
        h.update(paths[0].read_bytes())
    else:  # vários ficheiros: ordem estável por nome
        for p in sorted(paths):
            h.update(p.name.encode() + b"\0" + p.read_bytes())
    return h.hexdigest()


def run(raw_dir: Path = RAW, out_dir: Path = OUT, default_kind: str = "other") -> dict[str, Any]:
    """Processa data/raw/. Sem ficheiros: não escreve nada, só remove saídas antigas deste ETL."""
    stale = ("containers.csv", "containers_rejected.csv", "containers_alerts.csv")
    inputs = find_inputs(raw_dir)
    if not inputs:
        for name in stale:
            (out_dir / name).unlink(missing_ok=True)
        _update_manifest(out_dir, None)
        return {"status": "awaiting_data", "files": []}

    rows = [r for p in inputs for r in read_rows(p)]
    res = normalise(rows, default_kind=default_kind)
    out_dir.mkdir(parents=True, exist_ok=True)
    _write_csv(out_dir, "containers.csv", COLUMNS, res.containers)
    _write_csv(out_dir, "containers_rejected.csv", ["file", "line", "reason_key", "reason", "external_ref"], res.rejected)
    alerts = build_alerts(res)
    _write_csv(out_dir, "containers_alerts.csv", ["id", "type_key", "detail", "suggestion"], alerts)
    received = datetime.fromtimestamp(max(p.stat().st_mtime for p in inputs), UTC).date().isoformat()
    _update_manifest(
        out_dir,
        {
            "key": SOURCE_KEY,
            "title": "Localização dos contentores",
            "provider": "Vitrus Ambiente",
            "file_name": ", ".join(p.name for p in inputs),
            "file_sha256": _digest(inputs),
            "received_on": received,
            "period_start": None,
            "period_end": None,
            "notes": "Ficheiro bruto em data/raw/; ver containers_rejected.csv para as linhas rejeitadas.",
        },
    )
    kinds = Counter(c["kind"] for c in res.containers)
    return {
        "status": "ok",
        "files": [p.name for p in inputs],
        "accepted": len(res.containers),
        "located": sum(1 for c in res.containers if c["coord_status"] == "ok"),
        "pending": sum(1 for c in res.containers if c["coord_status"] == "pending"),
        "rejected": len(res.rejected),
        "by_kind": dict(kinds),
        "alerts": len(alerts),
    }


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0] if __doc__ else None)
    parser.add_argument(
        "--default-kind",
        default="other",
        choices=["textile", "undifferentiated", "organic", "recyclable", "other"],
        help="Tipo a usar quando o ficheiro não tem coluna de tipo (por omissão 'other': não se assume nada).",
    )
    args = parser.parse_args()
    print(json.dumps(run(default_kind=args.default_kind), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
