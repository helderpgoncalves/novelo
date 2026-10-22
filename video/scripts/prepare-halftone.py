"""Campos de densidade para o meio-tom animado do vídeo, a partir das fotografias da marca (scripts/brand/base).

Mesma curva da linguagem dither (docs/marca/linguagem-dither.md): níveis por percentis, gama, cobertura 5% a 95%.
Claro: escuro = denso. Escuro: luminoso = denso. Saída: src/data/halftone.json (um campo por fotografia e formato).
"""

import base64
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "scripts/brand/base"
OUT = Path(__file__).resolve().parents[1] / "src/data/halftone.json"

# (nome, fotografia, tom, foco x/y, zoom)
JOBS = [
    ("penha", "penha-fonte.jpg", "dark", {"landscape": (0.62, 0.55), "portrait": (0.8, 0.5)}, 1.0),
    ("fabrica", "fabrica-fonte.jpg", "dark", (0.5, 0.45), 1.0),
    ("plataforma", "plataforma-fonte.jpg", "dark", (0.5, 0.5), 1.0),
    ("paco", "paco-fonte.jpg", "light", (0.5, 0.5), 1.0),
]
# formato: (largura, altura, passo em px do vídeo)
FORMATS = {"landscape": (1920, 1080, 8), "portrait": (1080, 1920, 8)}


def cover(img: Image.Image, w: int, h: int, focus: tuple[float, float], zoom: float) -> Image.Image:
    iw, ih = img.size
    scale = max(w / iw, h / ih) * zoom
    cw, ch = w / scale, h / scale
    cx = min(max(focus[0] * iw, cw / 2), iw - cw / 2)
    cy = min(max(focus[1] * ih, ch / 2), ih - ch / 2)
    return img.crop((round(cx - cw / 2), round(cy - ch / 2), round(cx + cw / 2), round(cy + ch / 2))).resize((w, h), Image.LANCZOS)


def density(img: Image.Image, dark: bool) -> np.ndarray:
    a = np.asarray(img.convert("L").filter(ImageFilter.GaussianBlur(0.6)), dtype=np.float64) / 255
    p0, p1 = np.percentile(a, [2, 98])
    a = np.clip((a - p0) / max(p1 - p0, 1e-6), 0, 1)
    d = a if dark else 1 - a
    d = d ** (1.35 if dark else 1.4)
    return 0.05 + 0.90 * d


fields = {}
for name, file, tone, focus, zoom in JOBS:
    src = Image.open(BASE / file).convert("RGB")
    for fmt, (w, h, step) in FORMATS.items():
        cols, rows = w // step + 1, h // step + 1
        crop = cover(src, cols, rows, focus[fmt] if isinstance(focus, dict) else focus, zoom)
        d = density(crop, tone == "dark")
        q = np.round(d * 255).astype(np.uint8)
        fields[f"{name}-{fmt}"] = {
            "cols": cols,
            "rows": rows,
            "step": step,
            "tone": tone,
            "data": base64.b64encode(q.tobytes()).decode(),
        }
        print(name, fmt, cols, rows)
OUT.write_text(json.dumps(fields))
print(OUT, OUT.stat().st_size // 1024, "KB")
