import { describe, expect, it } from 'vitest';
import type { OverviewReference } from '@/client';
import { daysUntil, pickBenchmark } from './derive';

const ref = (key: string, verified: boolean, scope: OverviewReference['scope']) =>
  ({ key, verified, scope, kg_per_inhab_year: 1 }) as OverviewReference;

describe('daysUntil', () => {
  it('conta dias de calendário', () => {
    expect(daysUntil('2028-04-17', new Date(2026, 9, 20, 23, 59))).toBe(545);
    expect(daysUntil('2025-01-01', new Date(2026, 0, 1))).toBeLessThan(0);
  });
});

describe('pickBenchmark', () => {
  it('prefere a França verificada', () => {
    const refs = [ref('eu27_2020', true, 'eu'), ref('france_2024', true, 'country')];
    expect(pickBenchmark(refs)?.key).toBe('france_2024');
  });
  it('ignora referências por verificar', () => {
    const refs = [ref('france_2024', false, 'country'), ref('eu27_2020', true, 'eu')];
    expect(pickBenchmark(refs)?.key).toBe('eu27_2020');
    expect(pickBenchmark([ref('france_2024', false, 'country')])).toBeUndefined();
  });
});
