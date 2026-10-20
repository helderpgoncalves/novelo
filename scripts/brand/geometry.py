"""Geometria única do logótipo Novelo: o wordmark vem das curvas da fonte real (Newsreader 500, opsz 72)
e o símbolo é construído em unidades de símbolo. Nada aqui depende de fontes instaladas.

Eixo do lockup horizontal (y para baixo, linha de base em y = 0, unidades da fonte, 2000/em):
  - altura do símbolo (tinta) = altura de maiúscula + 2 x overshoot do "o"  (ocupa de -overshoot a cap + overshoot)
  - centro do símbolo = centro da altura de maiúscula (cap / 2)
  - distância símbolo-texto = U = cap / 3 (de tinta do símbolo à tinta do N)
  - caixa (viewBox) simétrica em torno do eixo do símbolo, para centrar em flex sem margens ad hoc.
"""

from __future__ import annotations

import io
import math
from dataclasses import asdict, dataclass
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[2]
FONT_FILE = ROOT / "brand/fontes/newsreader/newsreader-latin-standard-normal.woff2"
WORD = "Novelo"
WGHT, OPSZ = 500, 72
TRACKING_EM = -0.018  # guia de marca: tracking -1,8 %

# --- Símbolo (unidades de símbolo; centro do anel em 0,0; y para baixo) ---------------------------
STROKE = 56.0
ARCS = (  # (raio, caminho) de dentro para fora
    (210.0, "M134.99 -160.87A210 210 0 1 1 -117.43 -174.10"),
    (300.0, "M192.84 -229.81A300 300 0 1 1 -167.76 -248.71"),
    (390.0, "M250.69 -298.76A390 390 0 1 1 -218.09 -323.32"),
)
ARC_END_TOP = (-323.32, -298.76)  # y dos centros das pontas arredondadas do arco exterior
DOT_R, HOLE_R = 92.0, 38.0
DOT_PATH = (
    f"M0 {-DOT_R}A{DOT_R} {DOT_R} 0 1 1 0 {DOT_R}A{DOT_R} {DOT_R} 0 1 1 0 {-DOT_R}Z"
    f"M0 {-HOLE_R}A{HOLE_R} {HOLE_R} 0 1 0 0 {HOLE_R}A{HOLE_R} {HOLE_R} 0 1 0 0 {-HOLE_R}Z"
)
SYM_HALF_W = 390.0 + STROKE / 2  # 418
SYM_TOP = min(ARC_END_TOP) - STROKE / 2  # -351,32
SYM_BOTTOM = 390.0 + STROKE / 2  # 418
SYM_W = 2 * SYM_HALF_W
SYM_H = SYM_BOTTOM - SYM_TOP
SYM_CY = (SYM_TOP + SYM_BOTTOM) / 2  # centro de tinta em y (o ponto fica SYM_CY acima dele)

PALETTES = {
    # nome: (arco interior, arco do meio, arco exterior, ponto, texto)
    "positivo": ("#A9C2B7", "#2E6B57", "#C4A06A", "#14211D", "#14211D"),
    "negativo": ("#3E6658", "#7FB39C", "#C4A06A", "#F4F1EA", "#F4F1EA"),
    "mono-escuro": ("#14211D",) * 5,
    "mono-claro": ("#F4F1EA",) * 5,
}
LINHO, TINTA, FLORESTA = "#F4F1EA", "#14211D", "#2E6B57"


def n(x: float) -> str:
    s = f"{x:.3f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def n5(x: float) -> str:
    s = f"{x:.6f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


@dataclass
class Geometry:
    upm: int
    cap: float
    xheight: float
    overshoot: float
    ascender: float
    unit: float  # U
    clear: float  # área livre horizontal/vertical do lockup
    # lockup horizontal
    sym_scale: float
    sym_w: float
    sym_h: float
    word_dx: float
    word_x0: float
    word_x1: float
    box_x0: float
    box_y0: float
    box_w: float
    box_h: float
    # empilhado
    st_sym_scale: float
    st_sym_h: float
    st_gap: float
    st_box_x0: float
    st_box_y0: float
    st_box_w: float
    st_box_h: float
    word_path: str = ""
    st_word_path: str = ""
    minimum_lockup_px: int = 96
    minimum_stacked_px: int = 64
    minimum_symbol_px: int = 16

    def as_dict(self) -> dict:
        d = asdict(self)
        d.pop("word_path")
        d.pop("st_word_path")
        return d


def _static_font() -> TTFont:
    f = TTFont(FONT_FILE)
    inst = instancer.instantiateVariableFont(f, {"wght": WGHT, "opsz": OPSZ})
    inst.flavor = None
    buf = io.BytesIO()
    inst.save(buf)
    return TTFont(io.BytesIO(buf.getvalue()))


def _shape(font: TTFont) -> tuple[list[str], list[float]]:
    """Glifos e posições x (com kerning GPOS e tracking) do wordmark."""
    buf = io.BytesIO()
    font.save(buf)
    face = hb.Face(hb.Blob(buf.getvalue()))
    hbfont = hb.Font(face)
    b = hb.Buffer()
    b.add_str(WORD)
    b.guess_segment_properties()
    hb.shape(hbfont, b, {"kern": True, "liga": False})
    order = font.getGlyphOrder()
    names, xs, x = [], [], 0.0
    track = TRACKING_EM * font["head"].unitsPerEm
    for info, pos in zip(b.glyph_infos, b.glyph_positions, strict=True):
        names.append(order[info.codepoint])
        xs.append(x + pos.x_offset)
        x += pos.x_advance + track
    return names, xs


def build() -> Geometry:
    font = _static_font()
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()

    def bounds(ch: str) -> tuple[float, float, float, float]:
        bp = BoundsPen(gs)
        gs[cmap[ord(ch)]].draw(bp)
        return bp.bounds

    cap = bounds("N")[3]
    xheight = bounds("v")[3]
    overshoot = -bounds("o")[1]
    ascender = bounds("l")[3]
    n_xmin = bounds("N")[0]

    names, xs = _shape(font)
    # tinta do wordmark em coordenadas de fonte (y para cima)
    x0, x1 = math.inf, -math.inf
    for name, gx in zip(names, xs, strict=True):
        bp = BoundsPen(gs)
        gs[name].draw(bp)
        bx0, _, bx1, _ = bp.bounds
        x0, x1 = min(x0, gx + bx0), max(x1, gx + bx1)
    assert abs(x0 - (xs[0] + n_xmin)) < 1e-6

    unit = cap / 3
    clear = cap / 2
    sym_h = cap + 2 * overshoot
    s = sym_h / SYM_H
    sym_w = SYM_W * s
    gap = unit
    dx = sym_w + gap - x0  # translação do wordmark (x0 = tinta do N)
    margin = max(overshoot, ascender - cap)
    box_h = cap + 2 * margin
    box_y0 = -(cap + margin)
    box_x0, box_w = 0.0, dx + x1  # tinta de x=0 (símbolo) até ao fim do "o"

    def word_path(tx: float, ty: float) -> str:
        pen = SVGPathPen(gs, ntos=n)
        tp = TransformPen(pen, (1, 0, 0, -1, tx, ty))
        for name, gx in zip(names, xs, strict=True):
            gs[name].draw(TransformPen(tp, (1, 0, 0, 1, gx, 0)))
        return pen.getCommands()

    # empilhado: símbolo = 2 x cap de tinta, folga = 2 U até ao topo do "l", centrado no eixo do wordmark
    st_sym_h = 2 * cap
    st_s = st_sym_h / SYM_H
    st_gap = 2 * unit
    wcx = (x0 + x1) / 2
    st_box_w = x1 - x0
    st_box_x0 = -st_box_w / 2
    st_box_y0 = -(ascender + st_gap + st_sym_h)
    st_box_h = -st_box_y0 + overshoot
    return Geometry(
        upm=font["head"].unitsPerEm,
        cap=cap, xheight=xheight, overshoot=overshoot, ascender=ascender,
        unit=unit, clear=clear,
        sym_scale=s, sym_w=sym_w, sym_h=sym_h, word_dx=dx, word_x0=x0 + dx, word_x1=x1 + dx,
        box_x0=box_x0, box_y0=box_y0, box_w=box_w, box_h=box_h,
        st_sym_scale=st_s, st_sym_h=st_sym_h, st_gap=st_gap,
        st_box_x0=st_box_x0, st_box_y0=st_box_y0, st_box_w=st_box_w, st_box_h=st_box_h,
        word_path=word_path(dx, 0),
        st_word_path=word_path(-wcx, 0),
    )  # fmt: skip


# --- Montagem SVG ------------------------------------------------------------------------------
def symbol_group(pal: tuple[str, ...], transform: str = "") -> str:
    inner, mid, outer, dot, _ = pal
    t = f' transform="{transform}"' if transform else ""
    arcs = "".join(
        f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{n(STROKE)}" stroke-linecap="round"/>'
        for (_, d), c in zip(ARCS, (inner, mid, outer), strict=True)
    )
    return f'<g{t}>{arcs}<path d="{DOT_PATH}" fill="{dot}" fill-rule="evenodd"/></g>'


def svg(viewbox: tuple[float, float, float, float], body: str, size: tuple[float, float] | None = None) -> str:
    vb = " ".join(n(v) for v in viewbox)
    wh = f' width="{n(size[0])}" height="{n(size[1])}"' if size else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"{wh}><title>Novelo</title>{body}</svg>'


def symbol_svg(pal: tuple[str, ...], pad: float = 0.0) -> str:
    vb = (-SYM_HALF_W - pad, SYM_TOP - pad, SYM_W + 2 * pad, SYM_H + 2 * pad)
    return svg(vb, symbol_group(pal), (vb[2], vb[3]))


def lockup_body(g: Geometry, pal: tuple[str, ...]) -> str:
    # centro de tinta do símbolo -> (sym_w/2, -cap/2)
    tx = SYM_HALF_W * g.sym_scale
    ty = -g.cap / 2 - SYM_CY * g.sym_scale
    sym = symbol_group(pal, f"translate({n(tx)} {n(ty)}) scale({n5(g.sym_scale)})")
    return f'{sym}<path d="{g.word_path}" fill="{pal[4]}"/>'


def lockup_svg(g: Geometry, pal: tuple[str, ...], pad: float = 0.0, guides: bool = False) -> str:
    vb = (g.box_x0 - pad, g.box_y0 - pad, g.box_w + 2 * pad, g.box_h + 2 * pad)
    body = lockup_body(g, pal)
    if guides:
        lines = [(0, "#d33"), (-g.xheight, "#38c"), (-g.cap, "#d33"), (-g.cap / 2, "#2a2")]
        for y, c in lines:
            body += (
                f'<line x1="{n(vb[0])}" x2="{n(vb[0] + vb[2])}" y1="{n(y)}" y2="{n(y)}" '
                f'stroke="{c}" stroke-width="{n(g.cap / 120)}" opacity=".7"/>'
            )
    return svg(vb, body, (vb[2], vb[3]))


def stacked_body(g: Geometry, pal: tuple[str, ...]) -> str:
    sym_bottom = -(g.ascender + g.st_gap)
    sym_cy = sym_bottom - g.st_sym_h / 2
    ty = sym_cy - SYM_CY * g.st_sym_scale
    sym = symbol_group(pal, f"translate(0 {n(ty)}) scale({n5(g.st_sym_scale)})")
    return f'{sym}<path d="{g.st_word_path}" fill="{pal[4]}"/>'


def stacked_svg(g: Geometry, pal: tuple[str, ...], pad: float = 0.0) -> str:
    vb = (g.st_box_x0 - pad, g.st_box_y0 - pad, g.st_box_w + 2 * pad, g.st_box_h + 2 * pad)
    return svg(vb, stacked_body(g, pal), (vb[2], vb[3]))
