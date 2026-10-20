type Position = number[];
type Ring = Position[];

const isRing = (v: unknown): v is Ring =>
  Array.isArray(v) && v.every((p) => Array.isArray(p) && typeof p[0] === 'number');

/** Polígonos de um GeoJSON Polygon/MultiPolygon como lista de anéis (exterior + buracos). */
export function polygonsOf(geometry: { [key: string]: unknown } | null): Ring[][] {
  if (!geometry) return [];
  const coords = geometry.coordinates;
  if (geometry.type === 'Polygon' && Array.isArray(coords)) {
    return [(coords as unknown[]).filter(isRing)];
  }
  if (geometry.type === 'MultiPolygon' && Array.isArray(coords)) {
    return (coords as unknown[][]).map((poly) => poly.filter(isRing));
  }
  return [];
}

export interface Projection {
  width: number;
  height: number;
  project: (lon: number, lat: number) => [number, number];
}

/** Projeção equirretangular corrigida pela latitude, ajustada à caixa dos pontos dados. */
export function makeProjection(points: Position[], width = 1000, pad = 24): Projection {
  const lons = points.map((p) => p[0] ?? 0);
  const lats = points.map((p) => p[1] ?? 0);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const cos = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = (maxLon - minLon) * cos || 1;
  const spanY = maxLat - minLat || 1;
  const k = (width - pad * 2) / spanX;
  return {
    width,
    height: Math.round(spanY * k + pad * 2),
    project: (lon, lat) => [pad + (lon - minLon) * cos * k, pad + (maxLat - lat) * k],
  };
}

export function pathOf(polygons: Ring[][], { project }: Projection): string {
  return polygons
    .flatMap((rings) =>
      rings.map((ring) => {
        const pts = ring.map((p) => project(p[0] ?? 0, p[1] ?? 0));
        return `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`;
      }),
    )
    .join('');
}

export type Pt = [number, number];

/** Douglas-Peucker iterativo: mantém o contorno com erro máximo `tol` (unidades projetadas). */
export function simplifyRing(ring: Pt[], tol: number): Pt[] {
  const n = ring.length;
  if (n <= 4) return ring;
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  const t2 = tol * tol;
  while (stack.length > 0) {
    const [a, b] = stack.pop() ?? [0, 0];
    const [ax, ay] = ring[a] ?? [0, 0];
    const [bx, by] = ring[b] ?? [0, 0];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let far = -1;
    let farD = t2;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = ring[i] ?? [0, 0];
      let d2: number;
      if (len2 === 0) d2 = (px - ax) ** 2 + (py - ay) ** 2;
      else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        d2 = (px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2;
      }
      if (d2 > farD) {
        farD = d2;
        far = i;
      }
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  return ring.filter((_, i) => keep[i] === 1);
}

/** Área (sinal ignorado) de um anel pela fórmula do cordel. */
export function ringArea(ring: Pt[]): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i] ?? [0, 0];
    const [x2, y2] = ring[(i + 1) % ring.length] ?? [0, 0];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

/** Pertence ao polígono (anéis exterior + buracos) pela regra par-ímpar. */
export function insidePolygon(x: number, y: number, rings: Pt[][]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i] ?? [0, 0];
      const [xj, yj] = ring[j] ?? [0, 0];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Distância de um ponto ao segmento `a`-`b`. */
function segmentDistance(px: number, py: number, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

/** Distância ao contorno mais próximo (anéis exterior e buracos). */
function boundaryDistance(x: number, y: number, rings: Pt[][]): number {
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j];
      const b = ring[i];
      if (!a || !b) continue;
      const d = segmentDistance(x, y, a, b);
      if (d < best) best = d;
    }
  }
  return best;
}

/** Extensão horizontal do interior à altura `y` à volta de `x`: `[esquerda, direita]`. */
function chordAt(x: number, y: number, rings: Pt[][]): [number, number] {
  const xs: number[] = [];
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j];
      const b = ring[i];
      if (!a || !b || a[1] > y === b[1] > y) continue;
      xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
  }
  xs.sort((p, q) => p - q);
  for (let i = 0; i + 1 < xs.length; i += 2) {
    const lo = xs[i] ?? x;
    const hi = xs[i + 1] ?? x;
    if (x >= lo && x <= hi) return [lo, hi];
  }
  return [x, x];
}

export interface InteriorPoint {
  x: number;
  y: number;
  /** Raio do maior círculo inscrito à volta do ponto. */
  radius: number;
  /** Largura horizontal do interior à altura do ponto. */
  chord: number;
}

/**
 * Ponto interior para pôr a etiqueta: o mais afastado do contorno (ideia do «polo de inacessibilidade»), por
 * pesquisa em grelha refinada. O `x` centra-se na corda horizontal para o texto cair no meio da forma.
 */
export function interiorPoint(rings: Pt[][]): InteriorPoint | null {
  const outer = rings[0] ?? [];
  if (outer.length < 3) return null;
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
  let cell = Math.max(x1 - x0, y1 - y0) / 16;
  if (cell <= 0) return null;
  let best = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, d: -Infinity };
  const scan = (cx: number, cy: number, half: number, n: number) => {
    for (let i = -n; i <= n; i++) {
      for (let j = -n; j <= n; j++) {
        const x = cx + (i * half) / n;
        const y = cy + (j * half) / n;
        if (x < x0 || x > x1 || y < y0 || y > y1 || !insidePolygon(x, y, rings)) continue;
        const d = boundaryDistance(x, y, rings);
        if (d > best.d) best = { x, y, d };
      }
    }
  };
  scan((x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, y1 - y0) / 2, 16);
  for (let round = 0; round < 4; round++) {
    scan(best.x, best.y, cell, 3);
    cell /= 2;
  }
  if (best.d === -Infinity) return null;
  const [lo, hi] = chordAt(best.x, best.y, rings);
  return { x: (lo + hi) / 2, y: best.y, radius: best.d, chord: Math.max(0, hi - lo) };
}
