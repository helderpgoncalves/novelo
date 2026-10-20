"""Ativos de marca na linguagem dither: hero da landing, texturas, painel de entrada, partilha (OG), banners e capa.

Tudo determinístico (sementes fixas), sem rede: a fotografia de origem está em `base/penha-fonte.jpg`
(Wikimedia Commons, CC BY-SA 4.0, ver `apps/web/public/landing/CREDITS.md`). O wordmark e o símbolo vêm da
geometria única (`geometry.py`); os títulos são desenhados em curvas a partir da Newsreader real (sem fontes instaladas).

Chamado por `build_assets.py` (partilha, banners, capa).
Documentação da linguagem: docs/marca/linguagem-dither.md
"""

from __future__ import annotations

import base64
import io
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import numpy as np
import uharfbuzz as hb
from dither import (
    AREIA,
    CAMPO,
    CAMPO_ESCURO,
    DUNAS,
    DUNAS_ESCURO,
    FIO_ESCURO,
    FLORESTA,
    FUNDO_ESCURO,
    LINHO,
    TINTA,
    Halftone,
    Palette,
    cover_crop,
    dunes_density,
    field_density,
    hex_rgb,
    photo_density,
    smoothstep,
)
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from geometry import PALETTES, ROOT, Geometry, lockup_body, symbol_group
from PIL import Image

HERE = Path(__file__).parent
PHOTO = HERE / "base/penha-fonte.jpg"
BRAND = ROOT / "brand"
PUBLIC = ROOT / "apps/web/public"
LANDING = PUBLIC / "landing"
NEWSREADER = ROOT / "brand/fontes/newsreader/newsreader-latin-standard-normal.woff2"
INTER = ROOT / "brand/fontes/inter/inter-latin-standard-normal.woff2"

# Rampas de tinta claro/escuro (tritone dourado -> verde -> tinta; no escuro, pontos luminosos)
OURO_L = Palette(LINHO, [(0, AREIA), (0.42, (0xB4, 0x93, 0x55)), (0.70, FLORESTA), (1, TINTA)])
OURO_D = Palette(FUNDO_ESCURO, [(0, FIO_ESCURO), (0.28, (0x4F, 0x7A, 0x66)), (0.52, (0xA0, 0x8B, 0x5C)), (0.80, AREIA), (1, (0xE3, 0xC9, 0x8F))])
PAL = {"light": {"ouro": OURO_L, "campo": CAMPO, "dunas": DUNAS}, "dark": {"ouro": OURO_D, "campo": CAMPO_ESCURO, "dunas": DUNAS_ESCURO}}
MODES = ("light", "dark")
PEDRA_ESCURA = "#46534E"  # texto secundário sobre dither claro (Pedra escurecida: 7,6:1 sobre Linho; Pedra sozinha cai abaixo de AA com pontos)


# ------------------------------------------------------------------------------------------- contexto
@dataclass
class Ctx:
    g: Geometry
    rsvg: Callable[..., bytes]


# ------------------------------------------------------------------------------------------ utilitários
def _grid(h: int, w: int) -> tuple[np.ndarray, np.ndarray]:
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    return xx / w, yy / h


def fade_left(h: int, w: int, x0: float, x1: float, floor: float, skew: float = 0.0) -> np.ndarray:
    """Multiplicador 0..1: `floor` à esquerda (zona de texto), 1 depois de `x1` (com inclinação opcional)."""
    x, y = _grid(h, w)
    return floor + (1 - floor) * smoothstep(x0, x1, x + skew * y)


def fade_top(h: int, w: int, y0: float, y1: float, floor: float) -> np.ndarray:
    _, y = _grid(h, w)
    return floor + (1 - floor) * smoothstep(y0, y1, y)


def photo_field(photo: Image.Image, size: tuple[int, int], mode: str, focus: tuple[float, float], zoom: float = 1.0, gamma: float | None = None, floor: float = 0.05, fade: np.ndarray | None = None, ceil: float = 0.95) -> np.ndarray:
    """Fotografia -> densidade. Claro: escuro = denso; escuro: luminoso = denso. `fade` reduz a densidade na zona de texto."""
    w, h = size
    im = cover_crop(photo, size, focus, zoom)
    dark = mode == "dark"
    d = photo_density(im, size, lo=2, hi=98, gamma=gamma if gamma else (1.35 if dark else 1.4), dark=dark)
    if fade is not None:
        d = d * fade
    return np.clip(np.maximum(d, floor) * ceil, 0, 1)


def make_ht(cell: float, shape: str = "round", angle: float = 45.0, seed: int = 7, **kw) -> Halftone:
    return Halftone(cell=cell, angle=angle, shape=shape, seed=seed, **kw)  # type: ignore[arg-type]


def avif_bytes(im: Image.Image, quality: int = 80) -> bytes:
    b = io.BytesIO()
    im.save(b, "AVIF", quality=quality, subsampling="4:4:4", speed=6)
    return b.getvalue()


def webp_lossless_bytes(im: Image.Image) -> bytes:
    b = io.BytesIO()
    im.save(b, "WEBP", lossless=True, quality=100, method=6)
    return b.getvalue()


def webp_fallback_bytes(im: Image.Image) -> bytes:
    """Fallback para navegadores sem AVIF (Safari < 16.4, etc.): WebP com perdas q75, só nas larguras pequenas."""
    b = io.BytesIO()
    im.save(b, "WEBP", quality=75, method=6, sharp_yuv=True)
    return b.getvalue()


def png_bytes(im: Image.Image, max_kb: int | None = None) -> bytes:
    """PNG otimizado; se passar de `max_kb`, paleta adaptativa (256, 192, 128, 96 cores) sem dither: os pontos já são o dither."""
    b = io.BytesIO()
    im.convert("RGB").save(b, "PNG", optimize=True)
    data = b.getvalue()
    for n in (256, 192, 128, 96, 64):
        if not max_kb or len(data) <= max_kb * 1024:
            break
        q = im.convert("RGB").quantize(n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        b = io.BytesIO()
        q.save(b, "PNG", optimize=True)
        data = b.getvalue()
    return data


class Out:
    """Escreve ficheiros e regista (largura, altura, bytes) para o manifesto e as verificações."""

    def __init__(self, root: Path):
        self.root = root
        self.items: dict[str, dict[str, int]] = {}

    def put(self, rel: str, data: bytes, size: tuple[int, int] | None = None, max_kb: int | None = None) -> None:
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        if max_kb is not None and len(data) > max_kb * 1024:
            raise SystemExit(f"{rel}: {len(data) / 1024:.0f} KB acima do limite de {max_kb} KB")
        if size:
            with Image.open(p) as im:
                assert im.size == size, f"{rel}: {im.size} != {size}"
        self.items[rel] = {"bytes": len(data), **({"w": size[0], "h": size[1]} if size else {})}


# ------------------------------------------------------------------------------------------- texto em curvas
class Shaper:
    """Desenha texto em curvas a partir de uma fonte variável (instanciada uma vez)."""

    def __init__(self, font_file: Path, loc: dict[str, float]):
        f = instancer.instantiateVariableFont(TTFont(font_file), loc)
        f.flavor = None
        buf = io.BytesIO()
        f.save(buf)
        self.inst = f
        self.face = hb.Face(hb.Blob(buf.getvalue()))
        self.font = hb.Font(self.face)
        self.gs = f.getGlyphSet()
        self.order = f.getGlyphOrder()
        self.upem = f["head"].unitsPerEm

    def path(self, text: str, tracking_em: float = 0.0) -> tuple[str, float]:
        b = hb.Buffer()
        b.add_str(text)
        b.guess_segment_properties()
        hb.shape(self.font, b, {"kern": True, "liga": True})
        pen = SVGPathPen(self.gs, ntos=lambda v: f"{v:.1f}".rstrip("0").rstrip("."))
        x = 0.0
        for info, pos in zip(b.glyph_infos, b.glyph_positions, strict=True):
            self.gs[self.order[info.codepoint]].draw(TransformPen(pen, (1, 0, 0, -1, x + pos.x_offset, 0)))
            x += pos.x_advance + tracking_em * self.upem
        return pen.getCommands(), x

    def width(self, text: str, size: float, tracking_em: float = 0.0) -> float:
        return self.path(text, tracking_em)[1] * size / self.upem

    def lines(self, text: str, size: float, max_w: float, tracking_em: float = 0.0) -> list[str]:
        out: list[str] = []
        cur = ""
        for word in text.split():
            trial = f"{cur} {word}".strip()
            if cur and self.width(trial, size, tracking_em) > max_w:
                out.append(cur)
                cur = word
            else:
                cur = trial
        out.append(cur)
        return out

    def balanced(self, text: str, size: float, max_w: float, tracking_em: float = 0.0) -> list[str]:
        """Quebra em linhas equilibradas (text-wrap: balance): mesmo nº de linhas que o guloso, largura mínima que o permite."""
        n = len(self.lines(text, size, max_w, tracking_em))
        lo, hi = max_w * 0.4, max_w
        for _ in range(14):
            mid = (lo + hi) / 2
            if len(self.lines(text, size, mid, tracking_em)) <= n:
                hi = mid
            else:
                lo = mid
        return self.lines(text, size, hi, tracking_em)

    def svg(self, lines: list[str], x: float, baseline: float, size: float, lh: float, fill: str, tracking_em: float = 0.0) -> tuple[str, tuple[float, float, float, float]]:
        """Devolve o SVG e a caixa (x0, y0, x1, y1) ocupada."""
        k = size / self.upem
        parts, widest = [], 0.0
        for i, line in enumerate(lines):
            d, adv = self.path(line, tracking_em)
            widest = max(widest, adv * k)
            parts.append(f'<path transform="translate({x:.2f} {baseline + i * lh * size:.2f}) scale({k:.5f})" d="{d}" fill="{fill}"/>')
        box = (x, baseline - size * 0.75, x + widest, baseline + (len(lines) - 1) * lh * size + size * 0.25)
        return "".join(parts), box


_SH: dict[str, Shaper] = {}


def display(weight: int = 500) -> Shaper:
    key = f"nr{weight}"
    if key not in _SH:
        _SH[key] = Shaper(NEWSREADER, {"wght": weight, "opsz": 72})
    return _SH[key]


def text_sans(weight: int = 500) -> Shaper:
    key = f"in{weight}"
    if key not in _SH:
        _SH[key] = Shaper(INTER, {"wght": weight, "opsz": 14})
    return _SH[key]


# --------------------------------------------------------------------------------------------- composição
def data_uri(im: Image.Image) -> str:
    b = io.BytesIO()
    im.convert("RGB").save(b, "PNG")
    return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()


def compose(ctx: Ctx, base: Image.Image, mode: str, left: float, baseline: float, cap_px: float, extra: str = "", scale: int = 1) -> Image.Image:
    """Base dither + lockup (positivo no claro, negativo no escuro) com a tinta do símbolo em `left` e a linha de base
    em `baseline` (px de `scale`=1). Um só SVG: o subpixel fica exato. Devolve a imagem em RGB."""
    w, h = base.size
    k = cap_px / ctx.g.cap
    body = lockup_body(ctx.g, PALETTES["positivo" if mode == "light" else "negativo"])
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
        f'<image width="{w}" height="{h}" xlink:href="{data_uri(base)}"/>'
        f'<g transform="translate({left * scale:.3f} {baseline * scale:.3f}) scale({k * scale:.5f})">{body}</g>{extra}</svg>'
    )
    return Image.open(io.BytesIO(ctx.rsvg(svg, w, h))).convert("RGB")


def ok_contrast(name: str, value: float, minimum: float = 4.5) -> float:
    if value < minimum:
        raise SystemExit(f"{name}: contraste do texto {value:.2f}:1 abaixo de {minimum}:1 (WCAG AA)")
    return round(float(value), 2)


def region_contrast(im: Image.Image, box: tuple[float, float, float, float], text_hex: str) -> float:
    """Contraste WCAG do texto contra a MÉDIA da região da imagem (onde o texto assenta), no pior quartil de luminância
    por blocos de 8 px (os pontos fazem a luminância oscilar, por isso mede-se por blocos e não por píxel)."""
    x0, y0, x1, y1 = (int(v) for v in box)
    a = np.asarray(im.convert("RGB").crop((x0, y0, x1, y1)), np.float32) / 255.0
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    L = 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]
    hh, ww = (L.shape[0] // 8) * 8, (L.shape[1] // 8) * 8
    blocks = L[:hh, :ww].reshape(hh // 8, 8, ww // 8, 8).mean(axis=(1, 3)).ravel()
    t = hex_rgb(text_hex)
    tl = np.array([((v / 255) / 12.92 if v / 255 <= 0.04045 else ((v / 255 + 0.055) / 1.055) ** 2.4) for v in t])
    TL = 0.2126 * tl[0] + 0.7152 * tl[1] + 0.0722 * tl[2]
    dark_text = TL < 0.3
    worst = np.percentile(blocks, 10 if dark_text else 90)  # blocos do fundo mais próximos da cor do texto
    hi, lo = max(worst, TL), min(worst, TL)
    return (hi + 0.05) / (lo + 0.05)


# --------------------------------------------------------------------------------------------- símbolo em pontos
def symbol_field(ctx: Ctx, size: tuple[int, int], center: tuple[float, float], unit: float, mode: str, glow: float = 0.0) -> tuple[np.ndarray, np.ndarray]:
    """Os três fios e o ponto do símbolo como densidade + mapa de cor (cor de cada fio). A geometria é a real
    (renderizada do SVG da marca). `unit` = px por unidade de símbolo; `glow` > 0 acrescenta ondas de pontos à volta dos fios."""
    w, h = size
    pal = ("#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#000000")
    sym = symbol_group(pal, f"translate({center[0]:.2f} {center[1]:.2f}) scale({unit:.5f})")
    png = ctx.rsvg(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{sym}</svg>', w, h)
    a = np.asarray(Image.open(io.BytesIO(png)).convert("RGBA"), np.float32) / 255.0
    alpha = a[..., 3]
    ring_cols = PALETTES["positivo" if mode == "light" else "negativo"][:4]
    cols = np.array([hex_rgb(c) for c in ring_cols], np.float32)  # interior, meio, exterior, ponto
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.hypot(xx - center[0], yy - center[1]) / unit
    radii = np.array([210.0, 300.0, 390.0])
    nearest = np.argmin(np.abs(r[..., None] - radii[None, None, :]), axis=-1)
    ink = cols[nearest]
    ink = np.where((r < 140)[..., None], cols[3], ink)
    d = alpha.copy()
    if glow:
        near_d = np.min(np.abs(r[..., None] - radii[None, None, :]), axis=-1)
        halo = np.exp(-((np.maximum(near_d - 28, 0)) / (glow * 55.0)) ** 2) * 0.42
        ang = np.degrees(np.arctan2(yy - center[1], xx - center[0]))
        gap = np.abs(((ang + 90 + 180) % 360) - 180)
        halo *= 0.35 + 0.65 * smoothstep(8, 40, gap)
        d = np.maximum(d, halo * (r < 520))
    return np.clip(d, 0, 1), ink


# =========================================================================================================
# PAINEL DO ECRÃ DE ENTRADA
# =========================================================================================================
# Painel de entrada (desktop, 3:4, texto em cima): fotografia da Penha em meio-tom. Em telemóvel o ecrã de entrada não tem imagem.
LOGIN_PANEL = ((960, 1280), (1440, 1920))


def build_login(ctx: Ctx, out: Out, photo: Image.Image) -> None:
    for mode in MODES:
        for w, h in LOGIN_PANEL:
            d = photo_field(photo, (w, h), mode, (1.0, 0.60), 1.0, fade=fade_top(h, w, 0.20, 0.52, 0.08))
            im = make_ht(w / 240).render(d, PAL[mode]["ouro"])
            out.put(f"login-painel-{mode}-{w}.avif", avif_bytes(im), (w, h))


def place_login(ctx: Ctx) -> None:
    LANDING.mkdir(parents=True, exist_ok=True)
    out = Out(LANDING)
    build_login(ctx, out, Image.open(PHOTO).convert("RGB"))
    print(f"painel de entrada: {len(out.items)} ficheiros em apps/web/public/landing/")


# =========================================================================================================
# PARTILHA (OG), BANNERS, CAPA
# =========================================================================================================
OG_COPY = {
    # variante: {lang: (título, rótulo)}
    "landing": {
        "pt": ("Recolha de têxteis, desenhada ao menor custo.", "Hack4Guimarães 2035 · Desafio TexVitrus"),
        "en": ("Textile collection, designed at the lowest cost.", "Hack4Guimarães 2035 · TexVitrus Challenge"),
    },
    "entrar": {
        "pt": ("Entra e desenha a rede de recolha de Guimarães.", "novelo.helder.si"),
        "en": ("Sign in and design Guimarães’ collection network.", "novelo.helder.si"),
    },
    "passaporte": {
        "pt": ("O passaporte público do lote: do saco ao fio.", "Passaporte de lote · novelo.helder.si"),
        "en": ("The batch’s public passport: from bag to fibre.", "Batch passport · novelo.helder.si"),
    },
    "relatorio": {
        "pt": ("Relatório RAP: o custo de cada tonelada, com fonte.", "Responsabilidade alargada do produtor"),
        "en": ("EPR report: the cost of every tonne, with its source.", "Extended producer responsibility"),
    },
}
OG_SCENE = {"landing": "photo", "entrar": "fio", "passaporte": "dunas", "relatorio": "campo"}


def og_base(ctx: Ctx, variant: str, size: tuple[int, int], mode: str, photo: Image.Image, cell: float) -> Image.Image:
    w, h = size
    scene = OG_SCENE[variant]
    if scene == "photo":
        d = photo_field(photo, size, mode, (0.5, 0.64), 1.0, fade=fade_left(h, w, 0.44, 0.88, 0.07))
        return make_ht(cell).render(d, PAL[mode]["ouro"])
    if scene == "fio":
        d, ink = symbol_field(ctx, size, (w * 0.80, h * 0.56), h / 640 * 0.95, mode, glow=1.0)
        d = np.clip(np.maximum(d * fade_left(h, w, 0.38, 0.82, 0.07), 0.05), 0, 1)
        return make_ht(cell).render(d, PAL[mode]["ouro"], ink_map=ink)
    if scene == "dunas":
        d = np.clip(dunes_density(h, w), 0, 0.66) * fade_left(h, w, 0.32, 0.80, 0.07)
        return make_ht(cell * 1.5, "cross", 0).render(np.clip(np.maximum(d, 0.05), 0, 1), PAL[mode]["dunas"])
    d = field_density(h, w, corner=(1.02, 0.95)) * fade_left(h, w, 0.34, 0.80, 0.30)
    return make_ht(cell).render(np.clip(d, 0, 1), PAL[mode]["campo"])


def build_og(ctx: Ctx, out: Out) -> dict[str, float]:
    """OG 1200x630 (+ @2x) por variante e idioma. A zona de texto fica a ~7 % de densidade (AA sobre a imagem).
    Texto importante dentro da zona segura 1000x500 centrada (x 100..1100, y 65..565): recortes de WhatsApp, LinkedIn, X..."""
    photo = Image.open(PHOTO).convert("RGB")
    nr, inter = display(500), text_sans(500)
    contrasts: dict[str, float] = {}
    for variant, langs in OG_COPY.items():
        for lang, (title, label) in langs.items():
            for scale in ((1, 2) if variant == "landing" else (1,)):
                W, H = 1200 * scale, 630 * scale
                base = og_base(ctx, variant, (W, H), "light", photo, 4.0 * scale)
                size_px, tr = 60, -0.018
                lines = nr.balanced(title, size_px, 600, tr)
                svg_title, box = nr.svg(lines, 100 * scale, 292 * scale, size_px * scale, 1.1, "#14211D", tr)
                svg_label, lbox = inter.svg([label], 100 * scale, 548 * scale, 21 * scale, 1.0, PEDRA_ESCURA, 0.01)
                im = compose(ctx, base, "light", 100, 168, 52, svg_title + svg_label, scale)
                c_t, c_l = region_contrast(base, box, "#14211D"), region_contrast(base, lbox, PEDRA_ESCURA)
                contrasts[f"og-{variant}-{lang}"] = ok_contrast(f"og-{variant}-{lang} (título {c_t:.2f}, rótulo {c_l:.2f})", min(c_t, c_l))
                name = f"novelo-partilha-{variant}-{lang}" + ("@2x" if scale == 2 else "")
                data = png_bytes(im, 285 * scale)
                out.put(f"og/{name}.png", data, (W, H), max_kb=292 * scale)
    return contrasts


def build_banners(ctx: Ctx, out: Out) -> dict[str, float]:
    """Banner 2400x450 (README/docs), capa 1920x1080 e variantes escuras. A faixa à esquerda leva lockup + tagline."""
    photo = Image.open(PHOTO).convert("RGB")
    contrasts: dict[str, float] = {}
    inter = text_sans(400)
    tagline = "Recolha seletiva de têxteis, desenhada ao menor custo."
    for mode in MODES:
        suffix = "" if mode == "light" else "-escuro"
        txt = PEDRA_ESCURA if mode == "light" else "#B6C4BE"
        # banner 2400x450: faixa do horizonte
        W, H = 2400, 450
        d = photo_field(photo, (W, H), mode, (0.5, 0.58), 1.5, fade=fade_left(H, W, 0.24, 0.70, 0.07, skew=0.0))
        base = make_ht(5.0).render(d, PAL[mode]["ouro"])
        k = 761 / inter.width(tagline, 1000)
        svg_tag, tbox = inter.svg([tagline], 133, 307.5, 1000 * k * 1.0, 1.0, txt)
        im = compose(ctx, base, mode, 133, 225, 94, svg_tag)
        contrasts[f"banner{suffix}"] = ok_contrast(f"banner{suffix}", region_contrast(base, tbox, txt))
        out.put(f"banner/novelo-banner-2400x450{suffix}.png", png_bytes(im, 300), (W, H), max_kb=300)
        # capa 1920x1080
        W, H = 1920, 1080
        d = photo_field(photo, (W, H), mode, (0.5, 0.60), 1.0, fade=fade_left(H, W, 0.30, 0.80, 0.06, skew=0.10))
        base = make_ht(6.0).render(d, PAL[mode]["ouro"])
        svg_tag, tbox = inter.svg([tagline], 128, 600, 30, 1.0, txt)
        im = compose(ctx, base, mode, 128, 476, 125, svg_tag)
        contrasts[f"capa{suffix}"] = ok_contrast(f"capa{suffix}", region_contrast(base, tbox, txt))
        out.put(f"banner/novelo-capa-1920x1080{suffix}.png", png_bytes(im, 600), (W, H), max_kb=600)
    return contrasts


def write_manifest(out: Out, path: Path, extra: dict | None = None) -> None:
    data = {"generated_by": "scripts/brand/dither_assets.py", "files": dict(sorted(out.items.items())), **(extra or {})}
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


# =========================================================================================================
# Colocação final dos ficheiros
# =========================================================================================================
def _copy(out: Out, rel: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes((out.root / rel).read_bytes())


def place_social(ctx: Ctx) -> dict[str, float]:
    """OG por página e idioma, banners e capa nos destinos finais (brand/redes, apps/web/public, docs/img)."""
    tmp = Out(HERE / "cache/social")
    contrasts = build_og(ctx, tmp) | build_banners(ctx, tmp)
    final = Out(ROOT)
    for rel in sorted(tmp.items):
        name = Path(rel).name
        data = (tmp.root / rel).read_bytes()
        if rel.startswith("og/"):
            final.put(f"apps/web/public/og/{name}", data)
            final.put(f"brand/redes/{name}", data)
        else:
            final.put(f"brand/redes/{name}", data)
    # compatibilidade com o que já existe: og-image.png (landing pt) e o nome histórico da partilha
    og = (tmp.root / "og/novelo-partilha-landing-pt.png").read_bytes()
    final.put("apps/web/public/og-image.png", og, (1200, 630), max_kb=292)
    final.put("brand/redes/novelo-partilha-1200x630.png", og, (1200, 630), max_kb=292)
    final.put("apps/web/public/og-image@2x.png", (tmp.root / "og/novelo-partilha-landing-pt@2x.png").read_bytes(), (2400, 1260), max_kb=600)
    banner = (tmp.root / "banner/novelo-banner-2400x450.png").read_bytes()
    for n in ("banner-proposta.png", "banner-projeto.png"):
        final.put(f"docs/img/{n}", banner, (2400, 450), max_kb=300)
    final.put("docs/img/banner-escuro.png", (tmp.root / "banner/novelo-banner-2400x450-escuro.png").read_bytes(), (2400, 450), max_kb=320)
    return contrasts
