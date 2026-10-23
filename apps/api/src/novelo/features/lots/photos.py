"""Processamento da miniatura de uma peça (puro, sem base de dados nem FastAPI).

RGPD: o que se guarda é só o necessário para reconhecer a peça. A orientação EXIF aplica-se ANTES de se perderem os
metadados; depois constrói-se uma imagem nova só com os pixels (sem EXIF, GPS, perfil ICC nem miniaturas embebidas),
reduz-se para um JPEG progressivo com o lado maior <= 640 px e cabe em `max_bytes`.
"""

import io
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

from novelo.features.lots.triage import MAX_BYTES, InvalidImageError, sniff_mime

MAX_INPUT_BYTES = MAX_BYTES  # 5 MB
MAX_SIDE = 640
MAX_INPUT_PIXELS = 40_000_000  # recusa «bombas» de descompressão antes de descodificar
QUALITY_STEPS = (80, 72, 64, 56, 48, 40)


@dataclass(frozen=True)
class ProcessedPhoto:
    content: bytes
    width: int
    height: int
    mime: str = "image/jpeg"

    @property
    def size_bytes(self) -> int:
        return len(self.content)


def process(data: bytes, max_bytes: int) -> ProcessedPhoto:
    """JPEG progressivo sem metadados, lado maior <= 640 px e <= `max_bytes`; 400 claro se não for possível."""
    if not data:
        raise InvalidImageError("Empty image")
    if len(data) > MAX_INPUT_BYTES:
        raise InvalidImageError("The photo must be at most 5 MB")
    sniff_mime(data)  # o formato real pelos primeiros bytes; SVG, PDF e afins ficam de fora
    try:
        with Image.open(io.BytesIO(data)) as opened:
            if opened.width * opened.height > MAX_INPUT_PIXELS:
                raise InvalidImageError("The image dimensions are too large")
            oriented = ImageOps.exif_transpose(opened)  # antes de descartar o EXIF
            rgba = oriented.convert("RGBA")  # transparência assenta sobre fundo branco
            flat = Image.new("RGB", rgba.size, "white")
            flat.paste(rgba, mask=rgba.getchannel("A"))
    except InvalidImageError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise InvalidImageError("The image could not be read") from exc
    flat.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
    clean = Image.frombytes("RGB", flat.size, flat.tobytes())  # só pixels: nada de `info` herdado
    for quality in QUALITY_STEPS:
        out = io.BytesIO()
        clean.save(out, format="JPEG", quality=quality, optimize=True, progressive=True)
        if out.tell() <= max_bytes:
            return ProcessedPhoto(content=out.getvalue(), width=clean.width, height=clean.height)
    raise InvalidImageError(f"The photo is too complex to fit in {max_bytes // 1024} KB; try a simpler picture")
