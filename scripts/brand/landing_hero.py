#!/usr/bin/env python3
"""Ativos dither da landing e do painel de entrada: hero (16:9, 4:3, móvel), texturas, tile e login, claro e escuro.

Uso: `just brand` (corre isto a seguir a build_assets.py) ou
`uv run --no-project --with fonttools --with brotli --with uharfbuzz --with numpy --with pillow python scripts/brand/landing_hero.py`.
Saída: apps/web/public/landing/ (+ manifest.json com dimensões e pesos). Determinístico (sementes fixas).
Precisa de rsvg-convert (geometria real do símbolo) e de Pillow com AVIF.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import dither_assets
from build_assets import rsvg
from geometry import build


def main() -> None:
    if not shutil.which("rsvg-convert"):
        raise SystemExit("falta rsvg-convert (brew install librsvg)")
    dither_assets.place_landing(dither_assets.Ctx(build(), rsvg))


if __name__ == "__main__":
    main()
