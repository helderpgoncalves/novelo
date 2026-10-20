"""Ficheiros de teste gerados em memória para os testes e avaliações do copiloto (nada em disco)."""

import io
import zipfile
from typing import Any

from PIL import Image


def png(size: tuple[int, int] = (64, 32), color: str = "red") -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


def jpeg_with_exif(size: tuple[int, int] = (3000, 2000)) -> bytes:
    exif = Image.Exif()
    exif[0x010F] = "SecretCamera"
    buf = io.BytesIO()
    Image.new("RGB", size, "blue").save(buf, format="JPEG", exif=exif)
    return buf.getvalue()


def pdf_with_text(text: str, pages: int = 1) -> bytes:
    """PDF mínimo, escrito à mão, com texto extraível (sem depender de WeasyPrint)."""
    objects: list[bytes] = [b"<< /Type /Catalog /Pages 2 0 R >>"]
    kids = " ".join(f"{3 + 2 * i} 0 R" for i in range(pages))
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {pages} >>".encode())
    font = 3 + 2 * pages
    for i in range(pages):
        content = f"BT /F1 12 Tf 50 700 Td ({text} page {i + 1}) Tj ET".encode()
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {4 + 2 * i} 0 R /Resources << /Font << /F1 {font} 0 R >> >> >>".encode()
        )
        objects.append(b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream")
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    out = b"%PDF-1.4\n"
    offsets = []
    for n, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{n} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    out += b"".join(f"{o:010d} 00000 n \n".encode() for o in offsets)
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return out


def xlsx(rows: list[list[Any]]) -> bytes:
    from openpyxl import Workbook  # noqa: PLC0415

    wb = Workbook()
    ws = wb.active
    assert ws is not None
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def zip_bytes(files: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in files.items():
            z.writestr(name, data)
    return buf.getvalue()


CSV = "freguesia;toneladas;custo\nSelho;12,5;1 200\nSerzedelo;8,0;900\nSelho;3,5;300\nAzurém;20,0;2 500\n"
