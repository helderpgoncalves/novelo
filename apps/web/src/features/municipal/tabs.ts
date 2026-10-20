export const MUNICIPAL_TABS = [
  'overview',
  'parishes',
  'sites',
  'candidates',
  'gaps',
  'quality',
] as const;
export type MunicipalTab = (typeof MUNICIPAL_TABS)[number];
