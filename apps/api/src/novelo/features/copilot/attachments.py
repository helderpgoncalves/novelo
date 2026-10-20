"""Anexos do copiloto: valida pelo conteúdo (nunca pelo nome nem pelo Content-Type), extrai texto e descarta o ficheiro.

Só se guarda o que o modelo pode ler (texto extraído, tabela amostrada, metadados). As imagens, reduzidas e sem EXIF,
vivem apenas em memória, por pouco tempo, para a mensagem seguinte.
"""

import csv
import io
import json
import re
import time
import zipfile
from dataclasses import dataclass, field
from pathlib import PurePosixPath
from typing import Any, Literal

from PIL import Image, ImageOps, UnidentifiedImageError
from pypdf import PdfReader
from pypdf.errors import PyPdfError

from novelo.core.errors import AppError
from novelo.features.copilot.tables import column_stats, parse_number

MAX_FILES = 5
MAX_BYTES = 10 * 1024 * 1024
IMAGE_MAX_SIDE = 1568
IMAGE_MAX_PIXELS = 50_000_000
PDF_MAX_PAGES = 30
PDF_MAX_SECONDS = 10.0
TEXT_STORE_CHARS = 200_000
PREVIEW_CHARS = 3000
TABLE_MAX_ROWS = 20_000
TABLE_MAX_COLS = 40
TABLE_MAX_CELLS = 300_000
ZIP_MAX_UNCOMPRESSED = 100 * 1024 * 1024

Kind = Literal["image", "pdf", "table", "text"]

_BLOCKED_EXT = {
    ".exe", ".dll", ".sh", ".bat", ".cmd", ".com", ".msi", ".scr", ".ps1", ".vbs", ".js", ".jar", ".apk",
    ".app", ".bin", ".so", ".dylib", ".php", ".py", ".html", ".htm", ".svg", ".xml", ".zip", ".rar", ".7z",
}  # fmt: skip
_BLOCKED_MAGIC = (b"MZ", b"\x7fELF", b"\xfe\xed\xfa\xce", b"\xfe\xed\xfa\xcf", b"\xcf\xfa\xed\xfe", b"\xce\xfa\xed\xfe",
                  b"\xca\xfe\xba\xbe", b"#!", b"Rar!", b"7z\xbc\xaf")  # fmt: skip
_MAGIC: tuple[tuple[bytes, tuple[Kind, str]], ...] = (
    (b"\xff\xd8\xff", ("image", "image/jpeg")),
    (b"\x89PNG\r\n\x1a\n", ("image", "image/png")),
    (b"GIF87a", ("image", "image/gif")),
    (b"GIF89a", ("image", "image/gif")),
    (b"%PDF-", ("pdf", "application/pdf")),
)
_TEXT_EXT = {".txt": "text/plain", ".md": "text/markdown", ".json": "application/json", ".csv": "text/csv"}


class AttachmentError(AppError):
    status_code = 400
    code = "bad_request"


@dataclass
class Extracted:
    kind: Kind
    mime: str
    preview: str
    meta: dict[str, Any] = field(default_factory=dict)
    data: dict[str, Any] | None = None
    image_jpeg: bytes | None = None


def safe_filename(name: str | None) -> str:
    """Só o nome-base, sem caminhos nem caracteres de controlo. Nunca é usado para aceder ao disco."""
    base = PurePosixPath((name or "file").replace("\\", "/")).name
    cleaned = re.sub(r"[\x00-\x1f\x7f<>:\"|?*]", "", base).strip(". ")
    return (cleaned or "file")[:100]


def _ext(name: str) -> str:
    return PurePosixPath(name.lower()).suffix


def sniff(data: bytes, filename: str) -> tuple[Kind, str]:
    """Tipo pelos primeiros bytes. O nome só desempata entre formatos de texto."""
    if not data:
        raise AttachmentError("Empty file")
    ext = _ext(filename)
    if ext in _BLOCKED_EXT or any(data.startswith(m) for m in _BLOCKED_MAGIC):
        raise AttachmentError("This file type is not allowed")
    for magic, found in _MAGIC:
        if data.startswith(magic):
            return found
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image", "image/webp"
    if data.startswith(b"PK\x03\x04"):
        if _is_xlsx(data):
            return "table", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        raise AttachmentError("Only .xlsx spreadsheets are supported among Office files")
    if ext not in _TEXT_EXT:
        raise AttachmentError("Unsupported file type. Use images, PDF, CSV, XLSX, TXT, MD or JSON")
    head = data[:2048].lstrip().lower()
    if head.startswith((b"<!doctype", b"<html", b"<svg", b"<script", b"<?xml", b"<?php")):
        raise AttachmentError("Markup files are not allowed")
    return ("table", "text/csv") if ext == ".csv" else ("text", _TEXT_EXT[ext])


def _is_xlsx(data: bytes) -> bool:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            infos = z.infolist()
            if "xl/workbook.xml" not in z.namelist() or len(infos) > 2000:
                return False
            total = sum(i.file_size for i in infos)
            return total <= ZIP_MAX_UNCOMPRESSED and all(
                i.file_size <= 200 * max(1, i.compress_size) + 10_000 for i in infos
            )
    except zipfile.BadZipFile:
        return False


def decode_text(data: bytes) -> str:
    if b"\x00" in data[:4096]:
        raise AttachmentError("This file is binary, not text")
    for enc in ("utf-8-sig", "cp1252"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    raise AttachmentError("The text encoding is not supported")


def extract(data: bytes, filename: str) -> Extracted:
    """Síncrono e potencialmente lento: chamar numa thread, com limite de tempo."""
    kind, mime = sniff(data, filename)
    if kind == "image":
        return _extract_image(data, mime)
    if kind == "pdf":
        return _extract_pdf(data)
    if kind == "table":
        return _extract_xlsx(data) if mime != "text/csv" else _extract_csv(decode_text(data))
    return _extract_text(decode_text(data), mime)


# --- imagens ---------------------------------------------------------------------------------------


def _extract_image(data: bytes, mime: str) -> Extracted:
    try:
        with Image.open(io.BytesIO(data)) as opened:
            ow, oh = opened.size
            if ow * oh > IMAGE_MAX_PIXELS:
                raise AttachmentError("The image is too large")
            opened.seek(0)  # GIF animado: primeiro fotograma
            oriented = ImageOps.exif_transpose(opened)
            rgba = oriented.convert("RGBA")
            rgb = Image.new("RGB", rgba.size, "white")
            rgb.paste(rgba, mask=rgba.getchannel("A"))
            rgb.thumbnail((IMAGE_MAX_SIDE, IMAGE_MAX_SIDE), Image.Resampling.LANCZOS)
            out = io.BytesIO()
            rgb.save(out, format="JPEG", quality=82, optimize=True)  # sem exif=: metadados descartados
            w, h = rgb.size
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise AttachmentError("The image could not be read") from exc
    return Extracted(
        "image", mime, f"Image {w}x{h} px (resized from {ow}x{oh}, metadata removed)",
        {"width": w, "height": h, "original_width": ow, "original_height": oh}, None, out.getvalue(),
    )  # fmt: skip


# --- PDF -------------------------------------------------------------------------------------------


def _extract_pdf(data: bytes) -> Extracted:
    started = time.monotonic()
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise AttachmentError("Encrypted PDFs are not supported")
        total = len(reader.pages)
        chunks: list[str] = []
        read = 0
        for page in reader.pages[:PDF_MAX_PAGES]:
            if time.monotonic() - started > PDF_MAX_SECONDS:
                break
            chunks.append((page.extract_text() or "").strip())
            read += 1
    except (PyPdfError, ValueError, KeyError, RecursionError, OSError) as exc:
        raise AttachmentError("The PDF could not be read") from exc
    text = "\n\n".join(c for c in chunks if c)
    stored = text[:TEXT_STORE_CHARS]
    meta = {
        "pages": total,
        "pages_read": read,
        "chars": len(text),
        "truncated": read < total or len(text) > len(stored),
    }
    if not stored:
        return Extracted(
            "pdf", "application/pdf", "PDF without extractable text (probably scanned).", meta, {"text": ""}
        )
    return Extracted("pdf", "application/pdf", _text_preview(stored, meta), meta, {"text": stored})


def _text_preview(text: str, meta: dict[str, Any]) -> str:
    if len(text) <= PREVIEW_CHARS * 2:
        return text
    head, tail = text[:PREVIEW_CHARS], text[-PREVIEW_CHARS // 2 :]
    omitted = len(text) - len(head) - len(tail)
    return f"{head}\n[... {omitted} characters omitted; use analyze_attachment, operation=search ...]\n{tail}"


def _extract_text(text: str, mime: str) -> Extracted:
    meta: dict[str, Any] = {"chars": len(text), "lines": text.count("\n") + 1}
    if mime == "application/json":
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            raise AttachmentError("The JSON file is not valid") from exc
        meta["json_type"] = type(parsed).__name__
        if isinstance(parsed, dict):
            meta["keys"] = list(parsed)[:20]
        elif isinstance(parsed, list):
            meta["items"] = len(parsed)
    stored = text[:TEXT_STORE_CHARS]
    meta["truncated"] = len(text) > len(stored)
    return Extracted("text", mime, _text_preview(stored, meta), meta, {"text": stored})


# --- tabelas ---------------------------------------------------------------------------------------


def _unique_headers(raw: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    out = []
    for i, h in enumerate(raw[:TABLE_MAX_COLS]):
        name = (h or "").strip()[:60] or f"col_{i + 1}"
        seen[name] = seen.get(name, 0) + 1
        out.append(name if seen[name] == 1 else f"{name}_{seen[name]}")
    return out


def _build_table(header: list[str], raw_rows: list[list[Any]], extra: dict[str, Any]) -> Extracted:
    columns = _unique_headers(header)
    width = len(columns)
    max_rows = min(TABLE_MAX_ROWS, TABLE_MAX_CELLS // max(1, width))
    clipped = len(raw_rows) > max_rows
    rows = [(list(r) + [None] * width)[:width] for r in raw_rows[:max_rows]]
    types: list[str] = []
    for i in range(width):
        cells = [r[i] for r in rows if r[i] not in (None, "")]
        numeric = sum(1 for c in cells if parse_number(c) is not None)
        types.append("number" if cells and numeric / len(cells) >= 0.9 else "text")
    for r in rows:
        for i, kind in enumerate(types):
            if r[i] in (None, ""):
                r[i] = None
            elif kind == "number":
                r[i] = parse_number(r[i])
            else:
                r[i] = str(r[i])[:200]
    stats = column_stats(columns, types, rows)
    sample = [dict(zip(columns, r[:8], strict=False)) for r in rows[:3]]
    meta = {"rows": len(rows), "columns": width, "truncated": clipped or len(header) > TABLE_MAX_COLS, **extra}
    meta["column_stats"] = stats
    preview = json.dumps(
        {"rows": len(rows), "columns": [f"{c['name']} ({c['type']})" for c in stats], "sample": sample},
        ensure_ascii=False,
        default=str,
    )
    return Extracted(
        "table", "text/csv", preview[:PREVIEW_CHARS], meta, {"columns": columns, "types": types, "rows": rows}
    )


def _extract_csv(text: str) -> Extracted:
    sample = text[:8192]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    try:
        rows = list(csv.reader(io.StringIO(text), dialect))
    except csv.Error as exc:
        raise AttachmentError("The CSV could not be parsed") from exc
    rows = [r for r in rows if any(c.strip() for c in r)]
    if len(rows) < 2:
        raise AttachmentError("The CSV needs a header and at least one row")
    return _build_table(rows[0], rows[1:], {"format": "csv"})


def _extract_xlsx(data: bytes) -> Extracted:
    from openpyxl import load_workbook  # noqa: PLC0415  (import lento, só quando há folhas de cálculo)

    try:
        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        sheets = wb.sheetnames[:10]
        ws = wb[sheets[0]]
        rows: list[list[Any]] = []
        for raw in ws.iter_rows(values_only=True):
            row = [
                "" if c is None else (c.isoformat() if hasattr(c, "isoformat") else c)
                for c in raw[: TABLE_MAX_COLS + 1]
            ]
            if any(str(c).strip() for c in row):
                rows.append(row)
            if len(rows) > TABLE_MAX_ROWS + 1:
                break
        wb.close()
    except (OSError, ValueError, KeyError, zipfile.BadZipFile, IndexError) as exc:
        raise AttachmentError("The spreadsheet could not be read") from exc
    if len(rows) < 2:
        raise AttachmentError("The first sheet needs a header and at least one row")
    return _build_table([str(c) for c in rows[0]], rows[1:], {"format": "xlsx", "sheets": sheets, "sheet": sheets[0]})


# --- imagens em memória ----------------------------------------------------------------------------


class ImageStore:
    """Imagens reduzidas, só em memória e por pouco tempo (a mensagem seguinte usa-as e acabou)."""

    def __init__(self, ttl_s: float = 1800.0, max_items: int = 200) -> None:
        self.ttl_s, self.max_items = ttl_s, max_items
        self._data: dict[str, tuple[float, str, bytes]] = {}

    def put(self, key: str, user_id: str, jpeg: bytes) -> None:
        self._evict()
        if len(self._data) >= self.max_items:
            self._data.pop(next(iter(self._data)))
        self._data[key] = (time.monotonic(), user_id, jpeg)

    def get(self, key: str, user_id: str) -> bytes | None:
        self._evict()
        hit = self._data.get(key)
        return hit[2] if hit and hit[1] == user_id else None

    def clear(self) -> None:
        self._data.clear()

    def _evict(self) -> None:
        now = time.monotonic()
        for k in [k for k, (t, _, _) in self._data.items() if now - t > self.ttl_s]:
            del self._data[k]


image_store = ImageStore()
