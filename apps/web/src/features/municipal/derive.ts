import type {
  MunicipalKind,
  MunicipalProducerSite,
  ProducerType,
  SiteFeature,
  SiteFeatureCollection,
} from '@/client';
import { markerId } from '@/features/map/marker-images';
import {
  CANDIDATE_COLOR,
  KIND_COLORS,
  KIND_ORDER,
  NN_BANDS,
  PRODUCER_COLORS,
  PRODUCER_MULTI_COLOR,
} from './vocab';

// --- camadas do mapa -------------------------------------------------------------------------------

export type FillMode = 'textile' | 'density' | 'cover' | 'none';
export type SitesMode = 'kind' | 'candidates' | 'isolation' | 'density' | 'off';
export type Preset = 'textile' | 'municipal' | 'gaps';

export const PRESET_IDS: Preset[] = ['textile', 'municipal', 'gaps'];
export const FILL_MODES: FillMode[] = ['textile', 'density', 'cover', 'none'];
export const SITES_MODES: SitesMode[] = ['kind', 'candidates', 'isolation', 'density', 'off'];

/** O que o mapa mostra. Tudo o que é municipal começa desligado: a rede de têxteis é o ponto de partida. */
export interface LayerState {
  /** Localidades da rede de têxteis. */
  localities: boolean;
  /** Preenchimento das freguesias: procura de têxteis (OSM) ou métricas municipais (CAOP 2019). */
  fill: FillMode;
  /** Locais municipais: por tipo, candidatos a têxteis, distância ao vizinho ou densidade. */
  sites: SitesMode;
  kinds: MunicipalKind[];
  /** Produtores (orgânico) por tipo, sem nomes. */
  producers: boolean;
}

export const PRESETS: Record<Preset, LayerState> = {
  textile: {
    localities: true,
    fill: 'textile',
    sites: 'off',
    kinds: [...KIND_ORDER],
    producers: false,
  },
  municipal: {
    localities: false,
    fill: 'density',
    sites: 'kind',
    kinds: [...KIND_ORDER],
    producers: false,
  },
  gaps: {
    localities: false,
    fill: 'cover',
    sites: 'candidates',
    kinds: [...KIND_ORDER],
    producers: false,
  },
};

export type LayerOverrides = Partial<LayerState>;

export const resolveLayers = (preset: Preset, overrides: LayerOverrides = {}): LayerState => {
  const base = PRESETS[preset];
  return {
    localities: overrides.localities ?? base.localities,
    fill: overrides.fill ?? base.fill,
    sites: overrides.sites ?? base.sites,
    kinds: overrides.kinds ?? base.kinds,
    producers: overrides.producers ?? base.producers,
  };
};

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/** O preset cujo estado é exatamente o atual (para realçar o botão), ou `null` se for personalizado. */
export const matchPreset = (state: LayerState): Preset | null =>
  PRESET_IDS.find((id) => {
    const p = PRESETS[id];
    return (
      p.localities === state.localities &&
      p.fill === state.fill &&
      p.sites === state.sites &&
      p.producers === state.producers &&
      sameSet(p.kinds, state.kinds)
    );
  }) ?? null;

/** Lê `kinds=underground,surface` do URL; valores desconhecidos são ignorados. */
export const parseKinds = (csv: string | undefined): MunicipalKind[] | undefined => {
  if (csv === undefined) return undefined;
  const wanted = csv.split(',');
  return KIND_ORDER.filter((k) => wanted.includes(k));
};

export const serializeKinds = (kinds: MunicipalKind[]): string =>
  KIND_ORDER.filter((k) => kinds.includes(k)).join(',');

/** Estado das camadas no URL do mapa: o preset e só o que o utilizador mudou em relação a ele. */
export interface LayerSearch {
  preset?: Preset;
  loc?: boolean;
  fill?: FillMode;
  sites?: SitesMode;
  kinds?: string;
  producers?: boolean;
}

export const layersFromSearch = (s: LayerSearch): LayerState =>
  resolveLayers(s.preset ?? 'textile', {
    localities: s.loc,
    fill: s.fill,
    sites: s.sites,
    kinds: parseKinds(s.kinds),
    producers: s.producers,
  });

/** O inverso: do estado escolhido para os parâmetros do URL (só o que difere do preset). */
export const searchFromLayers = (
  preset: Preset,
  state: LayerState,
): Omit<LayerSearch, 'preset'> => {
  const base = PRESETS[preset];
  return {
    loc: state.localities !== base.localities ? state.localities : undefined,
    fill: state.fill !== base.fill ? state.fill : undefined,
    sites: state.sites !== base.sites ? state.sites : undefined,
    kinds: sameSet(state.kinds, base.kinds) ? undefined : serializeKinds(state.kinds),
    producers: state.producers !== base.producers ? state.producers : undefined,
  };
};

// --- dados do mapa ----------------------------------------------------------------------------------

export interface SiteProps {
  site_id: string;
  kind: MunicipalKind;
  color: string;
  containers: number;
  candidate: boolean;
  approximate: boolean;
  nn: number;
  nn_band: number;
  parish: string;
  /** Marcador do modo atual (forma + cor). */
  icon: string;
}

export type SitePoint = GeoJSON.Feature<GeoJSON.Point, SiteProps>;

/** Banda de distância ao vizinho (0 = muito perto ... 3 = isolado). Sem distância, `-1`. */
export const nnBand = (distance: number | null | undefined): number => {
  if (distance == null) return -1;
  let band = 0;
  NN_BANDS.forEach((b, i) => {
    if (distance >= b.from) band = i;
  });
  return band;
};

const isSingleSite = (f: SiteFeature): f is SiteFeature & { properties: { site_id: string } } =>
  !f.properties.cluster && !!f.properties.site_id;

/** Locais individuais do GeoJSON do servidor, com a cor do tipo principal e as propriedades que o mapa usa. */
export function sitePoints(collection: SiteFeatureCollection | undefined): SitePoint[] {
  if (!collection) return [];
  return collection.features.filter(isSingleSite).map((f) => {
    const p = f.properties;
    const kind = p.kind ?? 'surface';
    return {
      type: 'Feature' as const,
      id: p.site_id,
      geometry: { type: 'Point' as const, coordinates: [...f.geometry.coordinates] },
      properties: {
        site_id: p.site_id,
        kind,
        color: KIND_COLORS[kind],
        containers: p.containers,
        candidate: p.textile_candidate === true,
        approximate: p.coord_precision === 'approximate',
        nn: p.nn_distance_m ?? -1,
        nn_band: nnBand(p.nn_distance_m),
        parish: p.parish_name ?? '',
        icon: markerId('sq', KIND_COLORS[kind]),
      },
    };
  });
}

export interface SiteFilter {
  sites: SitesMode;
  kinds: MunicipalKind[];
  /** Os produtores desenham-se à parte (por tipo): saem da camada de locais. */
  producers: boolean;
  /** Ids de locais de produtores, para os tirar da camada de locais quando os produtores estão ligados. */
  producerSiteIds: ReadonlySet<string>;
}

const iconFor = (mode: SitesMode, s: SiteProps): string => {
  if (mode === 'candidates') return markerId('dia', CANDIDATE_COLOR);
  if (mode === 'isolation') {
    const band = NN_BANDS[Math.max(0, s.nn_band)];
    return markerId('sq', band?.color ?? KIND_COLORS[s.kind]);
  }
  return markerId('sq', KIND_COLORS[s.kind]);
};

/** Locais que o modo atual desenha, já com o marcador certo (forma e cor). */
export function visibleSites(points: SitePoint[], f: SiteFilter): SitePoint[] {
  if (f.sites === 'off') return [];
  const kept = points.filter((p) => {
    const s = p.properties;
    if (f.producers && f.producerSiteIds.has(s.site_id)) return false;
    if (f.sites === 'candidates') return s.candidate;
    if (f.sites === 'isolation') return s.nn_band >= 0;
    if (f.sites === 'density') return true;
    return f.kinds.includes(s.kind);
  });
  return kept.map((p) => ({
    ...p,
    properties: { ...p.properties, icon: iconFor(f.sites, p.properties) },
  }));
}

/** Número de locais por tipo principal (para a legenda e as contagens dos interruptores). */
export function countByKind(points: SitePoint[]): Record<MunicipalKind, number> {
  const out = Object.fromEntries(KIND_ORDER.map((k) => [k, 0])) as Record<MunicipalKind, number>;
  for (const p of points) out[p.properties.kind] += 1;
  return out;
}

export interface ProducerProps {
  site_id: string;
  color: string;
  icon: string;
  type: ProducerType | 'multiple';
  containers: number;
}
export type ProducerPoint = GeoJSON.Feature<GeoJSON.Point, ProducerProps>;

/** Produtores como pontos; um local com vários tipos fica no tipo "vários". Os nomes nunca entram. */
export function producerPoints(items: MunicipalProducerSite[]): ProducerPoint[] {
  return items.map((s) => {
    const type = s.producer_types.length === 1 ? (s.producer_types[0] ?? 'multiple') : 'multiple';
    const color = type === 'multiple' ? PRODUCER_MULTI_COLOR : PRODUCER_COLORS[type];
    return {
      type: 'Feature' as const,
      id: s.site_id,
      geometry: { type: 'Point' as const, coordinates: [s.longitude, s.latitude] },
      properties: {
        site_id: s.site_id,
        type,
        color,
        icon: markerId('tri', color),
        containers: s.containers,
      },
    };
  });
}

export function countByProducerType(points: ProducerPoint[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of points) out[p.properties.type] = (out[p.properties.type] ?? 0) + 1;
  return out;
}

// --- estatística ------------------------------------------------------------------------------------

/** Quantil (interpolação linear) de uma lista não vazia. */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] ?? 0;
  const b = sorted[hi] ?? a;
  return a + (b - a) * (pos - lo);
}

/**
 * Teto "redondo" para a rampa de um coroplético: o percentil 90 arredondado para cima a 1, 2, 2,5 ou 5 × 10ⁿ.
 * Evita que um valor extremo (ex.: uma freguesia com 699 habitantes e 33 contentores) deslave o resto.
 */
export function niceMax(values: number[], q = 0.9): number {
  const v = quantile(values.filter(Number.isFinite), q);
  if (v <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= v) ?? 10;
  return step * magnitude;
}
