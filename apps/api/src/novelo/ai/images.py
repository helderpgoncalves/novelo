"""Reduz as fotos da triagem antes de as enviar: menos tokens, menos latência, menos custo, sem metadados."""

import io

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_SIDE = 1024
JPEG_QUALITY = 80


class UnreadableImageError(ValueError):
    pass


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
