import type {
  CoordPrecision,
  MunicipalKind,
  MunicipalStream,
  ProducerType,
  SiteClass,
} from '@/client';
import { m } from '@/paraglide/messages';

/** Ordem de apresentação dos tipos: do equipamento mais pesado ao mais leve. */
export const KIND_ORDER: MunicipalKind[] = [
  'underground',
  'platform',
  'surface',
  'organic_collective',
  'organic_producer',
  'green_waste',
];

export const kindLabel: Record<MunicipalKind, () => string> = {
  underground: () => m.mun_kind_underground(),
  platform: () => m.mun_kind_platform(),
  surface: () => m.mun_kind_surface(),
  organic_collective: () => m.mun_kind_organic_collective(),
  organic_producer: () => m.mun_kind_organic_producer(),
  green_waste: () => m.mun_kind_green_waste(),
};

/** Cores por tipo de contentor municipal; a forma (quadrado) é o que o distingue da rede de têxteis. */
export const KIND_COLORS: Record<MunicipalKind, string> = {
  underground: '#3b6ea5',
  platform: '#7b4fa0',
  surface: '#6b6560',
  organic_collective: '#b8741a',
  organic_producer: '#a23b5c',
  green_waste: '#7a8f1f',
};

export const streamLabel: Record<MunicipalStream, () => string> = {
  organico: () => m.mun_stream_organico(),
  verdes: () => m.mun_stream_verdes(),
  desconhecido: () => m.mun_stream_desconhecido(),
};

export const PRODUCER_ORDER: ProducerType[] = [
  'restaurant',
  'school',
  'establishment',
  'large_producer',
  'care_home',
  'hospitality',
];

export const producerLabel: Record<ProducerType, () => string> = {
  restaurant: () => m.mun_producer_restaurant(),
  school: () => m.mun_producer_school(),
  establishment: () => m.mun_producer_establishment(),
  large_producer: () => m.mun_producer_large_producer(),
  care_home: () => m.mun_producer_care_home(),
  hospitality: () => m.mun_producer_hospitality(),
};

export const PRODUCER_COLORS: Record<ProducerType, string> = {
  restaurant: '#c2410c',
  school: '#1c6dd0',
  establishment: '#0f766e',
  large_producer: '#862e9c',
  care_home: '#c2255c',
  hospitality: '#8a6d00',
};

/** Local com vários tipos de produtor. */
export const PRODUCER_MULTI_COLOR = '#14211d';

export const siteClassLabel: Record<SiteClass, () => string> = {
  public: () => m.mun_class_public(),
  producer: () => m.mun_class_producer(),
  mixed: () => m.mun_class_mixed(),
};

export const precisionLabel: Record<CoordPrecision, () => string> = {
  precise: () => m.mun_precision_precise(),
  approximate: () => m.mun_precision_approximate(),
};

/** Razões de candidatura devolvidas pelo ETL (chaves estáveis). */
export const reasonLabel: Record<string, () => string> = {
  underground: () => m.mun_reason_underground(),
  organic_collective_nearby: () => m.mun_reason_organic_nearby(),
  three_or_more_containers: () => m.mun_reason_three_or_more(),
  approximate_coordinates: () => m.mun_reason_approximate(),
};

export const labelOfReason = (key: string): string => reasonLabel[key]?.() ?? key;

/** Bandas de distância ao vizinho mais próximo (m) e respetivas cores, do mais denso ao mais isolado. */
export const NN_BANDS = [
  { from: 0, color: '#2e6b57' },
  { from: 50, color: '#9fc4b2' },
  { from: 150, color: '#e0b04a' },
  { from: 300, color: '#b8431f' },
] as const;

/** Losango dos candidatos a têxteis. */
export const CANDIDATE_COLOR = '#e0a21b';
