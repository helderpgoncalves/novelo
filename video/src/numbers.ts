import data from './data/numbers.json';

/** Números do cenário de referência de 60 000 €/ano e da curva, tirados da API por scripts/prepare-numbers.mjs. */
export const N = data;
export const K = data.scenario60.kpis;
export const MC = data.sensitivity.eur_per_tonne;
export const GENERATED_T = K.potential_t + K.baseline_observed_t;
export const CAPTURE_NOW = (K.baseline_observed_t / GENERATED_T) * 100;
export const CAPTURE_AFTER = ((K.baseline_observed_t + K.tonnes_year) / GENERATED_T) * 100;
const tipau = (urban: boolean) => {
  const ps = data.coverage.parishes.filter((p) => (p.tipau === 'apu') === urban);
  return (ps.reduce((a, p) => a + p.covered_population, 0) / ps.reduce((a, p) => a + p.population, 0)) * 100;
};
export const COVER_URBAN = tipau(true);
export const COVER_OTHER = tipau(false);
export const TREATMENT_EUR_PER_T = 105.64;
