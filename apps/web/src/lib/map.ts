import type { CollectionMode, ZoneOut } from '@/client';

// Guimarães (caixa aproximada do concelho) e vista inicial.
export const GUIMARAES_BOUNDS: [[number, number], [number, number]] = [
  [-8.44, 41.36],
  [-8.15, 41.56],
];

// Mapa de base vetorial (CARTO sobre dados do OpenStreetMap, sem chave). Substituível em produção por
// `VITE_MAP_STYLE_LIGHT` e `VITE_MAP_STYLE_DARK` (URL de um style.json do MapLibre).
const STYLE_LIGHT =
  import.meta.env.VITE_MAP_STYLE_LIGHT ??
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const STYLE_DARK =
  import.meta.env.VITE_MAP_STYLE_DARK ??
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export const baseStyle = (dark: boolean): string => (dark ? STYLE_DARK : STYLE_LIGHT);

// Cores dos modos de recolha: Areia (locais existentes), Floresta clara (a pedido), Floresta (contentor, só
// referência; também a cor dos locais reais no mapa do cenário).
export const MODE_COLORS: Record<CollectionMode, string> = {
  street: '#2e6b57',
  existing: '#c4a06a',
  on_demand: '#7fb39c',
};

export const NO_MODE_COLOR = '#b8b2a4';

export interface ZoneProps {
  code: string;
  name: string;
  population: number;
  demand_t: number;
  service_days: number;
  [key: string]: unknown;
}

/** Freguesias como GeoJSON para o MapLibre, com propriedades extra por código (ex.: o modo de um cenário). */
export function zonesToGeoJson(
  zones: ZoneOut[],
  extra: Record<string, Record<string, unknown>> = {},
) {
  return {
    type: 'FeatureCollection' as const,
    features: zones
      .filter((z) => z.geometry)
      .map((z) => ({
        type: 'Feature' as const,
        id: Number(z.code),
        properties: {
          code: z.code,
          name: z.name,
          population: z.population,
          demand_t: z.demand_t,
          service_days: z.service_days,
          ...extra[z.code],
        },
        geometry: z.geometry as unknown as GeoJSON.Geometry,
      })),
  };
}
