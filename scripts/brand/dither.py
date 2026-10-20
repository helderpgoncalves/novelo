"""Motor de dither/halftone da marca Novelo (numpy + Pillow, sem mais dependências).

Uma grelha de pontos rodada (célula, ângulo), um campo de densidade 0..1 e uma rampa de cor por densidade:
cada ponto tem a cor da densidade no centro da sua célula e o tamanho dado pela densidade (halftone AM).
Os pontos são desenhados com anti-aliasing analítico (distância ao contorno), por isso saem nítidos em
qualquer escala e comprimem muito bem sem perdas (WebP lossless).

Uso: ver `dither_assets.py` (partilha, banners, capa) e `docs/marca/linguagem-dither.md` (princípios).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Literal, Sequence

import numpy as np
from PIL import Image, ImageFilter

Shape = Literal["round", "cross", "diamond", "square"]
RGB = tuple[int, int, int]

# Paleta (guia de marca)
LINHO: RGB = (0xF4, 0xF1, 0xEA)
TINTA: RGB = (0x14, 0x21, 0x1D)
FLORESTA: RGB = (0x2E, 0x6B, 0x57)
FLORESTA_CLARA: RGB = (0x7F, 0xB3, 0x9C)
VERDE_CLARO: RGB = (0xA9, 0xC2, 0xB7)
AREIA: RGB = (0xC4, 0xA0, 0x6A)
PEDRA: RGB = (0x5E, 0x6B, 0x66)
FUNDO_ESCURO: RGB = (0x0F, 0x18, 0x15)
FIO_ESCURO: RGB = (0x3E, 0x66, 0x58)


def hex_rgb(h: str) -> RGB:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


@dataclass(frozen=True)
class Palette:
    """Fundo + rampa de tinta (paragens densidade -> cor). Interpola em sRGB linear."""

    paper: RGB
    ramp: Sequence[tuple[float, RGB]]

    def ink(self, d: np.ndarray) -> np.ndarray:
        d = np.clip(d, 0.0, 1.0)
        xs = [p for p, _ in self.ramp]
        out = np.empty(d.shape + (3,), dtype=np.float32)
        for c in range(3):
            ys = [_to_lin(col[c]) for _, col in self.ramp]
            out[..., c] = np.interp(d, xs, ys)
        return _from_lin(out)


def _to_lin(v: float) -> float:
    v = v / 255.0
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def _from_lin(a: np.ndarray) -> np.ndarray:
    a = np.clip(a, 0, 1)
    s = np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(a, 1 / 2.4) - 0.055)
    return s * 255.0


# Rampas de marca. Claro: pontos escuros sobre Linho; escuro: pontos claros sobre o fundo escuro.
OURO = Palette(LINHO, [(0.0, AREIA), (0.5, FLORESTA), (1.0, TINTA)])
CAMPO = Palette(LINHO, [(0.0, VERDE_CLARO), (0.55, FLORESTA), (1.0, TINTA)])
DUNAS = Palette(LINHO, [(0.0, AREIA), (0.55, PEDRA), (1.0, TINTA)])
OURO_ESCURO = Palette(FUNDO_ESCURO, [(0.0, FIO_ESCURO), (0.55, FLORESTA_CLARA), (1.0, AREIA)])
CAMPO_ESCURO = Palette(FUNDO_ESCURO, [(0.0, FIO_ESCURO), (1.0, FLORESTA_CLARA)])
DUNAS_ESCURO = Palette(FUNDO_ESCURO, [(0.0, FIO_ESCURO), (0.6, PEDRA), (1.0, AREIA)])

PALETTES = {
    "ouro": (OURO, OURO_ESCURO),
    "campo": (CAMPO, CAMPO_ESCURO),
    "dunas": (DUNAS, DUNAS_ESCURO),
}


@dataclass
class Halftone:
    cell: float = 6.0  # lado da célula em píxeis de saída
    angle: float = 45.0  # graus
    shape: Shape = "round"
    softness: float = 1.0  # largura do anti-aliasing em px (1 = nítido)
    gamma: float = 1.0  # curva de densidade: d' = d ** gamma
    grain: float = 0.0  # ruído por pixel na cobertura (0..0.3), dá o "glitter" da referência 1
    jitter: float = 0.0  # variação por célula do tamanho do ponto (0..0.2)
    seed: int = 7
    min_density: float = 0.015  # abaixo disto não há ponto (branco puro)
    extra: dict = field(default_factory=dict)

    def render(
        self,
        density: np.ndarray,
        palette: Palette,
        ink_map: np.ndarray | None = None,
    ) -> Image.Image:
        """`density`: (H, W) float 0..1 ao tamanho da saída. `ink_map` opcional (H, W, 3) substitui a rampa."""
        h, w = density.shape
        rng = np.random.default_rng(self.seed)
        th = math.radians(self.angle)
        c, s = math.cos(th), math.sin(th)
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        xx += 0.5
        yy += 0.5
        u = (xx * c + yy * s) / self.cell
        v = (-xx * s + yy * c) / self.cell
        iu, iv = np.floor(u), np.floor(v)
        lu, lv = u - iu - 0.5, v - iv - 0.5
        cu, cv = iu + 0.5, iv + 0.5
        cx = np.clip(((cu * c - cv * s) * self.cell).astype(np.int32), 0, w - 1)
        cy = np.clip(((cu * s + cv * c) * self.cell).astype(np.int32), 0, h - 1)
        d = np.clip(density[cy, cx], 0, 1) ** self.gamma
        if self.jitter:
            # ruído estável por célula (hash das coordenadas da célula)
            hsh = (iu.astype(np.int64) * 73856093) ^ (iv.astype(np.int64) * 19349663) ^ self.seed
            r = ((hsh % 1000) / 1000.0 - 0.5) * 2.0
            d = np.clip(d * (1 + self.jitter * r), 0, 1)
        d = np.where(d < self.min_density, 0.0, d)

        px = self.softness / self.cell  # largura do AA em unidades de célula
        if self.shape == "round":
            rad = 0.7072 * np.sqrt(d)
            sdf = np.sqrt(lu * lu + lv * lv) - rad
        elif self.shape == "diamond":
            rad = np.sqrt(d / 2.0)
            sdf = (np.abs(lu) + np.abs(lv) - rad) / math.sqrt(2)
        elif self.shape == "square":
            sdf = np.maximum(np.abs(lu), np.abs(lv)) - 0.5 * np.sqrt(d)
        else:  # cross: dois retângulos que crescem até encher a célula
            arm = 0.5 * np.sqrt(d)
            thick = arm * (0.34 + 0.66 * d * d)
            s1 = np.maximum(np.abs(lu) - arm, np.abs(lv) - thick)
            s2 = np.maximum(np.abs(lv) - arm, np.abs(lu) - thick)
            sdf = np.minimum(s1, s2)
        cov = np.clip(0.5 - sdf / px, 0.0, 1.0)
        cov = np.where(d > 0, cov, 0.0)
        if self.grain:
            cov = np.clip(cov + (rng.random((h, w), dtype=np.float32) - 0.5) * self.grain * cov * (1 - cov) * 4, 0, 1)

        if ink_map is not None:
            ink = ink_map[cy, cx].astype(np.float32)
        else:
            ink = palette.ink(d)
        paper = np.array(palette.paper, dtype=np.float32)
        out = paper * (1 - cov[..., None]) + ink * cov[..., None]
        return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8), "RGB")


# ---------------------------------------------------------------- campos de densidade

def smoothstep(a: float, b: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def value_noise(h: int, w: int, scale_x: float, scale_y: float, seed: int, octaves: int = 4) -> np.ndarray:
    """Ruído fractal suave 0..1 (grelhas aleatórias ampliadas com bicúbica), anisotrópico se scale_x != scale_y."""
    rng = np.random.default_rng(seed)
    acc = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        gw = max(2, int(w / (scale_x / 2**o)) + 2)
        gh = max(2, int(h / (scale_y / 2**o)) + 2)
        g = Image.fromarray((rng.random((gh, gw)) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        acc += amp * np.asarray(g, np.float32) / 255.0
        tot += amp
        amp *= 0.5
    return acc / tot


def gradient(h: int, w: int, direction: tuple[float, float], start: float = 0.0, end: float = 1.0, power: float = 1.0) -> np.ndarray:
    """Rampa linear ao longo de `direction` (dx, dy), 0 no canto/lado oposto, 1 no lado para onde aponta."""
    dx, dy = direction
    n = math.hypot(dx, dy) or 1.0
    dx, dy = dx / n, dy / n
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    t = (xx * dx + yy * dy)
    t = (t - t.min()) / (t.max() - t.min())
    return np.clip((t - start) / (end - start), 0, 1) ** power


def photo_density(img: Image.Image, size: tuple[int, int], lo: float = 1.0, hi: float = 99.0, gamma: float = 1.0, dark: bool = False, blur: float = 0.0) -> np.ndarray:
    """Fotografia -> densidade: escuro = denso (claro) ou luminoso = denso (escuro). Níveis automáticos por percentis."""
    g = img.convert("L").resize(size, Image.LANCZOS)
    if blur:
        g = g.filter(ImageFilter.GaussianBlur(blur))
    a = np.asarray(g, np.float32) / 255.0
    p0, p1 = np.percentile(a, [lo, hi])
    a = np.clip((a - p0) / (p1 - p0 + 1e-6), 0, 1)
    d = a if dark else 1.0 - a
    return d**gamma


def cover_crop(img: Image.Image, size: tuple[int, int], focus: tuple[float, float] = (0.5, 0.5), zoom: float = 1.0) -> Image.Image:
    """Recorta e redimensiona para `size` mantendo a proporção; `focus` (0..1) escolhe o centro do corte e
    `zoom` > 1 aproxima (corta mais)."""
    w, h = img.size
    tw, th = size
    s = max(tw / w, th / h) * zoom
    nw, nh = round(w * s), round(h * s)
    r = img.resize((nw, nh), Image.LANCZOS)
    x = round((nw - tw) * focus[0])
    y = round((nh - th) * focus[1])
    return r.crop((x, y, x + tw, y + th))


def dunes_density(h: int, w: int, seed: int = 3) -> np.ndarray:
    """Dunas/ondas: cristas alongadas na horizontal sobre uma encosta que sobe para a direita (referência 2)."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    n = value_noise(h, w, w * 0.55, h * 0.18, seed, 4)
    warp = (n - 0.5) * 0.35
    # horizonte: linha que desce para a esquerda e sobe para a direita
    horizon = 0.78 - 0.45 * (xx / w) ** 1.4
    y = yy / h + warp * 0.5
    below = smoothstep(horizon - 0.04, horizon + 0.30, y)
    ridges = 0.5 + 0.5 * np.sin((y * 11.0 + n * 3.2) * math.pi)
    d = below * (0.18 + 0.62 * ridges) + 0.55 * smoothstep(horizon - 0.02, horizon + 0.08, y) * (xx / w) ** 1.2
    # céu quase branco com densidade residual (dá a textura fina no topo, como na referência)
    sky = 0.07 + 0.05 * gradient(h, w, (0, -1), 0, 1, 1.5)
    return np.clip(np.maximum(d, sky * (1 - below)), 0, 1)


def field_density(h: int, w: int, seed: int = 5, corner: tuple[float, float] = (1.0, 1.0)) -> np.ndarray:
    """Campo: densidade mínima uniforme que se adensa no canto `corner` (0..1, 0..1) com estrias horizontais (referência 3)."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    dist = np.hypot((xx / w - corner[0]) * 1.0, (yy / h - corner[1]) * 1.1)
    base = np.clip(1.0 - dist / 0.95, 0, 1) ** 1.7
    n = value_noise(h, w, w * 0.6, h * 0.05, seed, 3)
    return np.clip(0.09 + base * (0.55 + 0.5 * n), 0, 1)


def save_lossless(img: Image.Image, path: str) -> int:
    """WebP lossless (método 6). Devolve o tamanho em bytes."""
    img.save(path, "WEBP", lossless=True, quality=100, method=6)
    import os

    return os.path.getsize(path)


# ---------------------------------------------------------------- grelha de pontos alinhada ao píxel (landing)

def box_mean(a: np.ndarray, size: int) -> np.ndarray:
    """Média numa janela quadrada (imagem integral), bordas replicadas."""
    r = size // 2
    p = np.pad(a, r, mode="edge").astype(np.float64)
    c = np.pad(p.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    out = c[size:, size:] - c[:-size, size:] - c[size:, :-size] + c[:-size, :-size]
    return (out / (size * size))[: a.shape[0], : a.shape[1]].astype(np.float32)


def lattice_halftone(
    density: np.ndarray,
    palette: Palette,
    step: int,
    softness: float = 1.0,
    ink_map: np.ndarray | None = None,
) -> Image.Image:
    """Meio-tom redondo a 45º com os centros dos pontos em coordenadas inteiras (grelha de base `step` px).

    Os centros ficam em (step*m, step*n) com m+n par: célula = step*sqrt(2) px, e cada ponto cai sempre da mesma forma
    sobre a grelha de píxeis (sem batimento nem moiré de rasterização). Gera-se diretamente ao tamanho final, por isso nada
    é reamostrado. A densidade de cada ponto é a média da sua célula (janela de ~1 célula), não uma amostra pontual, e os
    pontos mais pequenos que 1 px degradam em área (cobertura = área) em vez de oscilarem. `d = 1` enche a célula.
    """
    h, w = density.shape
    cell = step * math.sqrt(2.0)
    win = max(1, int(round(cell))) | 1
    dens = box_mean(density.astype(np.float32), win)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    xx += 0.5
    yy += 0.5
    p = (xx + yy) / (2.0 * step)
    q = (xx - yy) / (2.0 * step)
    ip, iq = np.round(p), np.round(q)
    dist = np.hypot(p - ip, q - iq) * cell  # px até ao centro do ponto
    cx = np.clip((step * (ip + iq)).astype(np.int32), 0, w - 1)
    cy = np.clip((step * (ip - iq)).astype(np.int32), 0, h - 1)
    d = np.clip(dens[cy, cx], 0.0, 1.0)
    rad = cell * 0.7072 * np.sqrt(d)
    cov = np.clip(0.5 - (dist - rad) / softness, 0.0, 1.0)
    # ponto sub-píxel: a área do círculo reparte-se pelos 4 píxeis à volta do centro
    tiny = np.where(dist < 1.0, np.pi * rad * rad / 4.0, 0.0)
    cov = np.where(rad < 0.7, np.minimum(cov, tiny), cov)
    ink = ink_map[cy, cx].astype(np.float32) if ink_map is not None else palette.ink(d)
    paper = np.array(palette.paper, dtype=np.float32)
    out = paper * (1 - cov[..., None]) + ink * cov[..., None]
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8), "RGB")
