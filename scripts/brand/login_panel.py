#!/usr/bin/env python3
"""Painel do ecrã de entrada (`login-painel-{light,dark}-{960,1440}.avif`, 3:4): fotografia da Penha em meio-tom.

Uso: `just brand-login`. Saída: apps/web/public/landing/. Determinístico. Precisa de rsvg-convert e Pillow com AVIF.
A landing usa a mesma Penha e outras fotografias de Guimarães (hero_derivatives.py); este painel mantém a imagem de produção, inalterada.
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
    dither_assets.place_login(dither_assets.Ctx(build(), rsvg))


if __name__ == "__main__":
    main()
