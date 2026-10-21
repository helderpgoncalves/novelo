export const MUNICIPAL_TABS = [
  'overview',
  'parishes',
  'sites',
  'candidates',
  'b2b',
  'gaps',
  'quality',
] as const;
export type MunicipalTab = (typeof MUNICIPAL_TABS)[number];
