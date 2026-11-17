import type {
  Colour,
  FineState,
  Gender,
  Provenance,
  Season,
  SizeBand,
  TextileDestination,
  TriageAxis,
} from '@/client';
import { m } from '@/paraglide/messages';

// Espelho web de `domain/taxonomy.py` (taxonomia fechada e versionada da triagem, v1):
// os valores têm de coincidir com a API — qualquer alteração lá passa por aqui e pelas traduções.

export const FINE_STATES: FineState[] = [
  'grade_a',
  'grade_b',
  'grade_c',
  'grade_d',
  'recycle',
  'reject',
];
export const SEASONS: Season[] = ['all_season', 'warm', 'cold'];
export const COLOURS: Colour[] = [
  'black',
  'white',
  'grey',
  'beige',
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'pink',
  'multicolour',
  'unknown',
];
export const GENDERS: Gender[] = ['men', 'women', 'kids', 'babies'];
export const SIZE_BANDS: SizeBand[] = ['xs', 's', 'm', 'l', 'xl', 'xxl', 'unknown'];

/** Eixos que entram na chave do lote de escoamento (#57); cor e tamanho ficam só para filtros. */
export const EXPORT_KEY_AXES: TriageAxis[] = ['fine_state', 'garment_type', 'season', 'gender'];

export const fineStateLabel: Record<FineState, () => string> = {
  grade_a: () => m.fine_state_grade_a(),
  grade_b: () => m.fine_state_grade_b(),
  grade_c: () => m.fine_state_grade_c(),
  grade_d: () => m.fine_state_grade_d(),
  recycle: () => m.fine_state_recycle(),
  reject: () => m.fine_state_reject(),
};

export const seasonLabel: Record<Season, () => string> = {
  all_season: () => m.season_all_season(),
  warm: () => m.season_warm(),
  cold: () => m.season_cold(),
};

export const colourLabel: Record<Colour, () => string> = {
  black: () => m.colour_black(),
  white: () => m.colour_white(),
  grey: () => m.colour_grey(),
  beige: () => m.colour_beige(),
  brown: () => m.colour_brown(),
  red: () => m.colour_red(),
  orange: () => m.colour_orange(),
  yellow: () => m.colour_yellow(),
  green: () => m.colour_green(),
  blue: () => m.colour_blue(),
  pink: () => m.colour_pink(),
  multicolour: () => m.colour_multicolour(),
  unknown: () => m.colour_unknown(),
};

export const genderLabel: Record<Gender, () => string> = {
  men: () => m.gender_men(),
  women: () => m.gender_women(),
  kids: () => m.gender_kids(),
  babies: () => m.gender_babies(),
};

export const sizeBandLabel: Record<SizeBand, () => string> = {
  xs: () => m.size_band_xs(),
  s: () => m.size_band_s(),
  m: () => m.size_band_m(),
  l: () => m.size_band_l(),
  xl: () => m.size_band_xl(),
  xxl: () => m.size_band_xxl(),
  unknown: () => m.size_band_unknown(),
};

export const provenanceLabel: Record<Provenance, () => string> = {
  ai: () => m.triage_seal_ai(),
  confirmed: () => m.triage_seal_confirmed(),
};

/** Os 4 graus são reutilização; reciclar e rejeitar mantêm o destino (mesma tabela do domínio). */
export const DESTINATION_BY_FINE_STATE: Record<FineState, TextileDestination> = {
  grade_a: 'reuse',
  grade_b: 'reuse',
  grade_c: 'reuse',
  grade_d: 'reuse',
  recycle: 'recycle',
  reject: 'reject',
};

export const destinationFor = (fine: FineState): TextileDestination =>
  DESTINATION_BY_FINE_STATE[fine];
