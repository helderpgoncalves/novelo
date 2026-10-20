#!/usr/bin/env python3
"""Fotografias de Guimarães da landing, em meio-tom Novelo: hero (Penha), fundos de secção e Open Graph opcional.

Uso: `just brand-landing` (corre-se também em `just brand`). Determinístico, sem rede, sem sementes aleatórias.
Saída: apps/web/public/landing/ (AVIF + WebP, nomes com hash do conteúdo), apps/web/src/features/landing/landing-assets.generated.{ts,css}
e o manifest.json (com o campo `preload`, que a prerender transforma em `<link rel="preload" as="image">`).

Uma só linguagem para toda a série: cada fotografia (scripts/brand/base/*.jpg, créditos em apps/web/public/landing/CREDITS.md) passa
pelo mesmo motor (`dither.lattice_halftone`): meio-tom redondo a 45º, duotone ouro -> floresta -> tinta (claro) ou fio -> areia (escuro).

Decisões (ver docs/marca/linguagem-dither.md):
- O meio-tom é gerado ao tamanho final de cada ficheiro, a partir da fotografia (nunca se reduz uma imagem já em pontos). Os centros dos
  pontos caem em coordenadas inteiras: passo `a` px, célula a·sqrt(2). A razão largura/passo é a mesma em todas as larguras de uma
  família (480 no hero largo, 272 no alto), por isso cada ficheiro é o mesmo desenho em escala inteira: sem moiré entre larguras.
- Curva tonal: níveis por percentis, gama (1,4 claro / 1,35 escuro) e teto 0,95 de cobertura para as sombras não entupirem; chão de 5 %
  para as altas luzes manterem um ponto mínimo em vez de desaparecerem.
- Formato: AVIF (4:4:4 ou 4:2:0, o que o teste de `CHROMA` decidir); WebP com perdas só como alternativa para navegadores sem AVIF.
- Versão escura: densidade invertida (luminoso = denso) sobre o fundo Tinta, não um filtro sobre a clara.
- Verificações no próprio script: dimensões, orçamento de peso por ficheiro e contraste AA do texto sobre a zona do título.
"""

from __future__ import annotations

import hashlib
import io
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))

from dither import (  # noqa: E402
    AREIA,
    FIO_ESCURO,
    FLORESTA,
    FUNDO_ESCURO,
    LINHO,
    TINTA,
    Palette,
    box_mean,
    lattice_halftone,
    smoothstep,
)

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "scripts/brand/base"
LANDING = ROOT / "apps/web/public/landing"
GEN_DIR = ROOT / "apps/web/src/features/landing"

# ------------------------------------------------------------------------------------------------ parâmetros
# Rampas: claro = pontos escuros sobre Linho; escuro = pontos luminosos sobre o fundo escuro.
PALETTES = {
    "light": Palette(LINHO, [(0, AREIA), (0.42, (0xB4, 0x93, 0x55)), (0.70, FLORESTA), (1, TINTA)]),
    "dark": Palette(
        FUNDO_ESCURO,
        [(0, FIO_ESCURO), (0.28, (0x4F, 0x7A, 0x66)), (0.52, (0xA0, 0x8B, 0x5C)), (0.80, AREIA), (1, (0xE3, 0xC9, 0x8F))],
    ),
}
# Fundos de secção: papel branco (claro, multiply) ou preto (escuro, screen), para só ficarem os pontos.
BG_PALETTES = {
    "light": Palette((255, 255, 255), PALETTES["light"].ramp),
    "dark": Palette((0, 0, 0), PALETTES["dark"].ramp),
}
TONE = {  # gama da densidade, percentis de níveis, cobertura mínima e máxima
    "light": {"gamma": 1.4, "lo": 2, "hi": 98, "floor": 0.05, "ceil": 0.95},
    "dark": {"gamma": 1.35, "lo": 2, "hi": 98, "floor": 0.05, "ceil": 0.95},
}
SOFTNESS = 1.0  # largura do anti-aliasing do ponto, em px
CHROMA = "4:4:4"  # "4:2:0" se a comparação visual o permitir (ver docs/marca/linguagem-dither.md)
Q_MIN = 34  # a qualidade desce em passos de 2 até caber no orçamento; abaixo disto o ponto perde forma
WEBP_Q = 40

# Hero: (largura, qualidade inicial, orçamento KB). Largura/passo constante por família.
HERO = {
    "source": "penha-fonte.jpg",  # 2400x1600, RaquelRosa7, CC BY-SA 4.0
    "wide": {  # 16:10, texto à esquerda sobre o céu
        "ratio": 480,
        "aspect": (16, 10),
        "crop": (0, 62, 2400, 1500),  # x, y, w, h na fonte
        "sizes": [(960, 60, 120), (1440, 60, 180), (1920, 60, 250), (2400, 60, 450)],
    },
    "tall": {  # 4:5, o campanário em foco por cima do texto
        "ratio": 272,
        "aspect": (4, 5),
        "crop": (1480, 590, 800, 1000),
        "sizes": [(544, 60, 120), (816, 60, 120), (1088, 60, 180), (1360, 60, 250)],
    },
    # x0, x1, chão, inclinação: reduz a densidade na zona do texto do hero largo (no escuro, quanto menos pontos luminosos, mais escuro)
    "fade_left": {"light": (0.10, 0.62, 0.10, 0.25), "dark": (0.18, 0.68, 0.05, 0.25)},
    "text_zone": (0.05, 0.10, 0.42, 0.42),  # onde se mede o contraste do título no hero largo
}
WIDE_MEDIA = "(min-width: 640px) and (min-aspect-ratio: 6/5)"
TALL_MEDIA_PARTS = ["(max-width: 639px)", "(max-aspect-ratio: 119/100)"]
WIDE_SIZES = "max(100vw, min(160vh, 1536px))"
TALL_SIZES = "100vw"

# Fundos de secção: ficheiro em base/, recorte 3:2 (x, y, w, h) na fonte e razão largura/passo (largura dividida por 240 = passo em px).
BG_SIZES = [(960, 56), (1440, 46)]  # (largura, qualidade inicial); proporção 3:2
BG_BUDGET_KB = 60
BG_Q_MIN = 26  # os fundos são decorativos e esbatidos por máscara: aguentam menos qualidade que o hero; sem WebP (sem fundo em navegadores sem AVIF)
BACKGROUNDS: dict[str, dict] = {
    # Paço dos Duques de Bragança e Castelo: faixa entre secções
    "paco": {"file": "paco-fonte.jpg", "crop": (0, 150, 2400, 1600), "ratio": 240},
    # antiga fábrica têxtil na Rua da Liberdade: cartão do problema e do mini-simulador
    "fabrica": {"file": "fabrica-fonte.jpg", "crop": (0, 300, 2400, 1600), "ratio": 240},
    # zona dos Couros (curtumes): cartão do mapa
    "couros": {"file": "couros-fonte.jpg", "crop": (0, 200, 2400, 1600), "ratio": 240},
    # Plataforma das Artes: CTA final
    "plataforma": {"file": "plataforma-fonte.jpg", "crop": (0, 0, 2175, 1450), "ratio": 240},
}

INK_TEXT = (0x14, 0x21, 0x1D)
LINHO_TEXT = (0xF4, 0xF1, 0xEA)


# ------------------------------------------------------------------------------------------------ utilitários
def avif_bytes(im: Image.Image, q: int) -> bytes:
    b = io.BytesIO()
    im.save(b, "AVIF", quality=q, subsampling=CHROMA, speed=2)
    return b.getvalue()


def webp_bytes(im: Image.Image, q: int = WEBP_Q) -> bytes:
    b = io.BytesIO()
    im.save(b, "WEBP", quality=q, method=6, sharp_yuv=True)
    return b.getvalue()


def lum(rgb: np.ndarray) -> np.ndarray:
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return c[..., 0] * 0.2126 + c[..., 1] * 0.7152 + c[..., 2] * 0.0722


def contrast(l1: float, l2: float) -> float:
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def hex_of(rgb: np.ndarray) -> str:
    r, g, b = (int(round(float(v))) for v in rgb)
    return f"#{r:02X}{g:02X}{b:02X}"


class Writer:
    """Escreve ficheiros com hash do conteúdo no nome, valida o orçamento e regista dimensões e bytes."""

    def __init__(self) -> None:
        self.files: dict[str, dict[str, int]] = {}

    def put(self, stem: str, ext: str, data: bytes, size: tuple[int, int], max_kb: int | None = None) -> str:
        name = f"{stem}.{hashlib.sha1(data).hexdigest()[:8]}.{ext}"
        if max_kb is not None and len(data) > max_kb * 1024:
            raise SystemExit(f"{name}: {len(data) / 1024:.0f} KB acima do orçamento de {max_kb} KB")
        (LANDING / name).write_bytes(data)
        with Image.open(LANDING / name) as im:
            assert im.size == size, f"{name}: {im.size} != {size}"
        self.files[name] = {"bytes": len(data), "w": size[0], "h": size[1]}
        return name

    def put_fit(
        self, stem: str, im: Image.Image, q: int, budget_kb: int, q_min: int = Q_MIN, webp: bool = True
    ) -> tuple[str, str | None]:
        """AVIF dentro do orçamento (baixa a qualidade até caber) e, se `webp`, a alternativa WebP para navegadores sem AVIF."""
        qq, data = q, avif_bytes(im, q)
        while len(data) > budget_kb * 1024 and qq > q_min:
            qq -= 2
            data = avif_bytes(im, qq)
        a = self.put(stem, "avif", data, im.size, budget_kb)
        f = self.put(stem, "webp", webp_bytes(im), im.size) if webp else None
        extra = f" (webp {self.files[f]['bytes'] / 1024:.0f} KB)" if f else ""
        print(f"  {a}: q{qq} {len(data) / 1024:.0f} KB{extra}")
        return a, f


# ------------------------------------------------------------------------------------------------ densidade
def density(photo: Image.Image, size: tuple[int, int], tone: str, fade: np.ndarray | None = None) -> np.ndarray:
    """Fotografia (já recortada) -> densidade 0..1 ao tamanho final. Claro: escuro = denso. Escuro: luminoso = denso."""
    t = TONE[tone]
    g = photo.convert("L").resize(size, Image.Resampling.LANCZOS)
    a = np.asarray(g, np.float32) / 255.0
    p0, p1 = np.percentile(a, [t["lo"], t["hi"]])
    a = np.clip((a - p0) / (p1 - p0 + 1e-6), 0, 1)
    d = (a if tone == "dark" else 1.0 - a) ** t["gamma"]
    if fade is not None:
        d = d * fade
    return np.clip(np.maximum(d, t["floor"]) * t["ceil"], 0, 1)


def fade_left(h: int, w: int, x0: float, x1: float, floor: float, skew: float) -> np.ndarray:
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    return floor + (1 - floor) * smoothstep(x0, x1, xx / w + skew * yy / h)


def crop(photo: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    x, y, w, h = box
    return photo.crop((x, y, x + w, y + h))


def text_zone_contrast(im: Image.Image, box: tuple[float, float, float, float], text: tuple[int, int, int], dark: bool) -> float:
    """Contraste do texto contra blocos de 8 px da zona (percentil 90 da luminância no escuro, 10 no claro)."""
    w, h = im.size
    x0, y0, x1, y1 = int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)
    z = np.asarray(im.crop((x0, y0, x1, y1)), np.float32)
    blk = max(2, int(round(8 * w / 1920)))
    hh, ww = (z.shape[0] // blk) * blk, (z.shape[1] // blk) * blk
    z = z[:hh, :ww].reshape(hh // blk, blk, ww // blk, blk, 3).mean((1, 3))
    bg = float(np.percentile(lum(z), 90 if dark else 10))
    return contrast(float(lum(np.array(text, np.float32))), bg)


# ------------------------------------------------------------------------------------------------ hero
def build_hero(wr: Writer) -> dict:
    photo = Image.open(BASE / HERO["source"]).convert("RGB")
    result: dict = {"wide": {}, "tall": {}, "sky": {}, "contrast": {}}
    for tone in ("light", "dark"):
        pal = PALETTES[tone]
        for family in ("wide", "tall"):
            spec = HERO[family]
            src = crop(photo, spec["crop"])
            aw, ah = spec["aspect"]
            avif_list, webp_list = [], []
            for w, q, budget in spec["sizes"]:
                h = round(w * ah / aw)
                step = w // spec["ratio"] if w % spec["ratio"] == 0 else None
                assert step, f"{family} {w}: largura não é múltipla de {spec['ratio']}"
                fade = fade_left(h, w, *HERO["fade_left"][tone]) if family == "wide" else None
                d = density(src, (w, h), tone, fade)
                im = lattice_halftone(d, pal, step, SOFTNESS)
                a, f = wr.put_fit(f"hero-{family}-{tone}-{w}", im, q, budget)
                avif_list.append({"w": w, "h": h, "src": a})
                webp_list.append({"w": w, "h": h, "src": f})
                if family == "wide" and w == 1440:
                    text = LINHO_TEXT if tone == "dark" else INK_TEXT
                    result["contrast"][tone] = round(text_zone_contrast(im, HERO["text_zone"], text, tone == "dark"), 2)
                    sky = np.asarray(im.crop((0, 0, w // 2, int(h * 0.35))), np.float32).reshape(-1, 3).mean(0)
                    result["sky"][tone] = hex_of(sky)
            result[family].setdefault(tone, {})["avif"] = avif_list
            result[family][tone]["webp"] = webp_list
    for tone, v in result["contrast"].items():
        if v < 4.5:
            raise SystemExit(f"contraste do título {tone} = {v} < 4,5")
    return result


# ------------------------------------------------------------------------------------------------ fundos de secção
def build_backgrounds(wr: Writer) -> dict:
    result: dict = {}
    for key, cfg in BACKGROUNDS.items():
        photo = crop(Image.open(BASE / cfg["file"]).convert("RGB"), cfg["crop"])
        for tone in ("light", "dark"):
            lst = []
            for w, q in BG_SIZES:
                h = w * 2 // 3
                step = w // cfg["ratio"]
                assert w % cfg["ratio"] == 0
                im = lattice_halftone(density(photo, (w, h), tone), BG_PALETTES[tone], step, SOFTNESS)
                a, _ = wr.put_fit(f"fundo-{key}-{tone}-{w}", im, q, BG_BUDGET_KB, BG_Q_MIN, webp=False)
                lst.append({"w": w, "avif": a})
            result.setdefault(key, {})[tone] = lst
    return result


# ------------------------------------------------------------------------------------------------ saídas geradas
def preload_links(hero: dict) -> list[dict]:
    links = []
    for tone in ("light", "dark"):
        scheme = f"(prefers-color-scheme: {tone})"
        for family, media_parts, sizes in (("wide", [WIDE_MEDIA], WIDE_SIZES), ("tall", TALL_MEDIA_PARTS, TALL_SIZES)):
            media = ", ".join(f"{m} and {scheme}" for m in media_parts)
            items = hero[family][tone]["avif"]
            links.append(
                {
                    "rel": "preload",
                    "as": "image",
                    "type": "image/avif",
                    "media": media,
                    "imagesrcset": ", ".join(f"/landing/{i['src']} {i['w']}w" for i in items),
                    "imagesizes": sizes,
                    "fetchpriority": "high",
                }
            )
    return links


def write_ts(hero: dict) -> None:
    def srcs(lst: list[dict]) -> str:
        return "[" + ", ".join(f"{{ w: {i['w']}, src: '{i['src']}' }}" for i in lst) + "]"

    parts = [
        "// GERADO por scripts/brand/hero_derivatives.py (`just brand-landing`). Não editar à mão.",
        "// Nomes com hash do conteúdo: o ficheiro nunca muda sem o nome mudar (cache imutável).",
        "",
        "export type HeroTone = 'light' | 'dark';",
        "export type HeroSource = { readonly w: number; readonly src: string };",
        "export type HeroFamily = Record<",
        "  HeroTone,",
        "  { avif: readonly HeroSource[]; webp: readonly HeroSource[] }",
        ">;",
        "",
        f"export const HERO_WIDE_MEDIA = '{WIDE_MEDIA}';",
        f"export const HERO_WIDE_SIZES = '{WIDE_SIZES}';",
        f"export const HERO_TALL_SIZES = '{TALL_SIZES}';",
        "/** Cor média do céu: fundo sólido do hero enquanto a imagem carrega. */",
        f"export const HERO_SKY: Record<HeroTone, string> = {{ light: '{hero['sky']['light']}', dark: '{hero['sky']['dark']}' }};",
        "/** Dimensões intrínsecas (largura, altura) da variante mais pequena de cada família. */",
        f"export const HERO_INTRINSIC = {{ wide: [{HERO['wide']['sizes'][0][0]}, {HERO['wide']['sizes'][0][0] * 10 // 16}], tall: [{HERO['tall']['sizes'][0][0]}, {HERO['tall']['sizes'][0][0] * 5 // 4}] }} as const;",
        "",
    ]
    for family in ("wide", "tall"):
        parts.append(f"export const HERO_{family.upper()}: HeroFamily = {{")
        for tone in ("light", "dark"):
            parts.append(f"  {tone}: {{")
            for fmt in ("avif", "webp"):
                parts.append(f"    {fmt}: {srcs(hero[family][tone][fmt])},")
            parts.append("  },")
        parts.append("};")
        parts.append("")
    (GEN_DIR / "landing-assets.generated.ts").write_text("\n".join(parts), encoding="utf-8")


def write_css(bgs: dict) -> None:
    lines = [
        "/* GERADO por scripts/brand/hero_derivatives.py (`just brand-landing`). Não editar à mão. */",
        "/* Fundos de secção (só AVIF, decorativos): 960 px até 768 px de largura, 1440 px acima. Claro = multiply; escuro = screen (ver .photo-bg em styles.css). */",
    ]
    for key, tones in bgs.items():
        for tone in ("light", "dark"):
            small, large = tones[tone][0]["avif"], tones[tone][1]["avif"]
            sel = f".photo-{key}" if tone == "light" else f".dark .photo-{key}, .photo-dark.photo-{key}"
            sel = ", ".join(f"{s.strip()}::before" for s in sel.split(","))
            lines += [
                f"{sel} {{",
                f"  background-image: url('/landing/{small}');",
                "}",
                "@media (min-width: 769px) {",
                f"  {sel} {{",
                f"    background-image: url('/landing/{large}');",
                "  }",
                "}",
            ]
    (GEN_DIR / "landing-assets.generated.css").write_text("\n".join(lines) + "\n", encoding="utf-8")
    biome = ROOT / "apps/web/node_modules/.bin/biome"
    if biome.exists():  # formata como o resto do web (melhor esforço)
        subprocess.run(
            [str(biome), "format", "--write", str(GEN_DIR / "landing-assets.generated.css"), str(GEN_DIR / "landing-assets.generated.ts")],
            cwd=ROOT / "apps/web",
            capture_output=True,
            check=False,
        )


def kept_files() -> dict[str, dict[str, int]]:
    """Ficheiros que este script não gera mas que vivem na pasta (painel do ecrã de entrada, `login_panel.py`): só no manifesto."""
    out = {}
    for f in sorted(LANDING.glob("login-*")):
        with Image.open(f) as im:
            out[f.name] = {"bytes": f.stat().st_size, "w": im.size[0], "h": im.size[1]}
    return out


def main() -> None:
    LANDING.mkdir(parents=True, exist_ok=True)
    for old in LANDING.iterdir():  # sem órfãos: a pasta só tem o que este script gera, o painel de entrada e os créditos
        if old.is_file() and old.name not in {"CREDITS.md", "manifest.json"} and not old.name.startswith("login-"):
            old.unlink()
    wr = Writer()
    print("hero:")
    hero = build_hero(wr)
    print("fundos:")
    bgs = build_backgrounds(wr)
    write_ts(hero)
    write_css(bgs)
    manifest = {
        "generated_by": "scripts/brand/hero_derivatives.py",
        "files": dict(sorted({**kept_files(), **wr.files}.items())),
        "preload": preload_links(hero),
        "sky": hero["sky"],
        "contrast": hero["contrast"],
    }
    (LANDING / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    total = sum(v["bytes"] for v in wr.files.values())
    print(f"{len(wr.files)} ficheiros, {total / 1024:.0f} KB; contraste do título {hero['contrast']}")


if __name__ == "__main__":
    sys.exit(main())
