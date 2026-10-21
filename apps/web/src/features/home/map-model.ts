import type { CaopFeature, OverviewParish } from '@/client';
import { shortName } from './choropleth';
import { interiorPoint, makeProjection, type Pt, polygonsOf, ringArea, simplifyRing } from './geo';
import type { LayerId } from './tabs';

export type { LayerId };

export interface ParishShape {
  code: string;
  name: string;
  /** Nome curto para a etiqueta do mapa. */
  label: string;
  /** Contorno simplificado (caminho SVG). */
  outline: string;
  /** Ponto da etiqueta e de referência para navegar com as setas (interior da maior parte da freguesia). */
  anchor: Pt;
  /** Raio do círculo inscrito e largura horizontal à altura da etiqueta (unidades do mapa). */
  radius: number;
  chord: number;
  /** Área em km², da base de dados ou calculada a partir do contorno. */
  areaKm2: number;
}

export interface MapModel {
  width: number;
  height: number;
  parishes: ParishShape[];
  /** Todos os contornos num só caminho (fronteiras e contorno do concelho, desenhados uma vez). */
  borders: string;
}

const KM_PER_DEGREE_LAT = 111.2;

interface Built {
  code: string;
  name: string;
  areaKm2: number;
  polys: Pt[][][];
  fallback: Pt;
}

/**
 * Constrói o mapa a partir dos contornos CAOP (os mesmos da página Município): projeta e simplifica os contornos e
 * calcula, para cada freguesia, o ponto interior da etiqueta. Corre uma vez por conjunto de dados.
 */
export function buildMapModel(features: CaopFeature[]): MapModel {
  const withGeometry = features.map((f) => ({ feature: f, polys: polygonsOf(f.geometry) }));
  const all: number[][] = withGeometry.flatMap(({ polys }) => polys.flat(2));
  if (all.length === 0) return { width: 1000, height: 1000, parishes: [], borders: '' };
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
    fallback: proj.project(
      feature.properties.lon ?? all[0]?.[0] ?? 0,
      feature.properties.lat ?? all[0]?.[1] ?? 0,
    ),
  }));

  const polyArea = (rings: Pt[][]) =>
    rings.reduce((a, r, i) => a + (i === 0 ? ringArea(r) : -ringArea(r)), 0);
  const areaOf = (polys: Pt[][][]) => polys.reduce((s, rings) => s + polyArea(rings), 0);

  const shapes: ParishShape[] = built.map((b) => {
    // A etiqueta vai para a maior parte da freguesia (as que têm exclaves não ficam com a etiqueta fora).
    const biggest = [...b.polys].sort((p, q) => polyArea(q) - polyArea(p))[0];
    const spot = biggest ? interiorPoint(biggest) : null;
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
      label: shortName(b.name),
      outline,
      anchor: spot ? [spot.x, spot.y] : b.fallback,
      radius: spot?.radius ?? 0,
      chord: spot?.chord ?? 0,
      areaKm2: b.areaKm2 > 0 ? b.areaKm2 : fromGeometry,
    };
  });
  return {
    width: proj.width,
    height: proj.height,
    parishes: shapes,
    borders: shapes.map((p) => p.outline).join(''),
  };
}

export interface LayerMeta {
  id: LayerId;
  /** `true` quando a camada é estimativa. */
  estimate: boolean;
  /** Como se desenha: escala de cores, círculos proporcionais (por cima de um fundo neutro) ou duas categorias. */
  kind: 'scale' | 'circles' | 'binary';
}

export const LAYERS: LayerMeta[] = [
  { id: 'gap', estimate: true, kind: 'scale' },
  { id: 'population', estimate: false, kind: 'scale' },
  { id: 'density', estimate: false, kind: 'scale' },
  { id: 'containers', estimate: false, kind: 'circles' },
  { id: 'circuits', estimate: false, kind: 'scale' },
  { id: 'data_gaps', estimate: false, kind: 'binary' },
];

export interface LayerContext {
  parishes: OverviewParish[];
  areaKm2: Map<string, number>;
  /** Contentores municipais por freguesia (não são de têxteis). */
  municipalContainers: Map<string, number>;
}

/**
 * Têxtil que ainda vai para o lixo numa freguesia (t/ano). A API já o dá em `potential_t` (população × 43 051 t × 5,4%
 * ÷ população do concelho, Vitrus + APA): o recolhido à parte não entra, por isso não se desconta a captura. Estimativa.
 */
export const parishGapT = (p: OverviewParish): number => p.potential_t;

/**
 * Valor de cada freguesia na camada. Uma freguesia sem valor válido não entra no mapa (fica «sem dados»). O potencial
 * por captar e a população são totais (o que se lê na tabela ao lado); a densidade corrige o efeito do tamanho.
 */
export function layerValues(layer: LayerId, ctx: LayerContext): Map<string, number> {
  const out = new Map<string, number>();
  const put = (code: string, v: number | null | undefined) => {
    if (typeof v === 'number' && Number.isFinite(v)) out.set(code, v);
  };
  for (const p of ctx.parishes) {
    const area = ctx.areaKm2.get(p.code) ?? 0;
    switch (layer) {
      case 'gap':
        put(p.code, parishGapT(p));
        break;
      case 'population':
        put(p.code, p.population);
        break;
      case 'density':
        put(p.code, area > 0 ? p.population / area : null);
        break;
      case 'circuits':
        put(p.code, p.circuits_count);
        break;
      case 'data_gaps':
        put(p.code, p.circuits_count === 0 ? 1 : 0);
        break;
      case 'containers':
        put(p.code, ctx.municipalContainers.get(p.code));
        break;
    }
  }
  return out;
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
