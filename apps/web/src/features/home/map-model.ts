import type { CaopFeature, OverviewParish } from '@/client';
import { insidePolygon, makeProjection, type Pt, polygonsOf, ringArea, simplifyRing } from './geo';
import type { LayerId } from './tabs';

export type { LayerId };

export interface ParishShape {
  code: string;
  name: string;
  /** Contorno simplificado (caminho SVG). */
  outline: string;
  /** Centros dos pontos da grelha a 45º que caem dentro da freguesia. */
  dots: Pt[];
  /** Ponto de referência para navegar com as setas (centroide projetado). */
  anchor: Pt;
  /** Área em km², da base de dados ou calculada a partir do contorno. */
  areaKm2: number;
}

export interface MapModel {
  width: number;
  height: number;
  /** Passo da grelha (unidades do viewBox). */
  step: number;
  parishes: ParishShape[];
}

const KM_PER_DEGREE_LAT = 111.2;

interface Built {
  code: string;
  name: string;
  areaKm2: number;
  polys: Pt[][][];
  anchor: Pt;
}

/**
 * Constrói o mapa a partir dos contornos CAOP (os mesmos da página Município): projeta os contornos, simplifica-os e preenche cada freguesia com uma grelha de pontos a 45º
 * (centros em `(a·m, a·n)` com `m + n` par, como o meio-tom da marca). O passo escolhe-se para haver ≈ `targetDots`
 * pontos no concelho; toda a freguesia tem pelo menos um ponto. Corre uma vez por conjunto de dados.
 */
export function buildMapModel(features: CaopFeature[], targetDots = 2600): MapModel {
  const withGeometry = features.map((f) => ({ feature: f, polys: polygonsOf(f.geometry) }));
  const all: number[][] = withGeometry.flatMap(({ polys }) => polys.flat(2));
  if (all.length === 0) return { width: 1000, height: 1000, step: 20, parishes: [] };
  const proj = makeProjection(all, 1000, 16);
  const unitKm = KM_PER_DEGREE_LAT / Math.abs(proj.project(0, 1)[1] - proj.project(0, 0)[1] || 1);
  const tol = 0.45;

  const built: Built[] = withGeometry.map(({ feature, polys }) => ({
    code: feature.properties.dicofre,
    name: feature.properties.name,
    areaKm2: feature.properties.area_km2,
    polys: polys.map((rings) =>
      rings.map((ring) =>
        simplifyRing(
          ring.map((p) => proj.project(p[0] ?? 0, p[1] ?? 0)),
          tol,
        ),
      ),
    ),
    anchor: proj.project(
      feature.properties.lon ?? all[0]?.[0] ?? 0,
      feature.properties.lat ?? all[0]?.[1] ?? 0,
    ),
  }));

  const areaOf = (polys: Pt[][][]) =>
    polys.reduce(
      (s, rings) => s + rings.reduce((a, r, i) => a + (i === 0 ? ringArea(r) : -ringArea(r)), 0),
      0,
    );
  const total = built.reduce((s, b) => s + areaOf(b.polys), 0);
  const step = Math.max(4, Math.sqrt(total / (2 * targetDots)));

  const shapes: ParishShape[] = built.map((b) => {
    const dots: Pt[] = [];
    for (const rings of b.polys) {
      const outer = rings[0] ?? [];
      if (outer.length < 3) continue;
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const [x, y] of outer) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      for (let n = Math.ceil(y0 / step); n * step <= y1; n++) {
        for (let k = Math.ceil(x0 / step); k * step <= x1; k++) {
          if ((k + n) % 2 !== 0) continue;
          const x = k * step;
          const y = n * step;
          if (insidePolygon(x, y, rings)) dots.push([x, y]);
        }
      }
    }
    if (dots.length === 0) dots.push(b.anchor);
    const outline = b.polys
      .flatMap((rings) =>
        rings.map(
          (ring) => `M${ring.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`,
        ),
      )
      .join('');
    const fromGeometry = areaOf(b.polys) * unitKm * unitKm;
    return {
      code: b.code,
      name: b.name,
      outline,
      dots,
      anchor: b.anchor,
      areaKm2: b.areaKm2 > 0 ? b.areaKm2 : fromGeometry,
    };
  });
  return { width: proj.width, height: proj.height, step, parishes: shapes };
}

/** Caminho SVG de um conjunto de círculos de raio `r` (um só elemento por freguesia). */
export function dotsPath(dots: Pt[], r: number): string {
  if (r <= 0) return '';
  const d = 2 * r;
  const rr = r.toFixed(2);
  let out = '';
  for (const [x, y] of dots) {
    out += `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${rr} ${rr} 0 1 0 ${d.toFixed(2)} 0a${rr} ${rr} 0 1 0 ${(-d).toFixed(2)} 0`;
  }
  return out;
}

export interface LayerMeta {
  id: LayerId;
  /** `true` quando a camada é estimativa. */
  estimate: boolean;
}

export const LAYERS: LayerMeta[] = [
  { id: 'gap', estimate: true },
  { id: 'population', estimate: false },
  { id: 'containers', estimate: false },
  { id: 'circuits', estimate: false },
  { id: 'data_gaps', estimate: false },
];

export interface LayerContext {
  parishes: OverviewParish[];
  /** Captura média do concelho, em % (a mesma em todas as freguesias: não há captura por freguesia). */
  capturePct: number;
  areaKm2: Map<string, number>;
  /** Contentores municipais por freguesia (não são de têxteis). */
  municipalContainers: Map<string, number>;
}

/** Potencial por captar numa freguesia (t/ano): potencial × (1 − captura média do concelho). Estimativa. */
export const parishGapT = (p: OverviewParish, capturePct: number): number =>
  p.potential_t * (1 - capturePct / 100);

/**
 * Valor por freguesia que dá o raio dos pontos. Densidades por km² para o mapa não premiar só as freguesias grandes;
 */
export function layerValues(layer: LayerId, ctx: LayerContext): Map<string, number> {
  const area = (code: string) => Math.max(0.01, ctx.areaKm2.get(code) ?? 0);
  const out = new Map<string, number>();
  for (const p of ctx.parishes) {
    switch (layer) {
      case 'gap':
        out.set(p.code, parishGapT(p, ctx.capturePct) / area(p.code));
        break;
      case 'population':
        out.set(p.code, p.population / area(p.code));
        break;
      case 'circuits':
        out.set(p.code, p.circuits_count);
        break;
      case 'data_gaps':
        out.set(p.code, p.circuits_count === 0 ? 1 : 0);
        break;
      case 'containers':
        out.set(p.code, (ctx.municipalContainers.get(p.code) ?? 0) / area(p.code));
        break;
    }
  }
  return out;
}

/** Raio de um ponto: área ∝ valor (raio ∝ √valor), com um mínimo para a freguesia continuar visível. */
export function radiusFor(value: number | undefined, max: number, step: number): number {
  const min = step * 0.12;
  if (!value || value <= 0 || max <= 0) return min;
  return Math.max(min, step * 0.68 * Math.sqrt(value / max));
}

export type Direction = 'left' | 'right' | 'up' | 'down';

/**
 * Freguesia vizinha na direção da seta: a mais próxima dentro de um cone de ≈ 63º; se não houver, a mais próxima
 * no semiplano. `null` se não há ninguém nessa direção.
 */
export function neighbourInDirection(
  anchors: { code: string; x: number; y: number }[],
  from: string,
  dir: Direction,
): string | null {
  const origin = anchors.find((a) => a.code === from);
  if (!origin) return anchors[0]?.code ?? null;
  const horizontal = dir === 'left' || dir === 'right';
  const sign = dir === 'right' || dir === 'down' ? 1 : -1;
  let best: { code: string; score: number } | null = null;
  let bestLoose: { code: string; score: number } | null = null;
  for (const a of anchors) {
    if (a.code === from) continue;
    const dx = a.x - origin.x;
    const dy = a.y - origin.y;
    const along = (horizontal ? dx : dy) * sign;
    const across = Math.abs(horizontal ? dy : dx);
    if (along <= 0) continue;
    const score = along * along + 4 * across * across;
    if (across <= 2 * along && (!best || score < best.score)) best = { code: a.code, score };
    const loose = along * along + across * across;
    if (!bestLoose || loose < bestLoose.score) bestLoose = { code: a.code, score: loose };
  }
  return (best ?? bestLoose)?.code ?? null;
}
