import io

import pytest
from PIL import Image

from novelo.ai.images import UnreadableImageError, shrink_for_vision


def _png(size: tuple[int, int], mode: str = "RGB") -> bytes:
    out = io.BytesIO()
    Image.new(mode, size, "red").save(out, format="PNG")
    return out.getvalue()


def test_large_image_is_resized_to_1024_and_becomes_jpeg() -> None:
    small = shrink_for_vision(_png((4000, 2000)))
    img = Image.open(io.BytesIO(small))
    assert img.format == "JPEG" and max(img.size) == 1024 and img.size == (1024, 512)
    assert len(small) < len(_png((4000, 2000)))


def test_exif_is_stripped_and_transparency_flattened() -> None:
    src = io.BytesIO()
    exif = Image.Exif()
    exif[0x010F] = "SecretCamera"
    Image.new("RGB", (50, 50), "blue").save(src, format="JPEG", exif=exif)
    assert b"SecretCamera" not in shrink_for_vision(src.getvalue())
    assert Image.open(io.BytesIO(shrink_for_vision(_png((10, 10), "RGBA")))).mode == "RGB"


def test_unreadable_bytes_raise() -> None:
    with pytest.raises(UnreadableImageError):
        shrink_for_vision(b"not an image")
