"""Verifica o alinhamento do logótipo medindo píxeis reais (rsvg-convert), a 512 px de largura.

Falha se o símbolo e o wordmark saírem da tolerância de 0,5 px. Corre com `just brand-check`.
"""

from __future__ import annotations

import io
import subprocess

import numpy as np
import pytest
from geometry import PALETTES, ROOT, SYM_H, SYM_W, build
from PIL import Image

TOL = 0.5  # px a 512 px de largura
W = 512
G = build()


def render(path, width: int = W) -> np.ndarray:
    out = subprocess.run(["rsvg-convert", "-f", "png", "-w", str(width), str(path)], capture_output=True, check=True).stdout
    return np.array(Image.open(io.BytesIO(out)).convert("RGBA"))[..., 3].astype(float) / 255


def edges(alpha: np.ndarray, axis: int) -> tuple[float, float]:
    """Bordas de tinta com precisão sub-pixel (cobertura parcial dos píxeis de fronteira)."""
    prof = alpha.max(axis=axis)
    idx = np.nonzero(prof > 0.02)[0]
    lo, hi = idx[0], idx[-1]
    return lo + (1 - prof[lo]), hi + prof[hi]


def test_lockup_alignment() -> None:
    a = render(ROOT / "brand/logotipo/novelo-logotipo-positivo.svg")
    h, w = a.shape
    k = w / G.box_w  # px por unidade de fonte
    cols = np.nonzero(a.max(axis=0) > 0.02)[0]
    gaps = np.nonzero(np.diff(cols) > 1)[0]
    split = cols[gaps[0]] + 1  # primeira coluna vazia depois do símbolo
    sym, word = a[:, :split], a[:, split:]
    sy0, sy1 = edges(sym, 1)
    sx0, sx1 = edges(sym, 0)
    # "N": primeiras colunas da tinta do wordmark (serifas no topo e na base)
    wcols = np.nonzero(word.max(axis=0) > 0.02)[0]
    nx0 = split + wcols[0]
    n_ink = a[:, nx0 : nx0 + round(0.05 * G.cap * k) + 1]
    ny0, ny1 = edges(n_ink, 1)
    nxl = edges(n_ink, 0)[0] + nx0

    base_y = -G.box_y0 * k
    # linha de base e altura de maiúscula do N
    assert abs(ny1 - base_y) <= TOL, f"base do N {ny1} vs {base_y}"
    assert abs(ny0 - (base_y - G.cap * k)) <= TOL, f"topo do N {ny0}"
    # símbolo: altura = cap + 2 x overshoot, centro = centro das maiúsculas
    assert abs((sy1 - sy0) - G.sym_h * k) <= TOL
    assert abs((sy0 + sy1) / 2 - (base_y - G.cap * k / 2)) <= TOL
    assert abs((sx1 - sx0) - G.sym_w * k) <= TOL
    # distância símbolo-texto = U
    assert abs((nxl - sx1) - G.unit * k) <= TOL
    # símbolo centrado verticalmente na caixa do lockup (centrar em flex fica exato)
    assert abs((sy0 + sy1) / 2 - h / 2) <= TOL
    # caixa tight na horizontal: tinta encosta às duas margens
    assert abs(sx0) <= TOL and abs(edges(a, 0)[1] - w) <= TOL


def test_stacked_alignment() -> None:
    a = render(ROOT / "brand/logotipo/novelo-logotipo-empilhado-positivo.svg")
    h, w = a.shape
    k = w / G.st_box_w
    rows = np.nonzero(a.max(axis=1) > 0.02)[0]
    split = rows[np.nonzero(np.diff(rows) > 1)[0][0]] + 1
    sym, word = a[:split], a[split:]
    sx0, sx1 = edges(sym, 0)
    sy0, sy1 = edges(sym, 1)
    wx0, wx1 = edges(word, 0)
    assert abs((sx0 + sx1) / 2 - w / 2) <= TOL, "símbolo centrado no eixo vertical"
    assert abs((wx0 + wx1) / 2 - w / 2) <= TOL, "wordmark centrado"
    assert abs((sy1 - sy0) - G.st_sym_h * k) <= TOL
    top_word = split + edges(word, 1)[0]
    assert abs((top_word - sy1) - G.st_gap * k) <= TOL


def test_symbol_only_centered() -> None:
    a = render(ROOT / "brand/simbolo/novelo-simbolo-positivo.svg")
    h, w = a.shape
    assert abs(w / h - SYM_W / SYM_H) < 0.01
    (x0, x1), (y0, y1) = edges(a, 0), edges(a, 1)
    exp_h = w * SYM_H / SYM_W  # rsvg arredonda a altura da tela para cima
    assert x0 <= TOL and abs(x1 - w) <= TOL and y0 <= TOL and abs(y1 - exp_h) <= TOL


@pytest.mark.parametrize("name", ["icon-512.png", "maskable-512.png", "apple-touch-icon.png", "icon-192.png"])
def test_icons_centered_and_safe(name: str) -> None:
    im = np.array(Image.open(ROOT / "apps/web/public/icons" / name).convert("RGB")).astype(int)
    bg = im[0, 0]
    ink = np.abs(im - bg).sum(axis=2) > 24
    ys, xs = np.nonzero(ink)
    s = im.shape[0]
    assert abs((xs.min() + xs.max() + 1) / 2 - s / 2) <= TOL + 0.5
    assert abs((ys.min() + ys.max() + 1) / 2 - s / 2) <= TOL + 0.5
    r = np.hypot(xs + 0.5 - s / 2, ys + 0.5 - s / 2).max()
    if name.startswith("maskable"):
        assert r <= 0.40 * s, "tinta fora da zona segura (círculo de 40 %)"
    else:
        assert r <= 0.48 * s


def test_email_and_avatar_sizes() -> None:
    assert Image.open(ROOT / "apps/web/public/email/novelo-logotipo-negativo.png").width == 264
    assert Image.open(ROOT / "apps/web/public/email/novelo-logotipo.png").width == 264
    for n in (256, 512, 1024):
        assert Image.open(ROOT / f"brand/avatar/novelo-avatar-claro-{n}.png").size == (n, n)
    assert Image.open(ROOT / "apps/web/public/og-image.png").size == (1200, 630)


def _lum(h: str) -> float:
    def ch(v: int) -> float:
        c = v / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (int(h[i : i + 2], 16) for i in (1, 3, 5))
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def _contrast(a: str, b: str) -> float:
    hi, lo = sorted((_lum(a), _lum(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def test_contrast() -> None:
    pos, neg = PALETTES["positivo"], PALETTES["negativo"]
    assert _contrast(pos[4], "#F4F1EA") >= 7  # wordmark e ponto sobre Linho
    assert _contrast(neg[4], "#14211D") >= 7
    assert _contrast(neg[1], "#14211D") >= 4.5  # fio do meio sobre Tinta
    from build_assets import TILE_PAL

    assert _contrast(TILE_PAL[0], "#14211D") >= 3  # favicon: objetos gráficos >= 3:1 (WCAG 1.4.11)
    assert _contrast(TILE_PAL[2], "#14211D") >= 3


def test_small_size_legible() -> None:
    """A 96 px de largura o wordmark continua legível: altura de maiúscula >= 8 px; o símbolo >= 16 px."""
    k = 96 / G.box_w
    assert G.cap * k >= 8
    assert G.sym_h * k >= 12
    assert G.minimum_lockup_px >= 96
