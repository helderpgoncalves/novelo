import { describe, expect, it } from 'vitest';
import type { PlanningParams } from '@/client';
import { getParam, PARAM_GROUPS, setParam, validateParams } from './param-fields';

const base = {
  kg_per_inhab_month: 1.59583,
  vehicle_capex_eur: 42_500,
  on_demand_every_weeks: 2,
  rsu_treatment_eur_per_t: null,
  modes: { existing: { capture_rate: 0.18 } },
} as unknown as PlanningParams;

describe('pressupostos da viatura dedicada e do tratamento', () => {
  it('estão nos grupos e só o custo de tratamento aceita nulo', () => {
    const fields = PARAM_GROUPS.flatMap((g) => g.fields);
    const byPath = new Map(fields.map((f) => [f.path, f]));
    expect(byPath.get('vehicle_capex_eur')?.nullable).toBeFalsy();
    expect(byPath.get('on_demand_every_weeks')?.kind).toBe('int');
    expect(byPath.get('rsu_treatment_eur_per_t')?.nullable).toBe(true);
    expect(byPath.has('pap_cost_per_pickup_eur')).toBe(false); // o saco já não vai na viatura do porta a porta
  });

  it('getParam devolve nulo para valores vazios ou campos que um cenário antigo não tem', () => {
    expect(getParam(base, 'rsu_treatment_eur_per_t')).toBeNull();
    expect(getParam(base, 'modes.existing.capture_rate')).toBe(0.18);
    expect(getParam(base, 'modes.street.capture_rate')).toBeNull();
    expect(getParam({} as PlanningParams, 'vehicle_capex_eur')).toBeNull();
  });

  it('setParam aceita nulo e não muda o original', () => {
    const next = setParam(base, 'rsu_treatment_eur_per_t', 105.64);
    expect(getParam(next, 'rsu_treatment_eur_per_t')).toBe(105.64);
    expect(
      getParam(setParam(next, 'rsu_treatment_eur_per_t', null), 'rsu_treatment_eur_per_t'),
    ).toBeNull();
    expect(getParam(base, 'rsu_treatment_eur_per_t')).toBeNull();
  });

  it('vazio é válido só nos campos que aceitam nulo', () => {
    const errors = validateParams(base);
    expect(errors.rsu_treatment_eur_per_t).toBeUndefined();
    expect(errors.vehicle_capex_eur).toBeUndefined();
    const missing = validateParams(setParam(base, 'vehicle_capex_eur', null));
    expect(missing.vehicle_capex_eur).toBeTruthy();
    const negative = validateParams(setParam(base, 'rsu_treatment_eur_per_t', -1));
    expect(negative.rsu_treatment_eur_per_t).toBeTruthy();
    const tooRare = validateParams(setParam(base, 'on_demand_every_weeks', 9));
    expect(tooRare.on_demand_every_weeks).toBeTruthy();
  });
});
