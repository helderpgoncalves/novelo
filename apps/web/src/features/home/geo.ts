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
