"""Processamento da miniatura: sem metadados, pequena, JPEG progressivo, formatos validados pelos bytes."""

import io
import random

import pytest
from PIL import Image

from novelo.core.errors import AppError
from novelo.features.lots import photos
from novelo.features.lots.photo_store import CREDIT_MAX_CHARS, InvalidCreditError, clean_credit_text
from novelo.features.lots.triage import InvalidImageError

MAX = 153_600


def _jpeg_with_exif(size: tuple[int, int] = (200, 100), orientation: int | None = None) -> bytes:
    exif = Image.Exif()
    exif[0x010F] = "SecretCamera"
    exif[0x9003] = "2026:10:23 10:00:00"
    if orientation:
        exif[0x0112] = orientation
    gps = exif.get_ifd(0x8825)
    gps[1], gps[2], gps[3], gps[4] = "N", (41.0, 26.0, 30.0), "W", (8.0, 17.0, 30.0)
    img = Image.new("RGB", size, "red")
    out = io.BytesIO()
    img.save(out, format="JPEG", exif=exif, icc_profile=b"ICC_PROFILE-fake" + b"\0" * 100)
    return out.getvalue()


def test_exif_gps_and_icc_are_removed() -> None:
    src = _jpeg_with_exif()
    assert b"SecretCamera" in src  # a fonte tem mesmo metadados
    result = photos.process(src, MAX)
    assert b"SecretCamera" not in result.content and b"Exif" not in result.content
    assert b"ICC_PROFILE" not in result.content
    img = Image.open(io.BytesIO(result.content))
    assert img.format == "JPEG" and not img.getexif() and "icc_profile" not in img.info
    assert not img.getexif().get_ifd(0x8825)  # GPS
    assert img.info.get("progressive") or img.info.get("progression")  # JPEG progressivo


def test_orientation_is_applied_before_metadata_is_dropped() -> None:
    # 200x100 com orientação 6 (rodar 90°) tem de sair 100x200
    result = photos.process(_jpeg_with_exif((200, 100), orientation=6), MAX)
    assert (result.width, result.height) == (100, 200)
    assert Image.open(io.BytesIO(result.content)).size == (100, 200)


def test_large_image_is_scaled_to_640_on_the_long_side() -> None:
    out = io.BytesIO()
    Image.new("RGB", (3200, 1600), "blue").save(out, format="PNG")
    result = photos.process(out.getvalue(), MAX)
    assert (result.width, result.height) == (640, 320) and result.size_bytes <= MAX and result.mime == "image/jpeg"


def test_transparent_png_and_webp_become_jpeg_on_white() -> None:
    for fmt in ("PNG", "WEBP"):
        out = io.BytesIO()
        Image.new("RGBA", (20, 20), (0, 0, 0, 0)).save(out, format=fmt)
        img = Image.open(io.BytesIO(photos.process(out.getvalue(), MAX).content)).convert("RGB")
        r, g, b = img.getpixel((10, 10))  # type: ignore[misc]
        assert min(r, g, b) > 245


def test_noisy_image_that_cannot_fit_is_rejected_with_400() -> None:
    rng = random.Random(1)
    img = Image.frombytes("RGB", (640, 640), rng.randbytes(640 * 640 * 3))
    out = io.BytesIO()
    img.save(out, format="PNG")
    with pytest.raises(InvalidImageError, match="too complex") as exc:
        photos.process(out.getvalue(), 30_000)  # ruído puro a 640 px nunca cabe em 30 KB
    assert exc.value.status_code == 400


def test_quality_steps_down_to_fit_a_smaller_limit() -> None:
    rng = random.Random(2)
    img = Image.frombytes("RGB", (300, 300), rng.randbytes(300 * 300 * 3))
    out = io.BytesIO()
    img.save(out, format="PNG")
    big = photos.process(out.getvalue(), 200_000)
    small = photos.process(out.getvalue(), 45_000)
    assert big.size_bytes <= 200_000 and small.size_bytes <= 45_000 and small.size_bytes < big.size_bytes


@pytest.mark.parametrize(
    "data",
    [
        b"",
        b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
        b"%PDF-1.7\n1 0 obj\n",
        b"GIF89a\x01\x00\x01\x00",
        b"\xff\xd8\xff" + b"garbage",  # assinatura de JPEG, conteúdo ilegível
    ],
)
def test_invalid_files_are_rejected(data: bytes) -> None:
    with pytest.raises(InvalidImageError):
        photos.process(data, MAX)


def test_svg_disguised_as_jpeg_name_is_still_rejected_by_content() -> None:
    with pytest.raises(AppError):
        photos.process(b"<?xml version='1.0'?><svg/>", MAX)


def test_input_over_5mb_is_rejected() -> None:
    with pytest.raises(InvalidImageError, match="5 MB"):
        photos.process(b"\xff\xd8\xff" + b"0" * photos.MAX_INPUT_BYTES, MAX)


def test_huge_dimensions_are_rejected_before_decoding() -> None:
    out = io.BytesIO()
    Image.new("1", (7000, 7000)).save(out, format="PNG")  # 49 MP, mas minúsculo em bytes
    with pytest.raises(InvalidImageError, match="too large"):
        photos.process(out.getvalue(), MAX)


def test_credit_is_trimmed_limited_and_plain_text() -> None:
    assert clean_credit_text(None) is None and clean_credit_text("   ") is None
    assert clean_credit_text("  Ana  Silva,  CC BY-SA 4.0 ") == "Ana Silva, CC BY-SA 4.0"
    assert len(clean_credit_text("a" * CREDIT_MAX_CHARS) or "") == 240
    for bad in ("a" * 241, "<b>x</b>", "x > y"):
        with pytest.raises(InvalidCreditError):
            clean_credit_text(bad)
