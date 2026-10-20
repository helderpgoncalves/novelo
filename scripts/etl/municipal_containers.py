# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy>=1.26", "pyproj>=3.6", "pyshp>=2.3", "shapely>=2.0"]
# ///
"""Contentores MUNICIPAIS da Vitrus (pacote QGIS de 20 out 2026) -> data/processed/municipal_*.

ATENÇÃO: nada neste pacote é de têxteis. São os contentores municipais de todas as outras frações (profundidade,
superfície, orgânico coletivo, orgânico de produtores, resíduos verdes). NUNCA se misturam com a rede de têxteis
(`containers.py` -> `containers.csv`), que continua por receber. Esta infraestrutura serve de (1) pontos
candidatos junto de pontos de recolha existentes, (2) produtores com potencial têxtil, (3) geometria oficial das
freguesias, (4) referência de densidade.

Uso: `just etl` (corre depois de `build_processed.py`) ou `uv run scripts/etl/municipal_containers.py`.
Idempotente e determinístico: não lê relógio nem aleatoriedade; o mesmo raw dá os mesmos bytes.

Entradas (data/raw/vitrus-mapa-qgis/, só leitura):
  5 ficheiros .txt tabulados UTF-8/CRLF + Informação/Cont_AAD_CAOP2019 (shapefile CAOP 2019 de todo o país, PT-TM06).

Regras (todas contadas nos alertas, nunca em silêncio):
  - Coordenadas: o intervalo decide, não o nome da coluna. Latitude de Portugal continental está em 36,5..42,5 e
    longitude em -10..-6; um valor nunca cabe nos dois. Cada linha é classificada sozinha; `coord_swapped` diz que a
    coluna "Y" trazia a longitude. Caracteres espúrios (ex.: "Â") são removidos e a linha fica assinalada.
  - Concelho: ponto dentro da união das 48 freguesias CAOP 2019; até 50 m fora (o contorno é generalizado) fica
    aceite e assinalado; mais longe é rejeitado com a distância.
  - Freguesia: ponto-em-polígono (Dicofre CAOP). A freguesia declarada é normalizada (sem acentos, abreviaturas,
    uniões, nomes antigos) e comparada: igual | diferente | sem_coord | nao_mapeada.
  - Local (`site_id`): mesmas coordenadas arredondadas a 5 casas (~1 m) = mesmo local, em qualquer ficheiro.
  - Nada se apaga: contentores repetidos no mesmo ponto ficam todos (são unidades distintas); as linhas sem
    coordenadas ficam como `pending`; só a linha totalmente vazia e os pontos fora do concelho são rejeitados.

Saídas (data/processed/): municipal_containers.csv, municipal_sites.csv, municipal_containers_rejected.csv,
municipal_alerts.csv, municipal_by_parish.csv, municipal_links.csv, municipal_summary.json, caop_guimaraes.geojson e
qgis/guimaraes_contentores_municipais.gpkg (abrir no QGIS).
"""

# ruff: noqa: E501, PLR0912, PLR0915  (mensagens longas em português; funções de pipeline lineares)
from __future__ import annotations

import csv
import hashlib
import json
import re
import sqlite3
import statistics
import struct
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import numpy as np
import shapefile
import shapely
from pyproj import Transformer
from shapely.geometry import Point, mapping, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[2]
RAW_PACKAGE = ROOT / "data" / "raw" / "vitrus-mapa-qgis"
OUT = ROOT / "data" / "processed"
OSM_PARISHES = ROOT / "data" / "raw" / "public" / "parishes.geojson"

SOURCE_KEY = "vitrus_municipal_containers_2026_10"
RECEIVED_ON = "2026-10-20"
CAOP_STEM = "Informação/Cont_AAD_CAOP2019/Cont_AAD_CAOP2019"
MUNICIPALITY = "GUIMARÃES"

# Valores plausíveis para Portugal continental: nunca há ambiguidade entre latitude e longitude.
LAT_RANGE = (36.5, 42.5)
LON_RANGE = (-10.0, -6.0)
BOUNDARY_TOLERANCE_M = 50.0  # até aqui fora do contorno CAOP 2019 aceita-se (contorno generalizado; GPS de rua)
SITE_DECIMALS = Decimal("0.00001")  # 5 casas decimais ~ 1,1 m
LOW_PRECISION_DECIMALS = 3  # <= 3 casas ~ 100 m: coordenada aproximada
NEAR_DUPLICATE_M = 5.0  # locais distintos a menos disto = quase duplicados
LINK_RADIUS_M = 15.0  # raio para ligar o orgânico coletivo ao contentor de rua mais próximo
COVERAGE_RADII_M = (200, 300, 500)
SIMPLIFY_TOLERANCE_M = 5.0  # simplificação do contorno CAOP para a web
SUSPECT_DISTANCE_M = 1000.0  # freguesia declarada a mais disto do ponto: coordenada ou nome suspeitos
POTENTIAL_KG_PER_INHAB_MONTH = 0.7  # mesmo pressuposto de build_processed.py
TEXTILE_COLLECTED_T = 301.266  # 2025, 4 entidades (summary.json)
POPULATION_TOTAL = 156_830
CAPTURE_TODAY = TEXTILE_COLLECTED_T / (POPULATION_TOTAL * POTENTIAL_KG_PER_INHAB_MONTH * 12 / 1000)  # 22,9%

KINDS = ("underground", "surface", "platform", "organic_collective", "organic_producer", "green_waste")
PUBLIC_KINDS = {"underground", "surface", "platform", "organic_collective", "green_waste"}
STREET_KINDS = {"underground", "surface", "platform"}  # pontos de recolha na rua: candidatos para têxteis
PRODUCER_TYPES = {
    "restauracao": ("restaurant", "Restauração"),
    "escola": ("school", "Escola"),
    "estabelecimento": ("establishment", "Estabelecimento"),
    "grandes produtores": ("large_producer", "Grandes produtores"),
    "lar": ("care_home", "Lar"),
    "hotelaria": ("hospitality", "Hotelaria"),
}
BRANDS = {"molok": "molok", "bluebee": "bluebee", "greenbee": "greenbee"}


# --------------------------------------------------------------------------------------------------------------
# Texto e números
# --------------------------------------------------------------------------------------------------------------


def norm(value: object) -> str:
    """Minúsculas, sem acentos nem pontuação (para comparar nomes)."""
    text = unicodedata.normalize("NFKD", str(value if value is not None else ""))
    text = "".join(c for c in text if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def clean_text(value: str) -> str:
    """Tira espaços nas pontas (inclui NBSP) e colapsa espaços repetidos. Não muda maiúsculas nem acentos."""
    return re.sub(r"\s+", " ", value.replace(" ", " ")).strip()


def parse_capacity(raw: str) -> tuple[int | None, str]:
    """Capacidade em litros. Devolve (litros|None, estado): ok | assumed_litres | unknown.

    "5 m³" -> 5000; "1100L"/"80l " -> 1100/80; número sem unidade -> litros (estado assumed_litres);
    "???", "?" ou vazio -> None (unknown). Nunca se inventa um valor.
    """
    text = clean_text(raw).lower().replace(",", ".")
    if not text or set(text) <= {"?"}:
        return None, "unknown"
    match = re.fullmatch(r"(\d+(?:\.\d+)?)\s*(m3|m³|l|lt|litros?)?", text)
    if not match:
        return None, "unknown"
    number, unit = float(match.group(1)), match.group(2)
    if unit in ("m3", "m³"):
        return round(number * 1000), "ok"
    return (round(number), "ok") if unit else (round(number), "assumed_litres")


def parse_coordinate(raw: str) -> tuple[Decimal | None, bool]:
    """Texto -> Decimal. Remove caracteres espúrios (ex.: "Â", NBSP); devolve (valor, houve_limpeza)."""
    text = raw.strip()
    if not text:
        return None, False
    kept = re.sub(r"[^0-9.,+-]", "", text).replace(",", ".")
    try:
        value = Decimal(kept)
    except InvalidOperation:
        return None, False
    return value, kept != text


def decimals_of(value: Decimal) -> int:
    """Casas decimais significativas (sem zeros à direita): 41.488 -> 3."""
    return max(0, -int(value.normalize().as_tuple().exponent))


@dataclass(frozen=True)
class Coords:
    status: str  # ok | missing | invalid
    lat: Decimal | None = None
    lon: Decimal | None = None
    swapped: bool = False  # a coluna "Y" (latitude por convenção) trazia a longitude
    cleaned: bool = False
    decimals: int = 0
    detail: str = ""


def resolve_coords(y_raw: str, x_raw: str) -> Coords:
    """Classifica CADA linha pelo intervalo dos valores. `y_raw` é a coluna "Y" (latitude por convenção).

    lat em 36,5..42,5 e lon em -10..-6 não se sobrepõem, por isso a ordem certa é sempre decidível. Se as duas
    colunas estão vazias a linha fica `missing`; se só uma ou nenhuma combinação cabe em Portugal, `invalid`.
    """
    y, y_clean = parse_coordinate(y_raw)
    x, x_clean = parse_coordinate(x_raw)
    if y is None and x is None:
        return Coords("missing")
    if y is None or x is None:
        return Coords("invalid", detail="só uma das duas coordenadas está preenchida")

    def is_lat(v: Decimal) -> bool:
        return LAT_RANGE[0] <= float(v) <= LAT_RANGE[1]

    def is_lon(v: Decimal) -> bool:
        return LON_RANGE[0] <= float(v) <= LON_RANGE[1]

    cleaned = y_clean or x_clean
    if is_lat(y) and is_lon(x):
        lat, lon, swapped = y, x, False
    elif is_lon(y) and is_lat(x):
        lat, lon, swapped = x, y, True
    else:
        return Coords("invalid", detail=f"valores fora de Portugal continental: {y}; {x}")
    return Coords("ok", lat, lon, swapped, cleaned, min(decimals_of(lat), decimals_of(lon)))


def site_key(lat: Decimal, lon: Decimal) -> str:
    """Chave do local: coordenadas arredondadas a 5 casas (meio para cima, exato sobre o texto original)."""
    la = lat.quantize(SITE_DECIMALS, rounding=ROUND_HALF_UP)
    lo = lon.quantize(SITE_DECIMALS, rounding=ROUND_HALF_UP)
    return f"{la:.5f},{lo:.5f}"


def site_id_of(key: str) -> str:
    return "S" + hashlib.sha1(key.encode()).hexdigest()[:8]


def fmt_coord(value: Decimal | float, places: int = 7) -> str:
    text = f"{float(value):.{places}f}".rstrip("0").rstrip(".")
    return "0" if text in ("", "-0") else text


# --------------------------------------------------------------------------------------------------------------
# Freguesias: contorno CAOP e nomes declarados
# --------------------------------------------------------------------------------------------------------------

STOPWORDS = {"e", "de", "da", "do", "das", "dos"}
DROP_TOKENS = {"uf", "uniao", "freguesias", "freguesia"}
SAINTS = {"s", "sao", "santo", "santa", "sta", "sto"}
TOKEN_ALIASES: dict[str, tuple[str, ...]] = {
    "gomilhaes": ("gominhaes",),
    "penselo": ("pencelo",),
    "torcado": ("torcato",),
    "saotorcato": ("sx", "torcato"),
    "santiago": ("sx", "tiago"),
}
PHRASE_ALIASES: dict[tuple[str, ...], tuple[str, ...]] = {("oliveira", "castelo"): ("oliveira",)}


def name_tokens(text: str) -> tuple[str, ...]:
    """Nome de freguesia -> tokens comparáveis. Qualquer S./São/Santo/Santa/Sta./Sto. vira "sx" (os dados
    misturam-nos: "São Estevão" por "Santo Estêvão"); "uf", "união das freguesias de", "e", "de"... saem."""
    out: list[str] = []
    for tok in norm(text).split():
        if tok in DROP_TOKENS or tok in STOPWORDS:
            continue
        if tok in TOKEN_ALIASES:
            out.extend(TOKEN_ALIASES[tok])
        elif tok in SAINTS:
            out.append("sx")
        else:
            out.append(tok)
    tokens = tuple(out)
    return PHRASE_ALIASES.get(tokens, tokens)


@dataclass
class Parish:
    dicofre_caop: str
    name: str  # Freguesia (CAOP 2019)
    name_short: str  # Des_Simpli
    taa: str
    area_ha_attr: float
    code: str  # dicofre usado pela aplicação (parishes.csv); pode ser provisório (0308U1..)
    population: int | None
    geom: BaseGeometry  # PT-TM06 (EPSG:3763), metros
    area_ha: float = 0.0


@dataclass
class NameIndex:
    """Cada entrada é (tokens, índice da freguesia): o nome completo e cada componente das uniões."""

    parishes: list[Parish]
    entries: list[tuple[tuple[str, ...], int]] = field(default_factory=list)

    @classmethod
    def build(cls, parishes: list[Parish]) -> NameIndex:
        idx = cls(parishes=parishes)
        for i, p in enumerate(parishes):
            idx.entries.append((name_tokens(p.name), i))
            for comp in re.split(r",\s*|\s+e\s+", p.name_short):
                idx.entries.append((name_tokens(comp), i))
        idx.entries = [(t, i) for t, i in idx.entries if t]
        return idx

    def candidates(self, declared: str) -> tuple[frozenset[str], str]:
        """Nome declarado -> (Dicofre CAOP possíveis, nível do mapeamento).

        exact: mesma sequência de palavras ("Selho São Jorge"). same_words: as mesmas palavras noutra ordem
        ("S. Jorge de Selho"). contains_name: contém um nome inteiro ("Cemitério de Arosa"). partial: é parte de
        um nome ("Briteiros", "Airão") e pode ser ambíguo. none: não reconhecido.
        """
        tokens = name_tokens(declared)
        if not tokens:
            return frozenset(), "none"
        want = Counter(tokens)

        def codes(hits: list[int]) -> frozenset[str]:
            return frozenset(self.parishes[i].dicofre_caop for i in hits)

        found = [i for t, i in self.entries if t == tokens]
        if found:
            return codes(found), "exact"
        found = [i for t, i in self.entries if Counter(t) == want]
        if found:
            return codes(found), "same_words"
        contained = [(len(t), i) for t, i in self.entries if not (Counter(t) - want)]
        if contained:
            best = max(n for n, _ in contained)
            return codes([i for n, i in contained if n == best]), "contains_name"
        found = [i for t, i in self.entries if not (want - Counter(t))]
        if found:
            return codes(found), "partial"
        return frozenset(), "none"


def load_parishes(raw_dir: Path, parishes_csv: Path) -> tuple[list[Parish], dict[str, Any]]:
    """Lê as 48 freguesias de Guimarães do shapefile CAOP 2019 e liga-as ao parishes.csv (população INE)."""
    reader = shapefile.Reader(str(raw_dir / CAOP_STEM), encoding="utf-8")
    app: dict[str, dict[str, str]] = {}
    by_name: dict[str, dict[str, str]] = {}
    if parishes_csv.exists():
        with parishes_csv.open(encoding="utf-8", newline="") as fh:
            for row in csv.DictReader(fh):
                app[row["dicofre"]] = row
                by_name[norm(row["name"])] = row
    parishes: list[Parish] = []
    national_total = 0
    for sr in reader.iterShapeRecords():
        national_total += 1
        rec = sr.record.as_dict()
        if norm(rec["Concelho"]) != norm(MUNICIPALITY):
            continue
        row = app.get(rec["Dicofre"]) or by_name.get(norm(rec["Freguesia"]))
        geom = shape(sr.shape.__geo_interface__)
        parishes.append(
            Parish(
                dicofre_caop=rec["Dicofre"],
                name=clean_text(rec["Freguesia"]),
                name_short=clean_text(rec["Des_Simpli"]),
                taa=clean_text(rec["TAA"]),
                area_ha_attr=float(rec["AREA_T_Ha"]),
                code=row["dicofre"] if row else "",
                population=int(row["population"]) if row else None,
                geom=geom,
                area_ha=round(geom.area / 10_000, 2),
            )
        )
    parishes.sort(key=lambda p: p.dicofre_caop)
    return parishes, {"national_polygons": national_total, "guimaraes_polygons": len(parishes)}


# --------------------------------------------------------------------------------------------------------------
# Leitura dos ficheiros do pacote
# --------------------------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class FileSpec:
    key: str
    file: str
    kind: str
    y_col: str  # cabeçalho "Y": por convenção a latitude (em 3 dos 5 ficheiros traz a longitude)
    x_col: str  # cabeçalho "X"
    id_col: str = "ID"


FILES = (
    FileSpec("profundidade", "Contentores de Profundidade.txt", "underground", "Coord. Y", "Coord. X2"),
    FileSpec("superficie", "Contentores de Superfície.txt", "surface", "Coord_Y", "Coord_X"),
    FileSpec("organico_coletivo", "Contentores Orgânico - Coletivo.txt", "organic_collective", "Coord. Y", "Coord. X"),
    FileSpec("organico_tipologia", "Contentores Orgânico - Tipologia.txt", "organic_producer", "Coord_Y", "Coord_X"),
    FileSpec("residuos_verdes", "Contentores Resíduos Verdes.txt", "green_waste", "Coord. Y", "Coord. X"),
)
SPEC_BY_KEY = {s.key: s for s in FILES}


def read_tsv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    """Lê um .txt tabulado (UTF-8, CRLF, sem aspas). Cada linha leva `_line` (linha física; 1 = cabeçalho)."""
    with path.open(encoding="utf-8-sig", newline="") as fh:
        reader = csv.reader(fh, delimiter="\t", quoting=csv.QUOTE_NONE)
        names = [h.strip() for h in next(reader)]
        rows: list[dict[str, str]] = []
        for line_no, cells in enumerate(reader, start=2):
            row = {n: (cells[i] if i < len(cells) else "") for i, n in enumerate(names) if n}
            row["_line"] = str(line_no)
            rows.append(row)
    return [n for n in names if n], rows


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


CONTAINER_COLUMNS = [
    "container_uid", "source_file", "source_line", "external_id", "kind", "stream", "brand", "capacity_litres",
    "capacity_raw", "capacity_status", "producer_type", "producer_type_key", "producer_name", "street",
    "quantity", "declared_parish", "parish_dicofre", "parish_code", "parish_name", "parish_match",
    "parish_match_level", "parish_mismatch_distance_m", "coord_suspect", "latitude", "longitude", "coord_status", "coord_swapped",
    "coord_cleaned", "coord_decimals", "coord_precision", "boundary_note", "site_id", "units_at_site",
]  # fmt: skip
SITE_COLUMNS = [
    "site_id", "latitude", "longitude", "parish_dicofre", "parish_code", "parish_name", "site_class", "containers",
    "units_declared", "capacity_litres_total", "capacity_unknown", "n_underground", "n_surface", "n_platform",
    "n_organic_collective", "n_organic_producer", "n_green_waste", "n_stream_organic", "n_stream_green",
    "n_stream_unknown", "kinds", "producer_types", "producer_names", "streets", "source_files", "coord_precision",
    "organic_collective_within_15m", "nn_distance_m", "textile_candidate", "candidate_reason",
]  # fmt: skip
REJECTED_COLUMNS = ["source_file", "source_line", "external_id", "reason_key", "reason", "raw"]
LINK_COLUMNS = [
    "organic_uid", "nearest_street_uid", "nearest_street_kind", "distance_m", "within_link_radius",
    "same_number_uid", "same_number_distance_m", "same_number_same_street",
]  # fmt: skip


def normalise_row(spec: FileSpec, raw: dict[str, str]) -> dict[str, Any]:
    """Uma linha de um ficheiro -> campos comuns. Taxonomia só com o que os dados afirmam."""
    out: dict[str, Any] = {
        "source_file": spec.key,
        "source_line": int(raw["_line"]),
        "external_id": clean_text(raw.get(spec.id_col, "")),
        "kind": spec.kind,
        "stream": "desconhecido",
        "brand": "",
        "capacity_raw": "",
        "producer_type": "",
        "producer_type_key": "",
        "producer_name": "",
        "street": "",
        "quantity": "",
        "declared_parish": clean_text(raw.get("Freguesia", "")),
    }
    if spec.key == "profundidade":
        label = norm(raw.get("tipologia", ""))
        out["brand"] = BRANDS.get(label, "")
        if label == "plataforma":
            out["kind"] = "platform"
        out["capacity_raw"] = raw.get("cap.", "")
        out["street"] = clean_text(raw.get("Rua", ""))
    elif spec.key == "superficie":
        out["capacity_raw"] = raw.get("Capacidade", "")
        out["street"] = clean_text(raw.get("Nome", ""))
    elif spec.key == "organico_coletivo":
        out["stream"] = "organico"  # coluna Material = Orgânico em todas as linhas
        out["capacity_raw"] = raw.get("cap.", "")
        out["street"] = clean_text(raw.get("Rua", ""))
    elif spec.key == "organico_tipologia":
        out["stream"] = "organico"  # o nome do ficheiro é "Orgânico - Tipologia"
        out["capacity_raw"] = raw.get("Capacidade", "")
        out["producer_name"] = clean_text(raw.get("Nome", ""))
        label = norm(raw.get("Tipologia", ""))
        if label in PRODUCER_TYPES:
            out["producer_type_key"], out["producer_type"] = PRODUCER_TYPES[label]
    elif spec.key == "residuos_verdes":
        out["stream"] = "verdes"
        out["capacity_raw"] = raw.get("cap.", "")
        out["street"] = clean_text(raw.get("Rua", ""))
        out["quantity"] = clean_text(raw.get("Quantidade", ""))
    return out


# --------------------------------------------------------------------------------------------------------------
# Geometria
# --------------------------------------------------------------------------------------------------------------

TO_PROJECTED = Transformer.from_crs(4326, 3763, always_xy=True)
TO_WGS84 = Transformer.from_crs(3763, 4326, always_xy=True)


def project_points(lat: list[float], lon: list[float]) -> tuple[np.ndarray, np.ndarray]:
    x, y = TO_PROJECTED.transform(np.array(lon), np.array(lat))
    return np.asarray(x), np.asarray(y)


def to_wgs84(geom: BaseGeometry, places: int = 6) -> BaseGeometry:
    """PT-TM06 -> WGS84 com coordenadas arredondadas (6 casas ~ 0,1 m)."""
    return shapely.transform(geom, lambda c: np.round(np.column_stack(TO_WGS84.transform(c[:, 0], c[:, 1])), places))


def locate_points(parishes: list[Parish], xs: np.ndarray, ys: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Para cada ponto: freguesia que o contém (-1 = nenhuma), distância ao concelho (0 se dentro) e freguesia mais
    próxima. Usa as geometrias originais, não as simplificadas."""
    inside = np.full(len(xs), -1, dtype=int)
    for i, p in enumerate(parishes):
        mask = shapely.contains_xy(p.geom, xs, ys) & (inside < 0)
        inside[mask] = i
    municipality = unary_union([p.geom for p in parishes])
    points = shapely.points(xs, ys)
    dist = np.where(inside >= 0, 0.0, shapely.distance(points, municipality))
    nearest = inside.copy()
    for k in np.where(inside < 0)[0]:
        nearest[k] = int(np.argmin([p.geom.distance(points[k]) for p in parishes]))
    return inside, dist, nearest


def nearest_neighbour(xs: np.ndarray, ys: np.ndarray) -> np.ndarray:
    """Distância (m) de cada ponto ao vizinho mais próximo (outro ponto). NaN se só houver um."""
    n = len(xs)
    if n < 2:
        return np.full(n, np.nan)
    out = np.empty(n)
    for start in range(0, n, 512):
        stop = min(start + 512, n)
        d = np.hypot(xs[start:stop, None] - xs[None, :], ys[start:stop, None] - ys[None, :])
        d[np.arange(stop - start), np.arange(start, stop)] = np.inf
        out[start:stop] = d.min(axis=1)
    return out


# --------------------------------------------------------------------------------------------------------------
# Pipeline: leitura, normalização, geometria, locais
# --------------------------------------------------------------------------------------------------------------


def reject(spec: FileSpec, line: int, ext_id: str, key: str, detail: str, raw: dict[str, str]) -> dict[str, Any]:
    payload = {k: v for k, v in raw.items() if k != "_line"}
    return {
        "source_file": spec.key,
        "source_line": line,
        "external_id": ext_id,
        "reason_key": key,
        "reason": detail,
        "raw": json.dumps(payload, ensure_ascii=False, sort_keys=True),
    }


def process(raw_dir: Path, parishes_csv: Path) -> dict[str, Any]:
    parishes, caop_meta = load_parishes(raw_dir, parishes_csv)
    index = NameIndex.build(parishes)
    by_caop = {p.dicofre_caop: p for p in parishes}

    containers: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    raw_stats: dict[str, dict[str, Any]] = {}
    declared_variants: dict[str, Counter[str]] = defaultdict(Counter)

    for spec in FILES:
        header, rows = read_tsv(raw_dir / spec.file)
        ids = [clean_text(r.get(spec.id_col, "")) for r in rows]
        raw_stats[spec.key] = {
            "file": spec.file,
            "data_lines": len(rows),
            "columns": header,
            "unique_ids": len({i for i in ids if i}),
            "coords_swapped_vs_header": 0,
        }
        for raw in rows:
            line = int(raw["_line"])
            if not any(v.strip() for k, v in raw.items() if k != "_line"):
                rejected.append(reject(spec, line, "", "empty_row", "Linha totalmente vazia.", raw))
                continue
            row = normalise_row(spec, raw)
            cap, cap_status = parse_capacity(row["capacity_raw"])
            row["capacity_litres"] = cap if cap is not None else ""
            row["capacity_status"] = cap_status
            row["capacity_raw"] = clean_text(row["capacity_raw"])
            row["container_uid"] = f"{spec.key}:{row['external_id'] or 'linha' + raw['_line']}"
            declared_variants[spec.key][row["declared_parish"]] += 1
            c = resolve_coords(raw.get(spec.y_col, ""), raw.get(spec.x_col, ""))
            if c.status == "invalid":
                rejected.append(reject(spec, line, row["external_id"], "invalid_coordinates", c.detail, raw))
                continue
            row["_coords"], row["_raw"] = c, raw
            row["coord_status"] = "ok" if c.status == "ok" else "pending"
            if c.status == "ok":
                raw_stats[spec.key]["coords_swapped_vs_header"] += int(c.swapped)
            containers.append(row)

    # --- concelho e freguesia por ponto-em-polígono ---------------------------------------------------------
    located = [r for r in containers if r["coord_status"] == "ok"]
    xs, ys = project_points([float(r["_coords"].lat) for r in located], [float(r["_coords"].lon) for r in located])
    inside, dist, nearest = locate_points(parishes, xs, ys)
    outside: set[str] = set()
    for r, x, y, ins, d, near in zip(located, xs, ys, inside, dist, nearest, strict=True):
        r["_xy"] = (float(x), float(y))
        if ins < 0 and d > BOUNDARY_TOLERANCE_M:
            detail = f"A {d:.0f} m do contorno de Guimarães (CAOP 2019); freguesia declarada: {r['declared_parish']}."
            rejected.append(
                reject(SPEC_BY_KEY[r["source_file"]], r["source_line"], r["external_id"], "outside_municipality", detail, r["_raw"])
            )  # fmt: skip
            outside.add(r["container_uid"])
            continue
        p = parishes[int(near)]
        r["parish_dicofre"], r["parish_code"], r["parish_name"] = p.dicofre_caop, p.code, p.name
        r["boundary_note"] = (
            "" if ins >= 0 else f"fora do contorno a {d:.0f} m (aceite; tolerância {BOUNDARY_TOLERANCE_M:.0f} m)"
        )
    containers = [r for r in containers if r["container_uid"] not in outside]

    # --- freguesia declarada vs polígono --------------------------------------------------------------------
    for r in containers:
        cands, level = index.candidates(r["declared_parish"])
        r["_candidates"], r["parish_match_level"] = cands, level
        for k in ("parish_dicofre", "parish_code", "parish_name", "boundary_note"):
            r.setdefault(k, "")
        r["parish_mismatch_distance_m"] = ""
        r["coord_suspect"] = "false"
        if r["coord_status"] != "ok":
            r["parish_match"] = "sem_coord"
        elif not cands:
            r["parish_match"] = "nao_mapeada"
        elif r["parish_dicofre"] in cands:
            r["parish_match"] = "igual"
        else:
            r["parish_match"] = "diferente"
            pt = Point(*r["_xy"])
            r["parish_mismatch_distance_m"] = round(min(by_caop[c].geom.distance(pt) for c in cands))
            r["coord_suspect"] = str(r["parish_mismatch_distance_m"] > SUSPECT_DISTANCE_M).lower()

    # --- locais ---------------------------------------------------------------------------------------------
    sites: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in containers:
        c: Coords = r["_coords"]
        ok = c.status == "ok"
        r["site_id"] = site_id_of(site_key(c.lat, c.lon)) if ok and c.lat is not None and c.lon is not None else ""
        if r["site_id"]:
            sites[r["site_id"]].append(r)
        r["latitude"] = fmt_coord(c.lat) if c.lat is not None else ""
        r["longitude"] = fmt_coord(c.lon) if c.lon is not None else ""
        r["coord_swapped"] = str(c.swapped).lower() if ok else ""
        r["coord_cleaned"] = str(c.cleaned).lower() if ok else ""
        r["coord_decimals"] = c.decimals if ok else ""
        r["coord_precision"] = ("approximate" if c.decimals <= LOW_PRECISION_DECIMALS else "precise") if ok else ""
        r["units_at_site"] = 0
    for rows in sites.values():
        for r in rows:
            r["units_at_site"] = len(rows)

    return {
        "parishes": parishes,
        "index": index,
        "containers": containers,
        "rejected": rejected,
        "sites": build_sites(sites),
        "raw_stats": raw_stats,
        "declared_variants": declared_variants,
        "caop_meta": caop_meta,
    }


def build_sites(sites: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for sid, rows in sites.items():
        first = rows[0]
        c: Coords = first["_coords"]
        kinds = Counter(r["kind"] for r in rows)
        streams = Counter(r["stream"] for r in rows)
        caps = [r["capacity_litres"] for r in rows if r["capacity_litres"] != ""]
        has_public = any(r["kind"] in PUBLIC_KINDS for r in rows)
        has_producer = any(r["kind"] == "organic_producer" for r in rows)
        units = sum(int(r["quantity"]) if r["quantity"].isdigit() and int(r["quantity"]) > 0 else 1 for r in rows)
        top_parish = Counter(r["parish_dicofre"] for r in rows).most_common(1)[0][0]
        pr = next(r for r in rows if r["parish_dicofre"] == top_parish)
        out.append(
            {
                "site_id": sid,
                "latitude": fmt_coord(c.lat, 5),  # type: ignore[arg-type]
                "longitude": fmt_coord(c.lon, 5),  # type: ignore[arg-type]
                "parish_dicofre": pr["parish_dicofre"],
                "parish_code": pr["parish_code"],
                "parish_name": pr["parish_name"],
                "site_class": "mixed" if has_public and has_producer else ("public" if has_public else "producer"),
                "containers": len(rows),
                "units_declared": units,
                "capacity_litres_total": sum(caps),
                "capacity_unknown": len(rows) - len(caps),
                **{f"n_{k}": kinds.get(k, 0) for k in KINDS},
                "n_stream_organic": streams.get("organico", 0),
                "n_stream_green": streams.get("verdes", 0),
                "n_stream_unknown": streams.get("desconhecido", 0),
                "kinds": "|".join(sorted(kinds)),
                "producer_types": "|".join(sorted({r["producer_type"] for r in rows if r["producer_type"]})),
                "producer_names": "|".join(sorted({r["producer_name"] for r in rows if r["producer_name"]})),
                "streets": "|".join(sorted({r["street"] for r in rows if r["street"]})),
                "source_files": "|".join(sorted({r["source_file"] for r in rows})),
                "coord_precision": "approximate"
                if any(r["coord_precision"] == "approximate" for r in rows)
                else "precise",
                "organic_collective_within_15m": 0,
                "nn_distance_m": "",
                "textile_candidate": "false",
                "candidate_reason": "",
                "_xy": first["_xy"],
                "_rows": rows,
            }
        )
    out.sort(key=lambda s: (s["parish_dicofre"], s["latitude"], s["longitude"], s["site_id"]))
    return out


# --------------------------------------------------------------------------------------------------------------
# Análise espacial e estatística
# --------------------------------------------------------------------------------------------------------------


def pct(part: float, whole: float, places: int = 1) -> float:
    return round(100 * part / whole, places) if whole else 0.0


def quantiles(values: list[float]) -> dict[str, float]:
    v = np.array([x for x in values if not np.isnan(x)], dtype=float)
    if not len(v):
        return {}
    q = np.percentile(v, [5, 25, 50, 75, 95])
    return {
        "n": len(v), "mean": round(float(v.mean()), 1), "p5": round(float(q[0]), 1),
        "p25": round(float(q[1]), 1), "median": round(float(q[2]), 1), "p75": round(float(q[3]), 1),
        "p95": round(float(q[4]), 1), "max": round(float(v.max()), 1),
    }  # fmt: skip


def candidate_reason(s: dict[str, Any]) -> str:
    parts = ["ponto de recolha na rua"]
    if s["n_underground"]:
        parts.append("contentor de profundidade")
    if s["n_organic_collective"] or s["organic_collective_within_15m"]:
        parts.append("com orgânico coletivo a menos de 15 m")
    if s["n_underground"] + s["n_surface"] + s["n_platform"] + s["n_organic_collective"] >= 3:
        parts.append("3 ou mais contentores")
    if s["coord_precision"] == "approximate":
        parts.append("coordenada aproximada (confirmar no terreno)")
    return "; ".join(parts)


def build_links(containers: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Liga cada contentor de orgânico coletivo ao contentor de rua mais próximo e verifica se o número do ID
    coincide (BCn <-> n de Profundidade). Só descreve; não altera os contentores."""
    street = [r for r in containers if r["kind"] in STREET_KINDS and r["coord_status"] == "ok"]
    coll = [r for r in containers if r["kind"] == "organic_collective" and r["coord_status"] == "ok"]
    if not street or not coll:
        return [], {}
    sxy = np.array([r["_xy"] for r in street])
    deep_by_id = {r["external_id"]: r for r in street if r["source_file"] == "profundidade"}
    links: list[dict[str, Any]] = []
    twins = twins_close = 0
    for r in coll:
        x, y = r["_xy"]
        d = np.hypot(sxy[:, 0] - x, sxy[:, 1] - y)
        j = int(np.argmin(d))
        match = re.fullmatch(r"BC(\d+)", r["external_id"])
        twin = deep_by_id.get(match.group(1)) if match else None
        twin_d = float(np.hypot(twin["_xy"][0] - x, twin["_xy"][1] - y)) if twin else None
        if twin is not None and twin_d is not None:
            twins += 1
            twins_close += int(twin_d <= LINK_RADIUS_M)
        links.append(
            {
                "organic_uid": r["container_uid"],
                "nearest_street_uid": street[j]["container_uid"],
                "nearest_street_kind": street[j]["kind"],
                "distance_m": round(float(d[j]), 1),
                "within_link_radius": str(bool(d[j] <= LINK_RADIUS_M)).lower(),
                "same_number_uid": twin["container_uid"] if twin else "",
                "same_number_distance_m": round(twin_d, 1) if twin_d is not None else "",
                "same_number_same_street": str(norm(twin["street"]) == norm(r["street"])).lower() if twin else "",
            }
        )
    close = [x for x in links if x["within_link_radius"] == "true"]
    return links, {
        "organic_collective_located": len(coll),
        "street_located": len(street),
        "radius_m": LINK_RADIUS_M,
        "organic_with_street_within_radius": len(close),
        "organic_with_underground_nearest": sum(1 for x in close if x["nearest_street_kind"] == "underground"),
        "bc_with_same_number_underground": twins,
        "bc_same_number_within_radius": twins_close,
        "bc_same_number_same_street": sum(1 for x in links if x["same_number_same_street"] == "true"),
        "median_distance_to_nearest_street_m": round(float(np.median([x["distance_m"] for x in links])), 1),
    }


def bc_series(containers: list[dict[str, Any]]) -> dict[str, Any]:
    """Os IDs BCn do orgânico coletivo e dos resíduos verdes formam uma única série? (descoberta, não regra)"""
    numbers = {
        s: sorted(int(r["external_id"][2:]) for r in containers if r["source_file"] == s and re.fullmatch(r"BC\d+", r["external_id"]))
        for s in ("organico_coletivo", "residuos_verdes")
    }  # fmt: skip
    union = sorted(set(numbers["organico_coletivo"]) | set(numbers["residuos_verdes"]))
    overlap = set(numbers["organico_coletivo"]) & set(numbers["residuos_verdes"])
    return {
        "organico_coletivo": len(numbers["organico_coletivo"]),
        "residuos_verdes": len(numbers["residuos_verdes"]),
        "min": union[0] if union else None,
        "max": union[-1] if union else None,
        "overlap": len(overlap),
        "union_is_contiguous": bool(union) and union == list(range(union[0], union[-1] + 1)),
    }


def near_duplicates(sites: list[dict[str, Any]]) -> dict[str, Any]:
    """Pares de locais DISTINTOS (coordenadas diferentes a 5 casas) a menos de 5 m: entre ficheiros e no mesmo."""
    cross: Counter[str] = Counter()
    same: Counter[str] = Counter()
    if len(sites) < 2:
        return {"cross_file_pairs": 0, "same_file_pairs": 0}
    xy = np.array([s["_xy"] for s in sites])
    for i in range(len(sites) - 1):
        d = np.hypot(xy[i + 1 :, 0] - xy[i, 0], xy[i + 1 :, 1] - xy[i, 1])
        for k in np.where(d < NEAR_DUPLICATE_M)[0]:
            a, b = sites[i], sites[i + 1 + int(k)]
            fa, fb = set(a["source_files"].split("|")), set(b["source_files"].split("|"))
            label = " ~ ".join(sorted(["+".join(sorted(fa)), "+".join(sorted(fb))]))
            (cross if fa != fb else same)[label] += 1
    return {
        "cross_file_pairs": sum(cross.values()),
        "cross_file_by_files": dict(cross.most_common()),
        "same_file_pairs": sum(same.values()),
        "same_file_by_file": dict(same.most_common()),
    }


def analyse(data: dict[str, Any]) -> dict[str, Any]:
    parishes: list[Parish] = data["parishes"]
    sites: list[dict[str, Any]] = data["sites"]
    containers: list[dict[str, Any]] = data["containers"]

    # vizinho mais próximo e cobertura: só locais públicos (a rede de rua), em todo o concelho
    public = [s for s in sites if s["site_class"] in ("public", "mixed")]
    pxy = np.array([s["_xy"] for s in public]).reshape(-1, 2)
    nn = nearest_neighbour(pxy[:, 0], pxy[:, 1])
    for s, d in zip(public, nn, strict=True):
        s["nn_distance_m"] = "" if np.isnan(d) else round(float(d), 1)
    municipality = unary_union([p.geom for p in parishes])
    points = shapely.points(pxy[:, 0], pxy[:, 1])
    coverage: dict[int, dict[str, float]] = {}
    for radius in COVERAGE_RADII_M:
        union = unary_union(shapely.buffer(points, radius, quad_segs=16))
        per = {p.dicofre_caop: pct(p.geom.intersection(union).area, p.geom.area) for p in parishes}
        per["_municipality"] = pct(municipality.intersection(union).area, municipality.area)
        coverage[radius] = per

    # candidatos a têxteis: locais públicos com contentor de rua (profundidade, superfície ou plataforma)
    organic_xy = np.array(
        [r["_xy"] for r in containers if r["kind"] == "organic_collective" and r["coord_status"] == "ok"]
    ).reshape(-1, 2)
    for s in sites:
        if len(organic_xy):
            d = np.hypot(organic_xy[:, 0] - s["_xy"][0], organic_xy[:, 1] - s["_xy"][1])
            s["organic_collective_within_15m"] = int((d <= LINK_RADIUS_M).sum())
        if s["site_class"] in ("public", "mixed") and s["n_underground"] + s["n_surface"] + s["n_platform"]:
            s["textile_candidate"], s["candidate_reason"] = "true", candidate_reason(s)

    rows_by_parish: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in containers:
        if r["coord_status"] == "ok":
            rows_by_parish[r["parish_dicofre"]].append(r)
    sites_by_parish: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for s in sites:
        sites_by_parish[s["parish_dicofre"]].append(s)
    pending: Counter[str] = Counter()
    for r in containers:
        if r["coord_status"] == "pending" and len(r["_candidates"]) == 1:
            pending[next(iter(r["_candidates"]))] += 1

    by_parish: list[dict[str, Any]] = []
    for p in parishes:
        rows = rows_by_parish.get(p.dicofre_caop, [])
        psites = sites_by_parish.get(p.dicofre_caop, [])
        ppublic = [s for s in psites if s["site_class"] in ("public", "mixed")]
        n_cand = sum(1 for s in psites if s["textile_candidate"] == "true")
        kinds = Counter(r["kind"] for r in rows)
        types = Counter(r["producer_type_key"] for r in rows if r["producer_type_key"])
        pop = p.population or 0
        area_km2 = p.geom.area / 1_000_000
        potential_t = pop * POTENTIAL_KG_PER_INHAB_MONTH * 12 / 1000
        gap_t = potential_t * (1 - CAPTURE_TODAY)
        nn_vals = [s["nn_distance_m"] for s in ppublic if s["nn_distance_m"] != ""]
        by_parish.append(
            {
                "dicofre": p.code or p.dicofre_caop,
                "dicofre_caop": p.dicofre_caop,
                "name": p.name,
                "population": pop,
                "area_km2": round(area_km2, 3),
                "containers": len(rows),
                "containers_pending": pending.get(p.dicofre_caop, 0),
                "sites": len(psites),
                "public_sites": len(ppublic),
                **{f"n_{k}": kinds.get(k, 0) for k in KINDS},
                "containers_per_1000_hab": round(1000 * len(rows) / pop, 2) if pop else "",
                "public_sites_per_1000_hab": round(1000 * len(ppublic) / pop, 2) if pop else "",
                "containers_per_km2": round(len(rows) / area_km2, 2),
                "public_sites_per_km2": round(len(ppublic) / area_km2, 2),
                "mean_nn_distance_m": round(statistics.fmean(nn_vals), 1) if nn_vals else "",
                "median_nn_distance_m": round(statistics.median(nn_vals), 1) if nn_vals else "",
                "capacity_litres_total": sum(r["capacity_litres"] for r in rows if r["capacity_litres"] != ""),
                "cover_pct_200m": coverage[200][p.dicofre_caop],
                "cover_pct_300m": coverage[300][p.dicofre_caop],
                "cover_pct_500m": coverage[500][p.dicofre_caop],
                **{f"producers_{key}": types.get(key, 0) for key, _label in PRODUCER_TYPES.values()},
                "containers_coord_suspect": sum(1 for r in rows if r["coord_suspect"] == "true"),
                "candidate_sites": n_cand,
                "candidate_sites_precise": sum(
                    1 for s in psites if s["textile_candidate"] == "true" and s["coord_precision"] == "precise"
                ),
                "textile_potential_t_estimate": round(potential_t, 1),
                "textile_gap_t_estimate": round(gap_t, 1),
                "gap_t_per_candidate_site": round(gap_t / max(1, n_cand), 2),
                "gap_rank": 0,
            }
        )
    for rank, r in enumerate(sorted(by_parish, key=lambda r: (-r["gap_t_per_candidate_site"], r["dicofre_caop"])), 1):
        r["gap_rank"] = rank
    by_parish.sort(key=lambda r: r["dicofre_caop"])

    links, link_summary = build_links(containers)
    return {
        "by_parish": by_parish,
        "links": links,
        "coverage_pct_of_municipality": {f"{r}m": coverage[r]["_municipality"] for r in COVERAGE_RADII_M},
        "nn_distance_m": quantiles(list(nn)),
        "link_summary": link_summary,
        "bc_series": bc_series(containers),
        "near_duplicates": near_duplicates(sites),
    }


def descriptive(data: dict[str, Any], by_parish: list[dict[str, Any]]) -> dict[str, Any]:
    """Estatística descritiva para o documento: distribuições, locais com muitos contentores, produtores."""
    containers: list[dict[str, Any]] = data["containers"]
    sites: list[dict[str, Any]] = data["sites"]
    located = [r for r in containers if r["coord_status"] == "ok"]

    def top_sites(key: str, n: int = 10) -> list[dict[str, Any]]:
        ranked = sorted(sites, key=lambda s: (-s[key], s["site_id"]))[:n]
        return [
            {
                "site_id": s["site_id"], "containers": s["containers"], "units_declared": s["units_declared"],
                "capacity_litres_total": s["capacity_litres_total"], "parish": s["parish_name"],
                "latitude": s["latitude"], "longitude": s["longitude"], "kinds": s["kinds"],
                "label": (s["producer_names"] or s["streets"]).split("|")[0],
            }
            for s in ranked
        ]  # fmt: skip

    sizes = Counter(s["containers"] for s in sites)
    producer_names: dict[tuple[str, str], int] = Counter()
    for r in located:
        if r["kind"] == "organic_producer":
            producer_names[(norm(r["producer_name"]), r["producer_type_key"])] += 1
    by_type: dict[str, dict[str, Any]] = {}
    for key, label in PRODUCER_TYPES.values():
        rows = [r for r in containers if r["producer_type_key"] == key]
        caps = [r["capacity_litres"] for r in rows if r["capacity_litres"] != ""]
        by_type[key] = {
            "label": label,
            "containers": len(rows),
            "located": sum(1 for r in rows if r["coord_status"] == "ok"),
            "capacity_litres_total": sum(caps),
            "producers_distinct": len({norm(r["producer_name"]) for r in rows}),
            "top_parishes": Counter(r["parish_name"] for r in rows if r["parish_name"]).most_common(5),
        }
    by_kind: dict[str, dict[str, Any]] = {}
    for k in KINDS:
        rows = [r for r in containers if r["kind"] == k]
        caps = [r["capacity_litres"] for r in rows if r["capacity_litres"] != ""]
        by_kind[k] = {
            "containers": len(rows),
            "located": sum(1 for r in rows if r["coord_status"] == "ok"),
            "capacity_litres_total": sum(caps),
            "capacity_values": dict(sorted(Counter(r["capacity_litres"] for r in rows if r["capacity_litres"] != "").items())),
            "brands": dict(Counter(r["brand"] for r in rows if r["brand"])),
        }  # fmt: skip
    return {
        "by_kind": by_kind,
        "by_producer_type": by_type,
        "site_size_distribution": dict(sorted(sizes.items())),
        "top_sites_by_containers": top_sites("containers"),
        "top_sites_by_capacity": top_sites("capacity_litres_total", 5),
        "repeated_producers": [
            {"name": n, "type": t, "containers": c} for (n, t), c in sorted(producer_names.items(), key=lambda x: (-x[1], x[0])) if c >= 4
        ][:10],
        "parishes_ranked_by_gap": [
            {"rank": r["gap_rank"], "name": r["name"], "gap_t": r["textile_gap_t_estimate"], "candidate_sites": r["candidate_sites"],
             "gap_t_per_candidate_site": r["gap_t_per_candidate_site"], "population": r["population"]}
            for r in sorted(by_parish, key=lambda r: r["gap_rank"])[:10]
        ],
    }  # fmt: skip


# --------------------------------------------------------------------------------------------------------------
# CAOP: contorno simplificado para a web e comparação com o OSM
# --------------------------------------------------------------------------------------------------------------


def caop_geojson(parishes: list[Parish]) -> dict[str, Any]:
    features = []
    for p in parishes:
        simple = shapely.simplify(p.geom, SIMPLIFY_TOLERANCE_M, preserve_topology=True)
        wgs = to_wgs84(simple)
        if not wgs.is_valid:
            wgs = shapely.make_valid(wgs)
        centre = to_wgs84(p.geom.representative_point())
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "dicofre": p.code or p.dicofre_caop,
                    "dicofre_caop": p.dicofre_caop,
                    "name": p.name,
                    "name_short": p.name_short,
                    "taa": p.taa,
                    "area_ha": p.area_ha,
                    "population": p.population,
                    "lat": round(centre.y, 6),
                    "lon": round(centre.x, 6),
                },
                "geometry": mapping(wgs),
            }
        )
    return {
        "type": "FeatureCollection",
        "name": "caop_guimaraes",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "metadata": {
            "source": "CAOP 2019 (DGT), Cont_AAD_CAOP2019.shp, filtrado Concelho = GUIMARÃES",
            "simplify_tolerance_m": SIMPLIFY_TOLERANCE_M,
            "coordinates": "WGS84, 6 casas decimais",
        },
        "features": features,
    }


def compare_with_osm(parishes: list[Parish], osm_path: Path) -> dict[str, Any]:
    """CAOP 2019 vs contornos do OSM usados na app (data/raw/public/parishes.geojson): área e sobreposição."""
    if not osm_path.exists():
        return {}
    collection = json.loads(osm_path.read_text(encoding="utf-8"))
    osm = {f["properties"]["dicofre"]: shape(f["geometry"]) for f in collection["features"] if f.get("geometry")}
    rows = []
    missing = []
    for p in parishes:
        g = osm.get(p.code)
        if g is None:
            missing.append(p.name)
            continue
        gp = shapely.transform(g, lambda c: np.column_stack(TO_PROJECTED.transform(c[:, 0], c[:, 1])))
        if not gp.is_valid:
            gp = shapely.make_valid(gp)
        inter, union = p.geom.intersection(gp).area, p.geom.union(gp).area
        rows.append(
            {
                "dicofre": p.code,
                "name": p.name,
                "area_caop_km2": round(p.geom.area / 1e6, 3),
                "area_osm_km2": round(gp.area / 1e6, 3),
                "diff_pct": round(100 * (gp.area - p.geom.area) / p.geom.area, 1),
                "iou_pct": round(100 * inter / union, 1),
                "centroid_shift_m": round(float(p.geom.centroid.distance(gp.centroid)), 0),
            }
        )
    broken = [r["name"] for r in rows if r["iou_pct"] < 50]  # geometria OSM minúscula ou noutro sítio
    good = [r for r in rows if r["iou_pct"] >= 50]
    total_caop = sum(r["area_caop_km2"] for r in good)
    total_osm = sum(r["area_osm_km2"] for r in good)
    return {
        "parishes_compared": len(good),
        "missing_in_osm": missing,
        "broken_in_osm": broken,
        "area_caop_km2": round(total_caop, 2),
        "area_osm_km2": round(total_osm, 2),
        "diff_pct": round(100 * (total_osm - total_caop) / total_caop, 2) if total_caop else None,
        "iou_pct_min": min(r["iou_pct"] for r in good) if good else None,
        "iou_pct_median": round(statistics.median(r["iou_pct"] for r in good), 1) if good else None,
        "worst_iou": sorted(good, key=lambda r: r["iou_pct"])[:5],
        "rows": rows,
    }


# --------------------------------------------------------------------------------------------------------------
# Alertas (formato de data_alerts.csv: id, type_key, detail, suggestion)
# --------------------------------------------------------------------------------------------------------------


def examples(items: list[str], limit: int = 8) -> str:
    return ", ".join(items[:limit]) + (f" (+{len(items) - limit})" if len(items) > limit else "")


def build_alerts(
    data: dict[str, Any], analysis: dict[str, Any], extra: dict[str, Any], osm: dict[str, Any]
) -> list[dict[str, str]]:
    containers: list[dict[str, Any]] = data["containers"]
    rejected: list[dict[str, Any]] = data["rejected"]
    parishes: list[Parish] = data["parishes"]
    raw_stats: dict[str, dict[str, Any]] = data["raw_stats"]
    alerts: list[tuple[str, str, str]] = []
    files = lambda rows: Counter(r["source_file"] for r in rows)  # noqa: E731

    alerts.append((
        "municipal_not_textile",
        f"Os 5 ficheiros do pacote QGIS ({sum(st['data_lines'] for st in raw_stats.values())} linhas) são de contentores MUNICIPAIS de outras frações (profundidade, superfície, orgânico, resíduos verdes). Nenhum é de têxteis.",
        "Manter esta rede separada da rede de têxteis; pedir à Vitrus a lista de contentores de têxteis.",
    ))  # fmt: skip
    pending = [r for r in containers if r["coord_status"] == "pending"]
    if pending:
        counts = files(pending)
        alerts.append((
            "municipal_coords_missing",
            f"{len(pending)} contentores sem coordenadas ({', '.join(f'{k}: {v}' for k, v in counts.items())}): "
            + examples([r["external_id"] for r in pending]),
            "Ficam como pendentes (não entram no mapa nem nas contagens por freguesia). Pedir as coordenadas à Vitrus.",
        ))  # fmt: skip
    for key, st in raw_stats.items():
        if st["coords_swapped_vs_header"]:
            spec = SPEC_BY_KEY[key]
            alerts.append((
                "municipal_coords_swapped",
                f"{st['file']}: em {st['coords_swapped_vs_header']} linhas a coluna \"{spec.y_col}\" traz a longitude e \"{spec.x_col}\" a latitude (cabeçalhos trocados face à convenção Y = latitude).",
                "Corrigido pelo intervalo dos valores (linha a linha); sem perda. Pedir à Vitrus que corrija os cabeçalhos.",
            ))  # fmt: skip
    cleaned = [r for r in containers if r["coord_cleaned"] == "true"]
    if cleaned:
        alerts.append((
            "municipal_coords_artifact",
            f"{len(cleaned)} coordenada(s) com caracteres espúrios (ex.: \"Â\", espaço não separável), removidos: "
            + examples([r["container_uid"] for r in cleaned]),
            "Confirmar o valor com a Vitrus; o valor numérico é o mesmo sem os caracteres.",
        ))  # fmt: skip
    approx = [r for r in containers if r["coord_precision"] == "approximate"]
    if approx:
        alerts.append((
            "municipal_coords_low_precision",
            f"{len(approx)} contentores com coordenadas de 3 casas decimais ou menos (erro até ~100 m; coordenadas aparentemente arredondadas à mão): "
            + str(dict(files(approx))),
            "Usar para contagens por freguesia, não para distâncias curtas. Pedir recolha de coordenadas com GPS.",
        ))  # fmt: skip
    outside = [r for r in rejected if r["reason_key"] == "outside_municipality"]
    if outside:
        alerts.append((
            "municipal_outside_municipality",
            f"{len(outside)} contentores a mais de {BOUNDARY_TOLERANCE_M:.0f} m do contorno de Guimarães (CAOP 2019), rejeitados: "
            + examples([f"{r['source_file']}:{r['external_id']}" for r in outside]),
            "Confirmar as coordenadas com a Vitrus.",
        ))  # fmt: skip
    edge = [r for r in containers if r["boundary_note"]]
    if edge:
        alerts.append((
            "municipal_boundary_tolerance",
            f"{len(edge)} contentores até {BOUNDARY_TOLERANCE_M:.0f} m fora do contorno CAOP 2019 (aceites e atribuídos à freguesia mais próxima): "
            + examples([r["container_uid"] for r in edge]),
            "Efeito da generalização do contorno; sem ação.",
        ))  # fmt: skip
    empty = [r for r in rejected if r["reason_key"] == "empty_row"]
    if empty:
        alerts.append((
            "municipal_empty_row",
            f"{len(empty)} linha(s) totalmente vazia(s): " + examples([f"{r['source_file']} linha {r['source_line']}" for r in empty]),
            "Ignorada; sem ação.",
        ))  # fmt: skip
    blank = [r for r in containers if not r["street"] and not r["producer_name"] and not r["declared_parish"]]
    if blank:
        alerts.append((
            "municipal_blank_rows",
            f"{len(blank)} contentores só com ID e capacidade (sem rua/nome, sem freguesia, sem coordenadas): "
            + examples([r["container_uid"] for r in blank]),
            "Ficam pendentes. Confirmar com a Vitrus se existem.",
        ))  # fmt: skip
    unknown_cap = [r for r in containers if r["capacity_status"] == "unknown"]
    if unknown_cap:
        alerts.append((
            "municipal_capacity_unknown",
            f"{len(unknown_cap)} contentores com capacidade desconhecida (\"???\", \"?\" ou vazia): "
            + examples([r["container_uid"] for r in unknown_cap]),
            "Capacidade fica nula (não se inventa); fora das somas de litros. Pedir os valores.",
        ))  # fmt: skip
    assumed = [r for r in containers if r["capacity_status"] == "assumed_litres"]
    if assumed:
        alerts.append((
            "municipal_capacity_unit_assumed",
            f"{len(assumed)} capacidades sem unidade (ficheiro Orgânico - Tipologia: 10, 30, 45, 80, 1100) lidas como litros; coerente com contentores de 1100 L e baldes de 30 a 80 L.",
            "Confirmar a unidade com a Vitrus.",
        ))  # fmt: skip
    tiny = [r for r in containers if r["capacity_litres"] != "" and 0 < r["capacity_litres"] <= 10]
    if tiny:
        alerts.append((
            "municipal_capacity_outlier",
            f"{len(tiny)} contentores de orgânico de produtores com 10 L (valor muito abaixo dos restantes): " + examples([r["container_uid"] for r in tiny]),
            "Confirmar se é 10 L ou erro de digitação (ex.: 110 L).",
        ))  # fmt: skip
    verdes = [r for r in containers if r["kind"] == "green_waste" and r["quantity"]]
    if verdes:
        total = sum(int(r["quantity"]) for r in verdes if r["quantity"].isdigit())
        alerts.append((
            "municipal_quantity_semantics",
            f"Resíduos Verdes: {len(verdes)} linhas (um ID cada) com Quantidade 1 a 7, soma {total}. Não é claro se a Quantidade é o número de contentores nesse local (cada linha vale mais do que 1 unidade) ou outra medida.",
            "Perguntar à Vitrus. Até lá `units_declared` usa a Quantidade e `containers` conta linhas.",
        ))  # fmt: skip
    variants = {declared for c in data["declared_variants"].values() for declared in c}
    unmapped = Counter(r["declared_parish"] for r in containers if r["parish_match"] == "nao_mapeada")
    if variants:
        alerts.append((
            "municipal_parish_names_inconsistent",
            f"{len(variants)} escritas diferentes de freguesia nos 5 ficheiros para 48 freguesias (maiúsculas, abreviaturas, uniões \"UF\", nomes anteriores a 2013, erros). A freguesia declarada nunca é usada para contar: conta o polígono CAOP.",
            "Pedir à Vitrus a freguesia por código (Dicofre) em vez de texto.",
        ))  # fmt: skip
    if unmapped:
        alerts.append((
            "municipal_parish_unmapped",
            f"{sum(unmapped.values())} contentores com freguesia declarada que não é nome de freguesia (ex.: {', '.join(f'{k or chr(34)*2} ({v})' for k, v in unmapped.most_common(6))}); a freguesia vem do polígono.",
            "Sem ação; confirmar se \"Cidade\" é o centro histórico.",
        ))  # fmt: skip
    suspect = [r for r in containers if r["coord_suspect"] == "true"]
    if suspect:
        by_file = dict(files(suspect))
        alerts.append((
            "municipal_coord_suspect",
            f"{len(suspect)} contentores a mais de {SUSPECT_DISTANCE_M / 1000:.0f} km da freguesia que a Vitrus declara (ver `parish_mismatch_distance_m`): {by_file}. Coordenada trocada de sítio ou freguesia errada.",
            "Confirmar com a Vitrus; entram nas contagens pela freguesia do polígono mas ficam marcados em `coord_suspect`.",
        ))  # fmt: skip
    diff = [r for r in containers if r["parish_match"] == "diferente"]
    if diff:
        far = [r for r in diff if r["parish_mismatch_distance_m"] != "" and r["parish_mismatch_distance_m"] > 100]
        alerts.append((
            "municipal_parish_mismatch",
            f"{len(diff)} contentores cuja freguesia declarada difere da do polígono (das {sum(1 for r in containers if r['parish_match'] in ('igual', 'diferente'))} comparáveis); {len(far)} a mais de 100 m da freguesia declarada: "
            + examples([f"{r['container_uid']} ({r['declared_parish']} -> {r['parish_name']})" for r in far]),
            "Prevalece o polígono. As diferenças a menos de 100 m são limites de freguesia; as outras podem ser erro de coordenada ou de nome.",
        ))  # fmt: skip
    near = analysis["near_duplicates"]
    if near.get("cross_file_pairs"):
        alerts.append((
            "municipal_cross_file_overlap",
            f"{near['cross_file_pairs']} pares de locais de ficheiros diferentes a menos de {NEAR_DUPLICATE_M:.0f} m (mesma rua noutro ficheiro): {near['cross_file_by_files']}. Não se fundem: são contentores de frações diferentes.",
            "Sem ação; o orgânico coletivo acompanha os contentores de rua (ver municipal_links.csv).",
        ))  # fmt: skip
    stacked = [s for s in data["sites"] if s["containers"] >= 10]
    if stacked:
        alerts.append((
            "municipal_stacked_units",
            f"{len(stacked)} locais com 10 ou mais contentores na mesma coordenada (máx. {max(s['containers'] for s in stacked)}): {sum(1 for s in stacked if s['site_class'] == 'producer')} de produtores (escolas, hospital, grandes produtores) e {sum(1 for s in stacked if s['site_class'] != 'producer')} de contentores públicos com coordenadas aproximadas (várias ruas no mesmo ponto).",
            "Normal para produtores; nos públicos o ponto é aproximado: confirmar no terreno.",
        ))  # fmt: skip
    unknown_stream = [r for r in containers if r["stream"] == "desconhecido"]
    alerts.append((
        "municipal_stream_unknown",
        f"{len(unknown_stream)} contentores (profundidade e superfície) sem fração indicada: os ficheiros não dizem se são indiferenciados, recicláveis ou outra coisa. `stream` = desconhecido.",
        "Perguntar à Vitrus a fração de cada ficheiro e quais são ecopontos de recicláveis.",
    ))  # fmt: skip
    prov = [p for p in parishes if p.code and p.code != p.dicofre_caop]
    if prov:
        alerts.append((
            "municipal_caop_version",
            f"CAOP 2019 usa Dicofre oficiais para {len(prov)} uniões de freguesias ({', '.join(p.dicofre_caop for p in prov)}) onde `parishes.csv` tem os provisórios {', '.join(p.code for p in prov)}. A CAOP mais recente é a CAOP2025 (DGT, aprovada em jan 2026); este pacote traz a de 2019.",
            "Confirmar com o INE/DGT o código oficial e a versão a usar; o ETL liga por nome e guarda os dois códigos.",
        ))  # fmt: skip
    if osm and (osm["missing_in_osm"] or osm["broken_in_osm"]):
        alerts.append((
            "municipal_osm_contours_incomplete",
            f"Os contornos OSM da app (parishes.csv) não têm geometria para {len(osm['missing_in_osm'])} freguesias ({'; '.join(osm['missing_in_osm'])}) e têm uma geometria minúscula em {len(osm['broken_in_osm'])} ({'; '.join(osm['broken_in_osm'])}). A CAOP 2019 tem as 48.",
            "Usar caop_guimaraes.geojson para o mapa e para áreas.",
        ))  # fmt: skip
    if osm:
        alerts.append((
            "municipal_caop_vs_osm",
            f"Nas {osm['parishes_compared']} freguesias com contorno OSM utilizável a área CAOP 2019 soma {osm['area_caop_km2']} km2 e o OSM {osm['area_osm_km2']} km2 ({osm['diff_pct']:+.1f}%); sobreposição mediana {osm['iou_pct_median']}%.",
            "O mapa e a densidade por km2 usam a CAOP (oficial); os contornos OSM ficam para o desenho.",
        ))  # fmt: skip
    return [{"id": str(i), "type_key": k, "detail": d, "suggestion": s} for i, (k, d, s) in enumerate(alerts, start=1)]


# --------------------------------------------------------------------------------------------------------------
# Escrita
# --------------------------------------------------------------------------------------------------------------


def write_csv(path: Path, columns: list[str], rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=columns, lineterminator="\n", extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


GPKG_SRS_4326 = (
    'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],'
    'AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,'
    'AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]]'
)


def write_gpkg(path: Path, layers: list[dict[str, Any]]) -> None:
    """GeoPackage mínimo (OGC 12-128r18) sem dependências de GDAL: tabelas de feições em WGS84 que o QGIS abre."""
    path.unlink(missing_ok=True)
    db = sqlite3.connect(path)
    db.executescript(
        f"""
        PRAGMA application_id = 1196444487;
        PRAGMA user_version = 10300;
        CREATE TABLE gpkg_spatial_ref_sys (srs_name TEXT NOT NULL, srs_id INTEGER PRIMARY KEY, organization TEXT NOT NULL,
            organization_coordsys_id INTEGER NOT NULL, definition TEXT NOT NULL, description TEXT);
        CREATE TABLE gpkg_contents (table_name TEXT NOT NULL PRIMARY KEY, data_type TEXT NOT NULL, identifier TEXT UNIQUE,
            description TEXT DEFAULT '', last_change DATETIME NOT NULL, min_x DOUBLE, min_y DOUBLE, max_x DOUBLE, max_y DOUBLE,
            srs_id INTEGER, CONSTRAINT fk_gc_r_srs_id FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id));
        CREATE TABLE gpkg_geometry_columns (table_name TEXT NOT NULL, column_name TEXT NOT NULL, geometry_type_name TEXT NOT NULL,
            srs_id INTEGER NOT NULL, z TINYINT NOT NULL, m TINYINT NOT NULL, CONSTRAINT pk_geom_cols PRIMARY KEY (table_name, column_name),
            CONSTRAINT fk_gc_tn FOREIGN KEY (table_name) REFERENCES gpkg_contents(table_name),
            CONSTRAINT fk_gc_srs FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id));
        INSERT INTO gpkg_spatial_ref_sys VALUES ('Undefined cartesian SRS', -1, 'NONE', -1, 'undefined', 'undefined cartesian coordinate reference system');
        INSERT INTO gpkg_spatial_ref_sys VALUES ('Undefined geographic SRS', 0, 'NONE', 0, 'undefined', 'undefined geographic coordinate reference system');
        INSERT INTO gpkg_spatial_ref_sys VALUES ('WGS 84 geodetic', 4326, 'EPSG', 4326, '{GPKG_SRS_4326}', 'longitude/latitude coordinates in decimal degrees on the WGS 84 spheroid');
        """
    )
    for layer in layers:
        cols = layer["columns"]  # [(nome, tipo SQL)]
        db.execute(
            f'CREATE TABLE "{layer["name"]}" (fid INTEGER PRIMARY KEY AUTOINCREMENT, geom BLOB, '
            + ", ".join(f'"{n}" {t}' for n, t in cols)
            + ")"
        )
        xs: list[float] = []
        ys: list[float] = []
        for geom, values in layer["rows"]:
            minx, miny, maxx, maxy = geom.bounds
            xs += [minx, maxx]
            ys += [miny, maxy]
            blob = b"GP" + bytes([0, 1]) + struct.pack("<i", 4326) + shapely.to_wkb(geom, byte_order=1)
            db.execute(
                f'INSERT INTO "{layer["name"]}" (geom, '
                + ", ".join(f'"{n}"' for n, _ in cols)
                + ") VALUES (?, "
                + ", ".join("?" for _ in cols)
                + ")",
                [blob, *values],
            )
        db.execute(
            "INSERT INTO gpkg_contents VALUES (?, 'features', ?, ?, ?, ?, ?, ?, ?, 4326)",
            (layer["name"], layer["name"], layer["description"], f"{RECEIVED_ON}T00:00:00.000Z",
             min(xs), min(ys), max(xs), max(ys)),
        )  # fmt: skip
        db.execute(
            "INSERT INTO gpkg_geometry_columns VALUES (?, 'geom', ?, 4326, 0, 0)",
            (layer["name"], layer["geometry_type"]),
        )
    db.commit()
    db.execute("VACUUM")
    db.close()


def num(value: Any) -> float | int | None:
    if value in ("", None):
        return None
    return float(value) if "." in str(value) else int(value)


def gpkg_layers(data: dict[str, Any], parishes: list[Parish]) -> list[dict[str, Any]]:
    cont_cols = [("container_uid", "TEXT"), ("source_file", "TEXT"), ("external_id", "TEXT"), ("kind", "TEXT"),
                 ("stream", "TEXT"), ("brand", "TEXT"), ("capacity_litres", "INTEGER"), ("producer_type", "TEXT"),
                 ("producer_name", "TEXT"), ("street", "TEXT"), ("declared_parish", "TEXT"), ("parish_name", "TEXT"),
                 ("parish_match", "TEXT"), ("site_id", "TEXT"), ("units_at_site", "INTEGER")]  # fmt: skip
    cont_rows = []
    for r in data["containers"]:
        if r["coord_status"] != "ok":
            continue
        c: Coords = r["_coords"]
        vals = [num(r[n]) if t == "INTEGER" else r[n] for n, t in cont_cols]
        cont_rows.append((Point(float(c.lon), float(c.lat)), vals))  # type: ignore[arg-type]
    site_cols = [("site_id", "TEXT"), ("parish_name", "TEXT"), ("site_class", "TEXT"), ("containers", "INTEGER"),
                 ("units_declared", "INTEGER"), ("capacity_litres_total", "INTEGER"), ("kinds", "TEXT"),
                 ("producer_types", "TEXT"), ("streets", "TEXT"), ("nn_distance_m", "REAL"),
                 ("textile_candidate", "TEXT"), ("candidate_reason", "TEXT")]  # fmt: skip
    site_rows = [
        (Point(float(s["longitude"]), float(s["latitude"])), [num(s[n]) if t in ("INTEGER", "REAL") else s[n] for n, t in site_cols])
        for s in data["sites"]
    ]  # fmt: skip
    parish_rows = []
    for p in parishes:
        geom = to_wgs84(shapely.simplify(p.geom, SIMPLIFY_TOLERANCE_M, preserve_topology=True))
        parish_rows.append((geom, [p.code or p.dicofre_caop, p.dicofre_caop, p.name, p.taa, p.area_ha, p.population]))
    return [
        {"name": "contentores", "geometry_type": "POINT", "columns": cont_cols, "rows": cont_rows,
         "description": "Contentores municipais (NÃO são de têxteis) com coordenadas válidas dentro de Guimarães"},
        {"name": "locais", "geometry_type": "POINT", "columns": site_cols, "rows": site_rows,
         "description": "Locais = contentores com as mesmas coordenadas a 5 casas decimais"},
        {"name": "freguesias_caop2019", "geometry_type": "GEOMETRY",
         "columns": [("dicofre", "TEXT"), ("dicofre_caop", "TEXT"), ("name", "TEXT"), ("taa", "TEXT"),
                     ("area_ha", "REAL"), ("population", "INTEGER")], "rows": parish_rows,
         "description": "48 freguesias de Guimarães (CAOP 2019), simplificadas a 5 m"},
    ]  # fmt: skip


def digest(paths: list[Path], base: Path) -> str:
    h = hashlib.sha256()
    for p in sorted(paths):
        h.update(str(p.relative_to(base)).encode() + b"\0" + p.read_bytes())
    return h.hexdigest()


def update_manifest(out: Path, entry: dict[str, Any] | None) -> None:
    path = out / "sources.json"
    manifest: list[dict[str, Any]] = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    manifest = [m for m in manifest if m.get("key") != SOURCE_KEY]
    if entry:
        manifest.append(entry)
    if manifest or path.exists():
        path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


OUTPUT_FILES = (
    "municipal_containers.csv", "municipal_sites.csv", "municipal_containers_rejected.csv", "municipal_alerts.csv",
    "municipal_by_parish.csv", "municipal_links.csv", "municipal_summary.json", "caop_guimaraes.geojson",
    "qgis/guimaraes_contentores_municipais.gpkg",
)  # fmt: skip


def run(
    raw_dir: Path = RAW_PACKAGE, out_dir: Path = OUT, parishes_csv: Path | None = None, osm_path: Path = OSM_PARISHES
) -> dict[str, Any]:
    """Processa o pacote. Sem pacote em data/raw/: não escreve nada e remove saídas antigas deste ETL."""
    parishes_csv = parishes_csv or out_dir / "parishes.csv"
    if not (raw_dir / FILES[0].file).exists():
        for name in OUTPUT_FILES:
            (out_dir / name).unlink(missing_ok=True)
        update_manifest(out_dir, None)
        return {"status": "awaiting_data"}

    data = process(raw_dir, parishes_csv)
    analysis = analyse(data)
    extra = descriptive(data, analysis["by_parish"])
    osm = compare_with_osm(data["parishes"], osm_path)
    alerts = build_alerts(data, analysis, extra, osm)
    parishes: list[Parish] = data["parishes"]
    containers: list[dict[str, Any]] = data["containers"]
    sites: list[dict[str, Any]] = data["sites"]
    order = {s.key: i for i, s in enumerate(FILES)}
    containers.sort(key=lambda r: (order[r["source_file"]], r["source_line"]))
    rejected = sorted(data["rejected"], key=lambda r: (order[r["source_file"]], r["source_line"]))

    (out_dir / "qgis").mkdir(parents=True, exist_ok=True)
    write_csv(out_dir / "municipal_containers.csv", CONTAINER_COLUMNS, containers)
    write_csv(out_dir / "municipal_sites.csv", SITE_COLUMNS, sites)
    write_csv(out_dir / "municipal_containers_rejected.csv", REJECTED_COLUMNS, rejected)
    write_csv(out_dir / "municipal_alerts.csv", ["id", "type_key", "detail", "suggestion"], alerts)
    by_parish = analysis["by_parish"]
    write_csv(out_dir / "municipal_by_parish.csv", list(by_parish[0]), by_parish)
    write_csv(out_dir / "municipal_links.csv", LINK_COLUMNS, analysis["links"])
    (out_dir / "caop_guimaraes.geojson").write_text(
        json.dumps(caop_geojson(parishes), ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
    )
    write_gpkg(out_dir / "qgis" / "guimaraes_contentores_municipais.gpkg", gpkg_layers(data, parishes))

    inputs = [raw_dir / s.file for s in FILES] + [
        raw_dir / f"{CAOP_STEM}{ext}" for ext in (".shp", ".shx", ".dbf", ".prj", ".cpg")
    ]
    inputs.append(raw_dir / "Georreferenciação.qgz")
    summary = build_summary(data, analysis, extra, osm, alerts, inputs, raw_dir)
    (out_dir / "municipal_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    update_manifest(
        out_dir,
        {
            "key": SOURCE_KEY,
            "title": "Contentores municipais (pacote QGIS) e CAOP 2019",
            "provider": "Vitrus Ambiente",
            "file_name": "data/raw/vitrus-mapa-qgis/",
            "file_sha256": digest([p for p in inputs if p.exists()], raw_dir),
            "received_on": RECEIVED_ON,
            "period_start": None,
            "period_end": None,
            "notes": "Contentores municipais de outras frações (NÃO são de têxteis). Ver municipal_alerts.csv e docs/dados/analise-contentores-municipais.md.",
        },
    )
    return {
        "status": "ok",
        "containers": len(containers),
        "located": summary["containers"]["located"],
        "sites": len(sites),
        "rejected": len(rejected),
        "alerts": len(alerts),
    }


def build_summary(
    data: dict[str, Any],
    analysis: dict[str, Any],
    extra: dict[str, Any],
    osm: dict[str, Any],
    alerts: list[dict[str, str]],
    inputs: list[Path],
    raw_dir: Path,
) -> dict[str, Any]:
    containers: list[dict[str, Any]] = data["containers"]
    sites: list[dict[str, Any]] = data["sites"]
    rejected: list[dict[str, Any]] = data["rejected"]
    parishes: list[Parish] = data["parishes"]
    located = [r for r in containers if r["coord_status"] == "ok"]
    compared = [r for r in containers if r["parish_match"] in ("igual", "diferente")]
    n_unmapped = sum(1 for r in containers if r["parish_match"] == "nao_mapeada")
    levels = Counter(r["parish_match_level"] for r in containers)
    return {
        "note": "Contentores MUNICIPAIS de outras frações. Nenhum é de têxteis; não misturar com containers.csv.",
        "received_on": RECEIVED_ON,
        "inputs": [
            {"file": str(p.relative_to(raw_dir)), "bytes": p.stat().st_size, "sha256": sha256_of(p)}
            for p in inputs
            if p.exists()
        ],
        "files": data["raw_stats"],
        "caop": {
            **data["caop_meta"],
            "version": "CAOP 2019 (Cont_AAD_CAOP2019, PT-TM06/ETRS89, EPSG:3763)",
            "taa_values": dict(Counter(p.taa for p in parishes)),
            "area_ha_total": round(sum(p.area_ha for p in parishes), 2),
            "area_ha_attr_total": round(sum(p.area_ha_attr for p in parishes), 2),
            "codes_differing_from_app": {p.dicofre_caop: p.code for p in parishes if p.code != p.dicofre_caop},
            "population_matched": sum(1 for p in parishes if p.population is not None),
            "vs_osm": {k: v for k, v in osm.items() if k != "rows"},
        },
        "containers": {
            "rows_read": sum(s["data_lines"] for s in data["raw_stats"].values()),
            "accepted": len(containers),
            "located": len(located),
            "pending_no_coordinates": sum(1 for r in containers if r["coord_status"] == "pending"),
            "rejected": len(rejected),
            "rejected_by_reason": dict(Counter(r["reason_key"] for r in rejected)),
            "by_file": dict(Counter(r["source_file"] for r in containers)),
            "by_kind": dict(Counter(r["kind"] for r in containers)),
            "by_stream": dict(Counter(r["stream"] for r in containers)),
            "by_brand": dict(
                Counter(r["brand"] or "(sem marca)" for r in containers if r["kind"] in ("underground", "platform"))
            ),
            "capacity_status": dict(Counter(r["capacity_status"] for r in containers)),
            "coord_swapped_by_header": {k: v["coords_swapped_vs_header"] for k, v in data["raw_stats"].items()},
            "coord_cleaned": sum(1 for r in containers if r["coord_cleaned"] == "true"),
            "coord_approximate": sum(1 for r in containers if r["coord_precision"] == "approximate"),
            "units_declared_green_waste": sum(int(r["quantity"]) for r in containers if r["quantity"].isdigit()),
            "capacity_litres_total": sum(r["capacity_litres"] for r in containers if r["capacity_litres"] != ""),
        },
        "parish_check": {
            "declared_distinct_spellings": len({d for c in data["declared_variants"].values() for d in c}),
            "compared": len(compared),
            "equal": sum(1 for r in compared if r["parish_match"] == "igual"),
            "different": sum(1 for r in compared if r["parish_match"] == "diferente"),
            "different_over_100m": sum(
                1 for r in compared if r["parish_match"] == "diferente" and r["parish_mismatch_distance_m"] > 100
            ),
            "unmapped_declared": n_unmapped,
            "match_levels": dict(levels),
            "parishes_with_containers": sum(1 for r in analysis["by_parish"] if r["containers"]),
        },
        "sites": {
            "total": len(sites),
            "by_class": dict(Counter(s["site_class"] for s in sites)),
            "single_container": sum(1 for s in sites if s["containers"] == 1),
            "max_containers": max((s["containers"] for s in sites), default=0),
            "textile_candidates": sum(1 for s in sites if s["textile_candidate"] == "true"),
        },
        "analysis": {
            "coverage_pct_of_municipality_area": analysis["coverage_pct_of_municipality"],
            "public_site_nn_distance_m": analysis["nn_distance_m"],
            "links_organic_collective": analysis["link_summary"],
            "bc_series": analysis["bc_series"],
            "near_duplicates": analysis["near_duplicates"],
            **extra,
        },
        "rules": {
            "lat_range": LAT_RANGE,
            "lon_range": LON_RANGE,
            "boundary_tolerance_m": BOUNDARY_TOLERANCE_M,
            "site_decimals": 5,
            "low_precision_decimals": LOW_PRECISION_DECIMALS,
            "near_duplicate_m": NEAR_DUPLICATE_M,
            "link_radius_m": LINK_RADIUS_M,
            "coverage_radii_m": list(COVERAGE_RADII_M),
            "simplify_tolerance_m": SIMPLIFY_TOLERANCE_M,
            "projected_crs": "EPSG:3763",
            "potential_kg_per_inhab_month": POTENTIAL_KG_PER_INHAB_MONTH,
            "capture_today_pct": round(100 * CAPTURE_TODAY, 1),
        },
        "alerts": len(alerts),
        "outputs": list(OUTPUT_FILES),
    }


def main() -> None:
    print(json.dumps(run(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
