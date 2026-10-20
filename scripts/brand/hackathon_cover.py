#!/usr/bin/env python3
"""Capa oficial do Hack4Guimarães 2035 para o cartão do rodapé da landing.

Descarrega a capa da Taikai (cache local em `scripts/brand/cache/`, nunca no repositório: 2,4 MB), reduz-a a 960×540 e 480×270
e codifica AVIF (avifenc) e WebP (cwebp, reserva). Os nomes levam o hash do conteúdo (cache imutável) e escreve
`apps/web/src/features/landing/hackathon-cover.generated.ts` com os ficheiros. Não altera a imagem: só a reduz.

Uso: `just brand-hackathon`. Precisa de rede na primeira vez, de `avifenc` e `cwebp` (brew install libavif webp) e de Pillow.
Origem e termos de uso: `apps/web/public/landing/CREDITS.md`.
"""

from __future__ import annotations

import hashlib
import shutil
import subprocess
import tempfile
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
LANDING = ROOT / "apps/web/public/landing"
GENERATED = ROOT / "apps/web/src/features/landing/hackathon-cover.generated.ts"
CACHE = Path(__file__).parent / "cache" / "hackathon-cover.png"
SOURCE_URL = (
    "https://taikai.azureedge.net/6-6HSED8o_p2t65w-VUI4qP_HQoOOZe04Wh-wbMropc/rs:fit:1920:0:0/"
    "aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3RhaWthaS1zdG9yYWdlL2ltYWdlcy9hNTQyYzBmMC1iNjhmLTExZjEt"
    "YWE1My04MzQwOTY0NDdjMTloYWNrYXRob24tY292ZXIucG5n"
)
SIZES = ((480, 270), (960, 540))
AVIF_QUALITY = 62
WEBP_QUALITY = 78


def fetch() -> Path:
    if not CACHE.exists():
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310 (URL fixo, https)
            CACHE.write_bytes(resp.read())
    return CACHE


def encode(png: Path, out: Path, kind: str) -> bytes:
    if kind == "avif":
        cmd = ["avifenc", "-q", str(AVIF_QUALITY), "-s", "4", "-j", "all", "--yuv", "420", str(png), str(out)]
    else:
        cmd = ["cwebp", "-quiet", "-q", str(WEBP_QUALITY), "-m", "6", "-sharp_yuv", str(png), "-o", str(out)]
    subprocess.run(cmd, check=True, capture_output=True)
    return out.read_bytes()


def main() -> None:
    for tool in ("avifenc", "cwebp"):
        if not shutil.which(tool):
            raise SystemExit(f"falta {tool} (brew install libavif webp)")
    for old in LANDING.glob("hackathon-*"):  # sem órfãos
        old.unlink()
    rows: list[tuple[str, str, int, int, int]] = []
    with Image.open(fetch()) as src, tempfile.TemporaryDirectory() as tmp:
        base = src.convert("RGB")
        for w, h in SIZES:
            small = base.resize((w, h), Image.Resampling.LANCZOS)
            png = Path(tmp) / f"{w}.png"
            small.save(png)
            for kind in ("avif", "webp"):
                data = encode(png, Path(tmp) / f"{w}.{kind}", kind)
                name = f"hackathon-cover-{w}.{hashlib.sha256(data).hexdigest()[:8]}.{kind}"
                (LANDING / name).write_bytes(data)
                rows.append((kind, name, w, h, len(data)))
                print(f"{name}: {len(data) / 1024:.1f} KB")
    lines = [
        "// Gerado por scripts/brand/hackathon_cover.py (`just brand-hackathon`). Não editar.",
        "export const HACKATHON_COVER = {",
        "  width: 960,",
        "  height: 540,",
    ]
    for kind in ("avif", "webp"):
        items = ", ".join(f"{{ src: '{n}', w: {w} }}" for k, n, w, _h, _b in rows if k == kind)
        lines.append(f"  {kind}: [{items}],")
    lines += ["} as const;", ""]
    GENERATED.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
