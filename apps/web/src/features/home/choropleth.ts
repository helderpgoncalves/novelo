/**
 * Lógica pura do coropleto da home: classes de uma escala sequencial, nomes curtos das freguesias e que etiquetas
 * cabem a cada nível de zoom. Sem React nem DOM, para testar com valores calculados à mão.
 */

export interface ClassScale {
  /** Limites inferiores das classes 1..n-1, por ordem crescente (um valor igual ao limite sobe de classe). */
  breaks: number[];
  /** Número de classes (0 sem valores válidos). */
  count: number;
  /** `true` quando cada valor distinto é uma classe (poucos valores inteiros, ex.: circuitos). */
  discrete: boolean;
  min: number;
  max: number;
}

/** Arredonda a 2 algarismos significativos para limites de legenda legíveis (`1,23` → `1,2`; `148` → `150`). */
export function niceBreak(v: number): number {
  if (v === 0 || !Number.isFinite(v)) return v;
  const mag = 10 ** (Math.floor(Math.log10(Math.abs(v))) - 1);
  return Math.round(v / mag) * mag;
}

/**
 * Classes por quantis (cada classe com ≈ o mesmo número de freguesias): honesto com dados enviesados, onde uma escala
 * linear deixaria quase tudo na primeira cor. Com poucos valores distintos, cada valor é uma classe.
 */
export function buildScale(values: Iterable<number>, wanted = 6): ClassScale {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return { breaks: [], count: 0, discrete: false, min: 0, max: 0 };
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const distinct = [...new Set(sorted)];
  if (distinct.length <= wanted) {
    return { breaks: distinct.slice(1), count: distinct.length, discrete: true, min, max };
  }
  const breaks: number[] = [];
  for (let i = 1; i < wanted; i++) {
    const pos = (i / wanted) * (sorted.length - 1);
    const lo = Math.floor(pos);
    const frac = pos - lo;
    const a = sorted[lo] ?? min;
    const b = sorted[lo + 1] ?? a;
    const b0 = niceBreak(a + frac * (b - a));
    const prev = breaks[breaks.length - 1];
    if (b0 > min && b0 <= max && (prev === undefined || b0 > prev)) breaks.push(b0);
  }
  return { breaks, count: breaks.length + 1, discrete: false, min, max };
}

/** Classe (0 = a mais baixa) de um valor; `-1` se o valor não existe (sem dados). */
export function classOf(value: number | null | undefined, scale: ClassScale): number {
  if (value === null || value === undefined || !Number.isFinite(value) || scale.count === 0) {
    return -1;
  }
  let c = 0;
  for (const b of scale.breaks) {
    if (value >= b) c += 1;
    else break;
  }
  return c;
}

export interface LegendClass {
  index: number;
  label: string;
  /** Freguesias nesta classe. */
  count: number;
}

/** Etiquetas da legenda: `< b1`, `b1–b2`, …, `≥ bn`; um valor por classe quando a escala é discreta. */
export function legendClasses(
  scale: ClassScale,
  values: Iterable<number>,
  fmt: (v: number) => string,
): LegendClass[] {
  const counts = new Array<number>(scale.count).fill(0);
  for (const v of values) {
    const c = classOf(v, scale);
    if (c >= 0) counts[c] = (counts[c] ?? 0) + 1;
  }
  const distinct = scale.discrete ? [scale.min, ...scale.breaks] : [];
  return counts.map((count, index) => {
    let label: string;
    if (scale.discrete) label = fmt(distinct[index] ?? 0);
    else if (index === 0) label = `< ${fmt(scale.breaks[0] ?? scale.max)}`;
    else if (index === scale.count - 1) label = `≥ ${fmt(scale.breaks[index - 1] ?? 0)}`;
    else label = `${fmt(scale.breaks[index - 1] ?? 0)}–${fmt(scale.breaks[index] ?? 0)}`;
    return { index, label, count };
  });
}

const PREFIX = /^uni[ãa]o das freguesias de /i;

/** Nome sem o «União das freguesias de» (a tabela e o mapa dizem só as localidades). */
export const stripUnion = (name: string): string => name.replace(PREFIX, '').trim();

/** Nome para o mapa: sem «União das freguesias de» e, se ainda for comprido, só as primeiras localidades. */
export function shortName(name: string): string {
  const base = stripUnion(name);
  if (base.length <= 22) return base;
  const parts = base.split(/,\s*| e /);
  const first = parts[0] ?? base;
  return parts.length > 1 ? `${first}…` : base;
}

/** Largura estimada de um texto em Inter 500 (≈ 0,56 em por carácter): chega para decidir se cabe. */
export const textWidth = (text: string, fontPx: number): number => text.length * fontPx * 0.56;

/** Parte um nome em duas linhas equilibradas no espaço mais perto do meio; `null` se não tem espaços. */
export function splitTwo(text: string): [string, string] | null {
  const mid = text.length / 2;
  let at = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ' && (at < 0 || Math.abs(i - mid) < Math.abs(at - mid))) at = i;
  }
  return at < 0 ? null : [text.slice(0, at), text.slice(at + 1)];
}

export interface LabelCandidate {
  code: string;
  text: string;
  /** Posição do centro em unidades do mapa. */
  x: number;
  y: number;
  /** Corda horizontal e raio inscrito, em unidades do mapa. */
  chord: number;
  radius: number;
  /** Maior primeiro: ganha o lugar quando duas etiquetas se sobrepõem. */
  priority: number;
  /** Deslocamento vertical da etiqueta em píxeis (por baixo de um círculo, por exemplo). */
  dy?: number;
}

export interface MapView {
  k: number;
  tx: number;
  ty: number;
}

export interface PlacedLabel {
  code: string;
  lines: string[];
  /** Posição no ecrã, em píxeis relativos ao mapa. */
  px: number;
  py: number;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/**
 * Que etiquetas mostrar: a uma linha se o nome cabe na corda da freguesia; se não, a duas linhas se cabe a altura;
 * se não cabe, esconde-se (ao ampliar, a freguesia cresce e a etiqueta aparece). A prioridade resolve sobreposições.
 * `unitPx` = píxeis por unidade do mapa sem zoom; `size` = largura e altura do mapa em píxeis.
 */
export function placeLabels(
  candidates: LabelCandidate[],
  view: MapView,
  unitPx: number,
  fontPx: number,
  size: { w: number; h: number },
): PlacedLabel[] {
  const out: PlacedLabel[] = [];
  const taken: Box[] = [];
  const scale = view.k * unitPx;
  const lineH = fontPx * 1.15;
  for (const c of [...candidates].sort((a, b) => b.priority - a.priority)) {
    const px = c.x * scale + view.tx * unitPx;
    const py = c.y * scale + view.ty * unitPx + (c.dy ?? 0);
    const room = c.chord * scale;
    const high = c.radius * 2 * scale;
    let lines: string[] | null = null;
    if (textWidth(c.text, fontPx) <= room * 0.96 && lineH <= high) lines = [c.text];
    else {
      const two = splitTwo(c.text);
      if (
        two &&
        Math.max(textWidth(two[0], fontPx), textWidth(two[1], fontPx)) <= room * 0.92 &&
        lineH * 2 <= high * 1.05
      ) {
        lines = two;
      }
    }
    if (!lines) continue;
    const w = Math.max(...lines.map((l) => textWidth(l, fontPx)));
    const h = lines.length * lineH;
    const box = { x0: px - w / 2 - 2, y0: py - h / 2 - 1, x1: px + w / 2 + 2, y1: py + h / 2 + 1 };
    if (box.x0 < 0 || box.y0 < 0 || box.x1 > size.w || box.y1 > size.h) continue;
    if (taken.some((t) => overlaps(t, box))) continue;
    taken.push(box);
    out.push({ code: c.code, lines, px, py });
  }
  return out;
}

/** Limita o zoom e a translação para o mapa nunca sair do quadro. */
export function clampView(view: MapView, width: number, height: number, maxK = 8): MapView {
  const k = Math.min(maxK, Math.max(1, view.k));
  return {
    k,
    tx: Math.min(0, Math.max(width * (1 - k), view.tx)),
    ty: Math.min(0, Math.max(height * (1 - k), view.ty)),
  };
}

/** Novo zoom `k2` mantendo fixo o ponto `(cx, cy)` (em unidades do mapa, no ecrã sem zoom). */
export function zoomAt(
  view: MapView,
  k2: number,
  cx: number,
  cy: number,
  width: number,
  height: number,
): MapView {
  const k = Math.min(8, Math.max(1, k2));
  const wx = (cx - view.tx) / view.k;
  const wy = (cy - view.ty) / view.k;
  return clampView({ k, tx: cx - wx * k, ty: cy - wy * k }, width, height);
}
