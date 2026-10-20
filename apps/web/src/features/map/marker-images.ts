import type { Map as MaplibreMap, StyleImageMetadata } from 'maplibre-gl';

/** Formas dos marcadores: a forma distingue a rede (o círculo é a rede de têxteis); a cor, o tipo. */
export type MarkerShape = 'sq' | 'tri' | 'dia' | 'cl';

const PREFIX = 'mun:';

export const markerId = (shape: MarkerShape, color: string): string =>
  `${PREFIX}${shape}:${color.replace('#', '')}`;

const RATIO = 2;
const LOGICAL: Record<MarkerShape, number> = { sq: 18, tri: 20, dia: 22, cl: 40 };

function path(ctx: CanvasRenderingContext2D, shape: MarkerShape, size: number, inset: number) {
  const c = size / 2;
  const r = size / 2 - inset;
  ctx.beginPath();
  if (shape === 'tri') {
    ctx.moveTo(c, c - r);
    ctx.lineTo(c + r, c + r * 0.85);
    ctx.lineTo(c - r, c + r * 0.85);
    ctx.closePath();
  } else if (shape === 'dia') {
    ctx.moveTo(c, c - r);
    ctx.lineTo(c + r, c);
    ctx.lineTo(c, c + r);
    ctx.lineTo(c - r, c);
    ctx.closePath();
  } else {
    const radius = shape === 'cl' ? 8 : 2.5;
    ctx.roundRect(c - r, c - r, r * 2, r * 2, radius);
  }
}

/** Desenha um marcador com contorno escuro e branco, legível sobre o mapa claro e o escuro. */
export function drawMarker(shape: MarkerShape, color: string): ImageData | null {
  const size = LOGICAL[shape] * RATIO;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const inset = 1 * RATIO;
  const layers: [string, number][] = [
    ['rgba(20,33,29,0.55)', inset],
    ['#ffffff', inset + 1 * RATIO],
    [`#${color}`, inset + 2.5 * RATIO],
  ];
  for (const [fill, i] of layers) {
    ctx.fillStyle = fill;
    path(ctx, shape, size, i);
    ctx.fill();
  }
  return ctx.getImageData(0, 0, size, size);
}

const isMarker = (id: string) => id.startsWith(PREFIX);

/** Gera os marcadores à medida que o estilo os pede (também depois de trocar o tema, que recarrega o estilo). */
export function registerMarkerImages(map: MaplibreMap): () => void {
  const onMissing = (e: { id: string }) => {
    if (!isMarker(e.id) || map.hasImage(e.id)) return;
    const [, shape, color] = e.id.split(':');
    if (!shape || !color) return;
    const data = drawMarker(shape as MarkerShape, color);
    if (!data) return;
    const meta: Partial<StyleImageMetadata> = { pixelRatio: RATIO };
    map.addImage(e.id, data, meta);
  };
  map.on('styleimagemissing', onMissing);
  return () => {
    map.off('styleimagemissing', onMissing);
  };
}
