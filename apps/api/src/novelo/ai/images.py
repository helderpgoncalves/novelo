"""Fotos para os modelos de visão (triagem e pré-recolha): validar, reduzir e codificar.

A foto é validada pelos bytes reais, reduzida (menos tokens, menos latência, menos custo, sem
metadados) e codificada como data URL. Vive só em memória durante o pedido e nunca é guardada.
"""

import base64
import io
from typing import Literal

from PIL import Image, ImageOps, UnidentifiedImageError

from novelo.core.errors import AppError

MAX_SIDE = 1024
JPEG_QUALITY = 80
MAX_BYTES = 5 * 1024 * 1024  # por foto, antes de reduzir

_MAGIC = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"RIFF": "image/webp",  # confirmado abaixo com "WEBP"
}


class UnreadableImageError(ValueError):
    pass


class InvalidImageError(AppError):
    status_code = 400
    code = "bad_request"


def sniff_mime(data: bytes) -> Literal["image/jpeg", "image/png", "image/webp"]:
    """Confirma o formato pelos primeiros bytes: o Content-Type enviado pelo cliente não é de fiar."""
    for magic, mime in _MAGIC.items():
        if data.startswith(magic):
            if mime == "image/webp" and data[8:12] != b"WEBP":
                break
            return mime  # type: ignore[return-value]
    raise InvalidImageError("Only JPEG, PNG or WebP images are accepted")


def data_url(data: bytes) -> str:
    """Valida, reduz e codifica a foto como data URL JPEG para o modelo de visão."""
    if not data:
        raise InvalidImageError("Empty image")
    if len(data) > MAX_BYTES:
        raise InvalidImageError("Each photo must be at most 5 MB")
    sniff_mime(data)
    try:
        small = shrink_for_vision(data)
    except UnreadableImageError as exc:
        raise InvalidImageError("The image could not be read") from exc
    return f"data:image/jpeg;base64,{base64.b64encode(small).decode()}"


def shrink_for_vision(data: bytes) -> bytes:
    """JPEG com o lado maior <= 1024 px e qualidade ~80. Aplica a orientação EXIF e descarta todos os metadados."""
    try:
        with Image.open(io.BytesIO(data)) as opened:
            oriented = ImageOps.exif_transpose(opened)
            if oriented.mode == "RGB":
                rgb = oriented
            else:  # PNG/WebP com transparência ou paleta: assenta sobre fundo branco
                rgba = oriented.convert("RGBA")
                rgb = Image.new("RGB", rgba.size, "white")
                rgb.paste(rgba, mask=rgba.getchannel("A"))
            rgb.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
            out = io.BytesIO()
            rgb.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)  # sem exif=: nada é copiado
            return out.getvalue()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise UnreadableImageError("The image could not be read") from exc
