import { describe, expect, it } from 'vitest';
import type { CalibrationReadingOut } from '@/client';
import { formatValue } from './rows';

const row = (overrides: Partial<CalibrationReadingOut>): CalibrationReadingOut => ({
  metric: 'generation_rate',
  scope: 'local',
  unit_code: 'l-1',
  unit_name: 'Escola de teste',
  parish_code: '030810',
  n: 2,
  pseudo_k: 4,
  observed: 0.5,
  prior: 26.23,
  blended: 17.7,
  weight: 0.33333333,
  label: 'estimativa·2',
  ...overrides,
});

describe('formatValue', () => {
  it('mostra os kg/dia com até três casas', () => {
    expect(formatValue(row({}), 17.7)).toContain('17,7');
  });

  it('mostra a captura derivada em percentagem', () => {
    const capture = row({ metric: 'on_demand_capture', observed: 0.0147, blended: 0.1229 });
    expect(formatValue(capture, 0.1229)).toContain('%');
  });

  it('sem observação mostra travessão', () => {
    expect(formatValue(row({}), null)).toBe('—');
  });
});
