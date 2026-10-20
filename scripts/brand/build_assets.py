#!/usr/bin/env python3
"""Regenera TODOS os assets da marca a partir de uma única fonte de verdade (geometry.py).

Uso: `just brand` (ou `uv run --no-project --with fonttools --with brotli --with uharfbuzz --with numpy
--with pillow python scripts/brand/build_assets.py`). Precisa de `rsvg-convert` (brew install librsvg).
Idempotente: corre duas vezes e o resultado é igual.
"""

from __future__ import annotations

import base64
import io
import json
import re
import shutil
import struct
import subprocess
from pathlib import Path

import numpy as np
import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from geometry import (
    FLORESTA,
    LINHO,
    PALETTES,
    ROOT,
    STROKE,
    SYM_CY,
    SYM_H,
    SYM_HALF_W,
    SYM_TOP,
    SYM_W,
    TINTA,
    Geometry,
    build,
    lockup_body,
    lockup_svg,
    n,
    n5,
    stacked_svg,
    svg,
    symbol_group,
    symbol_svg,
)
from PIL import Image

BRAND = ROOT / "brand"
PUBLIC = ROOT / "apps/web/public"
WEB = ROOT / "apps/web"
BASE = Path(__file__).parent / "base"
TONES = tuple(PALETTES)  # positivo, negativo, mono-escuro, mono-claro
HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")


# --- utilitários ---------------------------------------------------------------------------------
def write(path: Path, data: str | bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, str):
        path.write_text(data, encoding="utf-8")
    else:
        path.write_bytes(data)


def rsvg(svg_text: str, width: int | None = None, height: int | None = None) -> bytes:
    cmd = ["rsvg-convert", "-f", "png"]
    if width:
        cmd += ["-w", str(width)]
    if height:
        cmd += ["-h", str(height)]
    return subprocess.run(cmd, input=svg_text.encode(), capture_output=True, check=True).stdout


def img(png: bytes) -> Image.Image:
    return Image.open(io.BytesIO(png)).convert("RGBA")


def lum(hexc: str) -> float:
    def ch(v: int) -> float:
        c = v / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (int(hexc[i : i + 2], 16) for i in (1, 3, 5))
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def contrast(a: str, b: str) -> float:
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def tile(size: int, bg: str, inner_svg: str, radius: float = 0.0) -> str:
    rect = f'<rect width="{size}" height="{size}" rx="{n(radius)}" fill="{bg}"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">{rect}{inner_svg}</svg>'


def centered_symbol(size: float, radius_frac: float, pal: tuple[str, ...], r_sym: float) -> str:
    """Símbolo com o centro da caixa de tinta no centro do quadrado e raio máximo = radius_frac x lado."""
    sc = radius_frac * size / r_sym
    return symbol_group(pal, f"translate({n(size / 2)} {n(size / 2)}) scale({n5(sc)}) translate(0 {n(-SYM_CY)})")


def symbol_radius() -> float:
    """Distância máxima (unidades de símbolo) do centro da caixa de tinta aos pontos da tinta."""
    px = 2  # px por unidade
    w, h = round(SYM_W * px), round(SYM_H * px)
    a = np.array(img(rsvg(symbol_svg(PALETTES["mono-escuro"]), w, h)))[..., 3] > 127
    ys, xs = np.nonzero(a)
    cx, cy = (w - 1) / 2, (h - 1) / 2
    return float(np.hypot(xs - cx, ys - cy).max() / px)


# --- texto em curvas (tagline do banner) ------------------------------------------------------------
def text_path(font_file: Path, loc: dict[str, float], text: str) -> tuple[str, float]:
    f = TTFont(font_file)
    inst = instancer.instantiateVariableFont(f, loc)
    inst.flavor = None
    buf = io.BytesIO()
    inst.save(buf)
    face = hb.Face(hb.Blob(buf.getvalue()))
    b = hb.Buffer()
    b.add_str(text)
    b.guess_segment_properties()
    hb.shape(hb.Font(face), b, {"kern": True})
    gs, order = inst.getGlyphSet(), inst.getGlyphOrder()
    pen = SVGPathPen(gs, ntos=n)
    x = 0.0
    for info, pos in zip(b.glyph_infos, b.glyph_positions, strict=True):
        tp = TransformPen(pen, (1, 0, 0, -1, x + pos.x_offset, 0))
        gs[order[info.codepoint]].draw(tp)
        x += pos.x_advance
    return pen.getCommands(), x


# --- 1. SVG e PNG de símbolo e logotipos ----------------------------------------------------------
def build_vectors(g: Geometry) -> None:
    for tone, pal in PALETTES.items():
        write(BRAND / f"simbolo/novelo-simbolo-{tone}.svg", symbol_svg(pal))
        write(BRAND / f"logotipo/novelo-logotipo-{tone}.svg", lockup_svg(g, pal))
        write(BRAND / f"logotipo/novelo-logotipo-empilhado-{tone}.svg", stacked_svg(g, pal))
        # PNG: área livre incluída; @1x/@2x/@3x
        sym_pad = SYM_W / 4
        for label, mult in (("@1x", 1), ("@2x", 2), ("@3x", 3)):
            write(
                BRAND / f"simbolo/novelo-simbolo-{tone}{label}.png",
                rsvg(symbol_svg(pal, sym_pad), 96 * mult),
            )
            write(
                BRAND / f"logotipo/novelo-logotipo-{tone}{label}.png",
                rsvg(lockup_svg(g, pal, g.clear), 320 * mult),
            )
            write(
                BRAND / f"logotipo/novelo-logotipo-empilhado-{tone}{label}.png",
                rsvg(stacked_svg(g, pal, g.clear), 200 * mult),
            )
        write(BRAND / f"logotipo/novelo-logotipo-{tone}.png", rsvg(lockup_svg(g, pal, g.clear), 2640))
    # mono-claro/escuro não tinham PNG master antes; ficam todos coerentes


# --- 2. Favicon, ícones PWA, apple-touch ------------------------------------------------------------
TILE_PAL = ("#5A9680", "#7FB39C", "#C4A06A", LINHO, LINHO)  # arcos com >= 3:1 sobre Tinta (ver teste)


def small_symbol(size: float, radius_frac: float, r_sym: float) -> str:
    """Variante ótica para 16 a 32 px: dois fios mais grossos e um ponto cheio (os três fios finos
    fundiam-se em lama a 16 px). Mesmo desenho, menos detalhe."""
    sc = radius_frac * size / r_sym
    arcs = (
        (390.0, "M250.69 -298.76A390 390 0 1 1 -218.09 -323.32", "#C4A06A"),
        (250.0, "M160.45 -191.2A250 250 0 1 1 -139.7 -207.2", "#7FB39C"),
    )
    body = "".join(
        f'<path d="{d}" fill="none" stroke="{c}" stroke-width="88" stroke-linecap="round"/>'
        for _, d, c in arcs
    )
    body += f'<circle r="104" fill="{LINHO}"/>'
    return f'<g transform="translate({n(size / 2)} {n(size / 2)}) scale({n5(sc)}) translate(0 {n(-SYM_CY)})">{body}</g>'


def ico(images: list[tuple[int, bytes]]) -> bytes:
    head = struct.pack("<HHH", 0, 1, len(images))
    offset = 6 + 16 * len(images)
    entries, blobs = b"", b""
    for size, data in images:
        entries += struct.pack("<BBBBHHII", size % 256, size % 256, 0, 0, 1, 32, len(data), offset)
        blobs += data
        offset += len(data)
    return head + entries + blobs


def build_icons(r_sym: float) -> None:
    # favicon.svg: tile Tinta arredondado + variante ótica pequena (fica nítida a 16/32 px)
    fav = tile(64, TINTA, small_symbol(64, 0.43, r_sym), 14)
    write(PUBLIC / "favicon.svg", fav)
    full48 = tile(48, TINTA, centered_symbol(48, 0.41, TILE_PAL, r_sym), 10)
    write(
        PUBLIC / "favicon.ico",
        ico(
            [
                (16, rsvg(tile(64, TINTA, small_symbol(64, 0.45, r_sym), 14), 16)),
                (32, rsvg(tile(64, TINTA, small_symbol(64, 0.43, r_sym), 14), 32)),
                (48, rsvg(full48, 48)),
            ]
        ),
    )
    pal = PALETTES["positivo"]

    def icon(size: int, frac: float, radius: float = 0.0) -> bytes:
        return rsvg(tile(size, LINHO, centered_symbol(size, frac, pal, r_sym), radius), size)

    # 'any': preenche mais; maskable: tinta toda dentro do círculo de zona segura (raio 40 %)
    write(PUBLIC / "icons/icon-192.png", icon(192, 0.44))
    write(PUBLIC / "icons/icon-512.png", icon(512, 0.44))
    write(PUBLIC / "icons/apple-touch-icon.png", icon(180, 0.42))
    write(PUBLIC / "icons/maskable-512.png", icon(512, 0.36))


# --- 3. Avatares -----------------------------------------------------------------------------------
def build_avatars(r_sym: float) -> None:
    for name, bg, pal in (
        ("claro", LINHO, PALETTES["positivo"]),
        ("escuro", TINTA, PALETTES["negativo"]),
    ):
        for size in (256, 512, 1024):
            body = centered_symbol(size, 0.30, pal, r_sym)
            write(BRAND / f"avatar/novelo-avatar-{name}-{size}.png", rsvg(tile(size, bg, body), size))
            clip = (
                f'<clipPath id="c"><circle cx="{size / 2}" cy="{size / 2}" r="{size / 2}"/></clipPath>'
                f'<g clip-path="url(#c)"><rect width="{size}" height="{size}" fill="{bg}"/>{body}</g>'
            )
            circle = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">{clip}</svg>'
            write(BRAND / f"avatar/novelo-avatar-circulo-{name}-{size}.png", rsvg(circle, size))


# --- 4. Imagens de partilha ------------------------------------------------------------------------
def data_uri(path: Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def compose(base: Path, size: tuple[int, int], g: Geometry, left: float, baseline: float, cap_px: float, extra: str = "") -> bytes:
    """Base sem logótipo + lockup negativo/positivo à escala `cap_px` com a tinta do símbolo em `left`
    e a linha de base em `baseline` (px). Tudo num único SVG para o subpixel ficar exato."""
    k = cap_px / g.cap
    body = lockup_body(g, PALETTES["positivo"])
    w, h = size
    return rsvg(
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
        f'<image width="{w}" height="{h}" xlink:href="{data_uri(base)}"/>'
        f'<g transform="translate({n(left)} {n(baseline)}) scale({n5(k)})">{body}</g>{extra}</svg>',
        w,
        h,
    )


def build_social(g: Geometry) -> None:
    og = compose(BASE / "partilha-base.png", (1200, 630), g, 80, 275, 83)
    write(BRAND / "redes/novelo-partilha-1200x630.png", og)
    write(PUBLIC / "og-image.png", og)
    write(BRAND / "redes/novelo-capa-1920x1080.png", compose(BASE / "capa-base.png", (1920, 1080), g, 128, 476, 125))
    # banner: o tagline é redesenhado em curvas (Inter 400) alinhado à tinta do símbolo
    d, width = text_path(BRAND / "fontes/inter/inter-latin-standard-normal.woff2", {"wght": 400, "opsz": 14}, "Recolha seletiva de têxteis, desenhada ao menor custo.")
    k = 761 / width
    tagline = f'<path transform="translate(133 307.5) scale({n5(k)})" d="{d}" fill="#5E6B66"/>'
    write(BRAND / "redes/novelo-banner-2400x450.png", compose(BASE / "banner-base.png", (2400, 450), g, 133, 225, 94, tagline))


# --- 5. Email ---------------------------------------------------------------------------------------
def build_email(g: Geometry) -> None:
    # 264 px de largura = @2x; mostrado a 120 px (LOGO_WIDTH_PX em auth/email_layout.py).
    # O cabeçalho é claro (positivo); o negativo só entra no modo escuro dos clientes de email.
    write(PUBLIC / "email/novelo-logotipo.png", rsvg(lockup_svg(g, PALETTES["positivo"]), 264))
    write(PUBLIC / "email/novelo-logotipo-negativo.png", rsvg(lockup_svg(g, PALETTES["negativo"]), 264))


# --- 6. Código gerado para o web -------------------------------------------------------------------
def build_ts(g: Geometry) -> None:
    sym_ty = -g.cap / 2 - SYM_CY * g.sym_scale
    sym_tx = SYM_HALF_W * g.sym_scale
    st_bottom = -(g.ascender + g.st_gap)
    st_ty = st_bottom - g.st_sym_h / 2 - SYM_CY * g.st_sym_scale
    vb = lambda *v: " ".join(n(x) for x in v)  # noqa: E731
    out = f"""// GERADO por scripts/brand/build_assets.py (`just brand`). Não editar à mão.
// Geometria única do logótipo: ver docs/marca/guia-de-marca.md.

export const SYMBOL = {{
  viewBox: '{vb(-SYM_HALF_W, SYM_TOP, SYM_W, SYM_H)}',
  strokeWidth: {n(STROKE)},
  arcs: [
    'M134.99 -160.87A210 210 0 1 1 -117.43 -174.10',
    'M192.84 -229.81A300 300 0 1 1 -167.76 -248.71',
    'M250.69 -298.76A390 390 0 1 1 -218.09 -323.32',
  ],
  dot: '{__import__("geometry").DOT_PATH}',
}} as const;

export const LOCKUP = {{
  viewBox: '{vb(g.box_x0, g.box_y0, g.box_w, g.box_h)}',
  symbolTransform: 'translate({n(sym_tx)} {n(sym_ty)}) scale({n5(g.sym_scale)})',
  wordmark: '{g.word_path}',
}} as const;

export const STACKED = {{
  viewBox: '{vb(g.st_box_x0, g.st_box_y0, g.st_box_w, g.st_box_h)}',
  symbolTransform: 'translate(0 {n(st_ty)}) scale({n5(g.st_sym_scale)})',
  wordmark: '{g.st_word_path}',
}} as const;

/** Métricas do wordmark (unidades da fonte, 2000/em) e regras de construção. */
export const BRAND_METRICS = {{
  cap: {n(g.cap)},
  xHeight: {n(g.xheight)},
  overshoot: {n(g.overshoot)},
  ascender: {n(g.ascender)},
  unit: {n(g.unit)},
  symbolScale: {n5(g.sym_scale)},
  symbolInkHeight: {n(g.sym_h)},
  symbolInkWidth: {n(g.sym_w)},
  wordmarkInkLeft: {n(g.word_x0)},
}} as const;
"""
    path = WEB / "src/components/brand-geometry.gen.ts"
    write(path, out)
    subprocess.run(["pnpm", "exec", "biome", "format", "--write", str(path)], cwd=WEB, check=True, capture_output=True)


# --- 7. index.html (splash + meta de partilha) e template do RAP ---------------------------------
def splice(path: Path, tag: str, content: str) -> None:
    text = path.read_text(encoding="utf-8")
    pat = re.compile(rf"(<!-- brand:{tag}:start -->|/\* brand:{tag}:start \*/).*?(<!-- brand:{tag}:end -->|/\* brand:{tag}:end \*/)", re.S)
    if not pat.search(text):
        raise SystemExit(f"marcadores brand:{tag} em falta em {path}")
    path.write_text(pat.sub(lambda m: f"{m.group(1)}{content}{m.group(2)}", text), encoding="utf-8")


def build_html(g: Geometry) -> None:
    arcs = "".join(
        f'<path class="a{i + 1} brand-arc brand-arc-{i + 1}" d="{d}" fill="none" stroke-width="{n(STROKE)}" stroke-linecap="round"/>'
        for i, d in enumerate(
            ("M134.99 -160.87A210 210 0 1 1 -117.43 -174.10", "M192.84 -229.81A300 300 0 1 1 -167.76 -248.71", "M250.69 -298.76A390 390 0 1 1 -218.09 -323.32")
        )
    )
    from geometry import DOT_PATH

    # Caixa quadrada centrada no ponto (igual à do BrandSpinner): os arcos rodam sobre o centro sem oscilar.
    vb = "-420 -420 840 840"
    splash = (
        f'<svg class="boot-splash-mark brand-spin" viewBox="{vb}" width="56" height="56" aria-hidden="true">'
        f'{arcs}<path class="dot brand-dot" d="{DOT_PATH}" fill-rule="evenodd"/></svg>'
    )
    css = (
        "\n      .boot-splash-mark .a1 { stroke: #A9C2B7; } .boot-splash-mark .a2 { stroke: #2E6B57; }"
        " .boot-splash-mark .a3 { stroke: #C4A06A; } .boot-splash-mark .dot { fill: #14211D; }"
        "\n      html.dark .boot-splash-mark .a1 { stroke: #3E6658; } html.dark .boot-splash-mark .a2 { stroke: #7FB39C; }"
        " html.dark .boot-splash-mark .dot { fill: #F4F1EA; }\n      "
    )
    index = WEB / "index.html"
    splice(index, "splash", splash)
    splice(index, "splash-css", css)
    # RAP (capa escura): lockup negativo inline, mesma geometria
    rap = ROOT / "apps/api/src/novelo/features/reports/templates/rap.html"
    if rap.exists() and "brand:lockup:start" in rap.read_text(encoding="utf-8"):
        h_mm = 12
        neg = lockup_svg(g, PALETTES["negativo"]).replace(f' width="{n(g.box_w)}" height="{n(g.box_h)}"', f' width="{n(h_mm * g.box_w / g.box_h)}mm" height="{h_mm}mm"').replace("<title>Novelo</title>", "")
        splice(rap, "lockup", neg)


# --- 8. Geometria em JSON e página de verificação visual ---------------------------------------------
def build_preview(g: Geometry, r_sym: float) -> None:
    data = g.as_dict() | {
        "symbol_radius": r_sym,
        "clear_horizontal": g.clear,
        "palettes": PALETTES,
        "contrast": {
            "tinta_sobre_linho": round(contrast(TINTA, LINHO), 2),
            "linho_sobre_tinta": round(contrast(LINHO, TINTA), 2),
            "floresta_sobre_linho": round(contrast(FLORESTA, LINHO), 2),
            "floresta_clara_sobre_tinta": round(contrast("#7FB39C", TINTA), 2),
            "areia_sobre_tinta": round(contrast("#C4A06A", TINTA), 2),
            "favicon_arco_interior_sobre_tinta": round(contrast(TILE_PAL[0], TINTA), 2),
        },
    }
    write(BRAND / "geometria.json", json.dumps(data, indent=2, ensure_ascii=False) + "\n")

    bgs = (("linho", LINHO, "positivo"), ("branco", "#FFFFFF", "positivo"), ("tinta", TINTA, "negativo"))
    sizes = (16, 32, 64, 128, 512)
    rows = []
    for bgname, bg, tone in bgs:
        cells = []
        for s in sizes:
            sym = symbol_svg(PALETTES[tone])
            cells.append(f'<figure><div style="width:{s}px">{sym.replace(" width=", " data-w=").replace(" height=", " data-h=")}</div><figcaption>{s}px</figcaption></figure>')
        lock = []
        for s in (96, 128, 192, 320, 512):
            lock.append(f'<figure><img src="logotipo/novelo-logotipo-{tone}.svg" style="width:{s}px;display:block" alt=""><figcaption>{s}px</figcaption></figure>')
        stack = "".join(
            f'<figure><img src="logotipo/novelo-logotipo-empilhado-{tone}.svg" style="width:{s}px;display:block" alt=""><figcaption>{s}px</figcaption></figure>'
            for s in (64, 128, 256)
        )
        rows.append(
            f'<section style="background:{bg};color:{"#F4F1EA" if tone == "negativo" else TINTA}"><h2>{bgname}</h2>'
            f'<div class="row">{"".join(cells)}</div><div class="row">{"".join(lock)}</div><div class="row">{stack}</div></section>'
        )
    guides = lockup_svg(g, PALETTES["positivo"], g.clear, guides=True).replace(f' width="{n(g.box_w + 2 * g.clear)}" height="{n(g.box_h + 2 * g.clear)}"', "")
    icons = "".join(
        f'<figure><img src="../apps/web/public/icons/{f}" width="{w}"><figcaption>{f}</figcaption></figure>'
        for f, w in (("icon-192.png", 96), ("icon-512.png", 128), ("maskable-512.png", 128), ("apple-touch-icon.png", 90))
    )
    fav = "".join(
        f'<figure><img src="../apps/web/public/favicon.svg" width="{s}" style="image-rendering:auto"><figcaption>{s}px</figcaption></figure>' for s in (16, 32, 48, 96)
    )
    avatars = "".join(
        f'<figure><img src="avatar/novelo-avatar-{k}-256.png" width="96" style="{"border-radius:50%" if "circulo" in k else ""}"><figcaption>{k}</figcaption></figure>'
        for k in ("claro", "escuro", "circulo-claro", "circulo-escuro")
    )
    html = f"""<!doctype html>
<html lang="pt-PT"><meta charset="utf-8"><title>Novelo: verificação do logótipo</title>
<style>
body{{margin:0;font:14px/1.4 Inter,system-ui,sans-serif;background:#888}}
section{{padding:24px 32px}} h1{{margin:0;padding:16px 32px;background:#fff;font-size:16px}} h2{{margin:0 0 12px;font-size:13px;opacity:.6}}
.row{{display:flex;gap:32px;align-items:flex-end;margin:0 0 20px;flex-wrap:wrap}} figure{{margin:0}} figcaption{{font-size:11px;opacity:.6;margin-top:4px}}
.guides svg{{width:900px;display:block;background:#fff}}
</style>
<h1>Verificação visual (gerada por scripts/brand/build_assets.py). Vermelho: linha de base e maiúsculas; azul: altura de x; verde: eixo do símbolo.</h1>
<section style="background:#fff" class="guides"><h2>construção</h2>{guides}</section>
{"".join(rows)}
<section style="background:#F4F1EA"><h2>favicon, ícones PWA, avatares</h2><div class="row">{fav}</div><div class="row">{icons}</div><div class="row">{avatars}</div></section>
<section style="background:#F4F1EA"><h2>imagens de partilha</h2><div class="row"><img src="redes/novelo-partilha-1200x630.png" width="600"><img src="redes/novelo-banner-2400x450.png" width="600"></div></section>
</html>
"""
    write(BRAND / "preview.html", html)
    # a pré-visualização liga ao favicon/ícones do web; copia o favicon.ico para a documentação não é preciso


def main() -> None:
    if not shutil.which("rsvg-convert"):
        raise SystemExit("falta rsvg-convert (brew install librsvg)")
    g = build()
    r_sym = symbol_radius()
    build_vectors(g)
    build_icons(r_sym)
    build_avatars(r_sym)
    build_social(g)
    build_email(g)
    build_ts(g)
    build_html(g)
    build_preview(g, r_sym)
    for pal in PALETTES.values():
        assert all(HEX.match(c) for c in pal)
    print(f"ok: cap={g.cap:g} U={g.unit:.1f} símbolo={g.sym_h:g} gap={g.unit:.1f} raio_simbolo={r_sym:.1f}")


if __name__ == "__main__":
    main()
