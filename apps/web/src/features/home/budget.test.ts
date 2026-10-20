import { describe, expect, it } from 'vitest';
import type { FrontierPoint } from '@/client';
import { budgetCurve, budgetRange, estimateAt, initialBudget } from './budget';

const pt = (id: string, cost: number, t: number, status: 'feasible' | 'infeasible' = 'feasible') =>
  ({ id, label: id, annual_cost_eur: cost, tonnes_year: t, status }) as FrontierPoint;

const points = [
  pt('c', 90000, 500),
  pt('a', 30000, 300),
  pt('dominated', 60000, 280),
  pt('b', 60000, 400),
  pt('bad', 10000, 900, 'infeasible'),
];

describe('budgetCurve', () => {
  it('ordena por custo e descarta inviáveis e dominados', () => {
    const curve = budgetCurve(points);
    expect(curve.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(budgetCurve([])).toEqual([]);
  });
});

describe('estimateAt', () => {
  const curve = budgetCurve(points);
  it('interpola linearmente entre dois cenários guardados', () => {
    const e = estimateAt(curve, 45000);
    expect(e?.tonnes).toBeCloseTo(350, 6);
    expect(e?.eurPerTonne).toBeCloseTo(45000 / 350, 6);
    expect(e?.lower.id).toBe('a');
    expect(e?.upper.id).toBe('b');
  });
  it('coincide com um cenário no seu custo', () => {
    const e = estimateAt(curve, 60000);
    expect(e?.tonnes).toBe(400);
    expect(e?.nearest.id).toBe('b');
  });
  it('não extrapola fora do intervalo dos cenários guardados', () => {
    expect(estimateAt(curve, 29999)).toBeNull();
    expect(estimateAt(curve, 90001)).toBeNull();
    expect(estimateAt([], 1)).toBeNull();
  });
  it('escolhe o cenário mais próximo', () => {
    expect(estimateAt(curve, 40000)?.nearest.id).toBe('a');
    expect(estimateAt(curve, 80000)?.nearest.id).toBe('c');
  });
});

describe('budgetRange e initialBudget', () => {
  const curve = budgetCurve(points);
  it('arredonda para dentro do intervalo', () => {
    const r = budgetRange(
      [{ id: 'x', label: 'x', costEur: 30120, tonnes: 1 }, ...curve.slice(2)],
      500,
    );
    expect(r).toEqual({ min: 30500, max: 90000, step: 500 });
    expect(budgetRange([], 500)).toBeNull();
  });
  it('limita o valor da URL e usa o ponto médio por omissão', () => {
    const r = { min: 30000, max: 90000, step: 500 };
    expect(initialBudget(r)).toBe(60000);
    expect(initialBudget(r, 1)).toBe(30000);
    expect(initialBudget(r, 1e9)).toBe(90000);
    expect(initialBudget(r, 45250)).toBe(45500);
  });
});
