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
