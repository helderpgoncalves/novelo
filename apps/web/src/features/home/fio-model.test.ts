import { describe, expect, it } from 'vitest';
import { fioBars } from './fio-model';

const input = { potentialT: 1000, collectedT: 250, reuseT: 150, recycleT: 70, rejectT: 30 };

describe('fioBars', () => {
  const b = fioBars(input);
  it('o potencial parte-se no recolhido e no que falta', () => {
    expect(b.top.map((s) => s.id)).toEqual(['collected', 'missing']);
    expect(b.top[0]?.pct).toBeCloseTo(25, 9);
    expect(b.top[1]?.tonnes).toBeCloseTo(750, 9);
    expect(b.top.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(100, 9);
    expect(b.collectedPct).toBeCloseTo(25, 9);
  });
  it('o recolhido parte-se pelos destinos, em % do total dos destinos', () => {
    expect(b.bottom.map((s) => s.id)).toEqual(['reuse', 'recycle', 'reject']);
    expect(b.bottom[0]?.pct).toBeCloseTo(60, 9);
    expect(b.bottom[2]?.pct).toBeCloseTo(12, 9);
    expect(b.bottom.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(100, 9);
  });
  it('o recolhido nunca passa do potencial', () => {
    const over = fioBars({ ...input, collectedT: 1500 });
    expect(over.top[0]?.tonnes).toBe(1000);
    expect(over.top[1]?.tonnes).toBe(0);
  });
  it('valores em falta ou inválidos contam como zero e não rebentam', () => {
    const bad = fioBars({
      potentialT: Number.NaN,
      collectedT: Number.NaN,
      reuseT: Number.NaN,
      recycleT: -3,
      rejectT: 0,
    });
    expect(bad.potentialT).toBe(0);
    expect(bad.top.every((s) => s.pct === 0 && s.tonnes === 0)).toBe(true);
    expect(bad.bottom).toEqual([]);
    expect(bad.collectedPct).toBe(0);
  });
});
