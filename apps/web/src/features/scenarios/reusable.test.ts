import { describe, expect, it } from 'vitest';
import type { Kpis } from '@/client';
import { reusableSummary } from './reusable';

const base: Kpis = {
  annual_cost_eur: 1000,
  baseline_observed_t: 301.27,
  capex_eur: 0,
  coverage_pct: 75,
  eur_per_tonne: 100,
  km_year: 0,
  opex_eur_year: 1000,
  points: 1,
  potential_t: 2324.8,
  tonnes_year: 10,
};

describe('reusableSummary', () => {
  it('é nulo nos cenários antigos, sem os campos de reutilização', () => {
    expect(reusableSummary(base)).toBeNull();
    expect(reusableSummary({ ...base, reusable_t: null, reuse_share: null })).toBeNull();
  });

  it('usa os valores da API e divide o custo pelas toneladas alta e baixa', () => {
    // 10 t × 0,5 = 5 t; × 0,4 = 4 t; × 0,8 = 8 t. 1 000 € ÷ 5 = 200; ÷ 8 = 125; ÷ 4 = 250.
    const s = reusableSummary({
      ...base,
      reuse_share: 0.5,
      reuse_share_low: 0.4,
      reuse_share_high: 0.8,
      reusable_t: 5,
      reusable_t_low: 4,
      reusable_t_high: 8,
      eur_per_reusable_t: 200,
    });
    expect(s).toMatchObject({
      share: 0.5,
      tonnes: 5,
      tonnesLow: 4,
      tonnesHigh: 8,
      eurPerTonne: 200,
      eurPerTonneLow: 125,
      eurPerTonneHigh: 250,
    });
  });

  it('sem intervalo, só o valor central; com 0 t não divide', () => {
    const s = reusableSummary({ ...base, reuse_share: 0.5, reusable_t: 0 });
    expect(s).toMatchObject({ tonnesLow: null, eurPerTonne: null, eurPerTonneLow: null });
  });
});
