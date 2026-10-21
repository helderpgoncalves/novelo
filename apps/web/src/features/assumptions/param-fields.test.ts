import { describe, expect, it } from 'vitest';
import type { PlanningParams } from '@/client';
import { getParam, PARAM_GROUPS, setParam, validateParams } from './param-fields';

const base = {
  kg_per_inhab_month: 1.235,
  pap_cost_per_pickup_eur: 6,
  pap_free_capacity_kg: null,
  rsu_treatment_eur_per_t: null,
  modes: { existing: { capture_rate: 0.18 } },
} as unknown as PlanningParams;

describe('pressupostos por preencher', () => {
  it('os três parâmetros novos estão nos grupos e só os da Vitrus aceitam nulo', () => {
    const fields = PARAM_GROUPS.flatMap((g) => g.fields);
    const byPath = new Map(fields.map((f) => [f.path, f]));
    expect(byPath.get('pap_cost_per_pickup_eur')?.nullable).toBeFalsy();
    expect(byPath.get('pap_free_capacity_kg')?.nullable).toBe(true);
    expect(byPath.get('rsu_treatment_eur_per_t')?.nullable).toBe(true);
  });

  it('getParam devolve nulo para valores vazios ou campos que um cenário antigo não tem', () => {
    expect(getParam(base, 'rsu_treatment_eur_per_t')).toBeNull();
    expect(getParam(base, 'modes.existing.capture_rate')).toBe(0.18);
    expect(getParam(base, 'modes.street.capture_rate')).toBeNull();
    expect(getParam({} as PlanningParams, 'pap_cost_per_pickup_eur')).toBeNull();
  });

  it('setParam aceita nulo e não muda o original', () => {
    const next = setParam(base, 'rsu_treatment_eur_per_t', 85);
    expect(getParam(next, 'rsu_treatment_eur_per_t')).toBe(85);
    expect(
      getParam(setParam(next, 'rsu_treatment_eur_per_t', null), 'rsu_treatment_eur_per_t'),
    ).toBeNull();
    expect(getParam(base, 'rsu_treatment_eur_per_t')).toBeNull();
  });

  it('vazio é válido só nos campos que aceitam nulo', () => {
    const errors = validateParams(base);
    expect(errors.rsu_treatment_eur_per_t).toBeUndefined();
    expect(errors.pap_free_capacity_kg).toBeUndefined();
    expect(errors.pap_cost_per_pickup_eur).toBeUndefined();
    const missing = validateParams(setParam(base, 'pap_cost_per_pickup_eur', null));
    expect(missing.pap_cost_per_pickup_eur).toBeTruthy();
    const negative = validateParams(setParam(base, 'rsu_treatment_eur_per_t', -1));
    expect(negative.rsu_treatment_eur_per_t).toBeTruthy();
  });
});
