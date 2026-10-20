#!/usr/bin/env python3
"""Subsets das fontes da landing (pt-PT) a partir dos TTF variáveis de google/fonts (SIL OFL 1.1).

Uso: `just brand-fonts` (ou `uv run --no-project --with fonttools --with brotli python scripts/brand/fonts_landing.py`).
Descarrega os TTF para `scripts/brand/cache/` (ignorado pelo Git) e escreve os WOFF2 em `apps/web/public/fonts/`.
Orçamento: <= 120 KB no total (hoje 110 712 bytes).
"""

from __future__ import annotations

import io
import urllib.parse
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).parent / "cache"
OUT = ROOT / "apps/web/public/fonts"
BASE = "https://raw.githubusercontent.com/google/fonts/main/ofl/"
UNICODES = (
    "U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2013-2014,U+2018-201A,U+201C-201E,"
    "U+2022,U+2026,U+2030,U+2039-203A,U+20AC,U+2122,U+2190-2193,U+2212,U+2215,U+00B7,U+2248,U+2260,U+2264-2265,U+25CF"
)
FEATURES = ["kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk", "tnum", "lnum", "onum", "pnum", "case", "frac", "zero", "ss01", "cv11"]
JOBS = [
    ("newsreader-display-roman.woff2", "newsreader/Newsreader[opsz,wght].ttf", {"wght": 500, "opsz": (36, 72)}),
    ("newsreader-display-italic.woff2", "newsreader/Newsreader-Italic[opsz,wght].ttf", {"wght": 400, "opsz": 60}),
    ("inter-landing.woff2", "inter/Inter[opsz,wght].ttf", {"wght": (400, 600), "opsz": 14}),
    ("geist-mono-landing.woff2", "geistmono/GeistMono[wght].ttf", {"wght": (400, 500)}),
]
BUDGET = 120 * 1024


def fetch(rel: str) -> Path:
    p = CACHE / Path(rel).name
    if not p.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(BASE + urllib.parse.quote(rel, safe="/"), p)
    return p


def build(src: Path, out: Path, limits: dict) -> int:
    f = instancer.instantiateVariableFont(TTFont(src), limits)
    buf = io.BytesIO()
    f.save(buf)
    buf.seek(0)
    f = TTFont(buf)  # recarrega: o subsetter falha com tabelas preguiçosas do instancer
    o = subset.Options()
    o.flavor = "woff2"
    o.layout_features = FEATURES
    o.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    o.hinting = False
    o.desubroutinize = True
    s = subset.Subsetter(o)
    s.populate(unicodes=subset.parse_unicodes(UNICODES))
    s.subset(f)
    f.flavor = "woff2"
    f.save(out)
    return out.stat().st_size


def main() -> None:
    total = 0
    for name, rel, limits in JOBS:
        size = build(fetch(rel), OUT / name, limits)
        total += size
        print(f"{name}: {size} bytes")
    print(f"total: {total} bytes")
    if total > BUDGET:
        raise SystemExit(f"fontes da landing acima de {BUDGET} bytes")


if __name__ == "__main__":
    main()
