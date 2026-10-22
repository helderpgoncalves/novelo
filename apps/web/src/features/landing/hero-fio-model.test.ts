import { describe, expect, it } from 'vitest';
import { daysUntilDeadline } from './hero-deadline';
import { CAPTURED, FIO_MARKS, FIO_W, fioPointAt, GAP_MID, GAP_T } from './hero-fio-model';

describe('fio do hero', () => {
  it('o troço cheio acaba aos 9,1 % (301,3 t de ≈ 3 305 t gerados) e ≈ 3 003 t ainda vão para o lixo', () => {
    // 43 050,5 ÷ 0,840 × 5,86 % = 3 003,28 t; 301,27 ÷ (3 003,28 + 301,27) = 0,0912.
    expect(CAPTURED).toBeCloseTo(0.0912, 3);
    expect(GAP_T).toBe(3003);
    expect(GAP_MID).toBeCloseTo(0.5456, 3);
  });

  it('as marcas seguem o fio da esquerda para a direita e a ponta fecha o viewBox', () => {
    const { solid, gap, end } = FIO_MARKS;
    expect(solid.x).toBeLessThan(gap.x);
    expect(gap.x).toBeLessThan(end.x);
    expect(end.x).toBeCloseTo(FIO_W, 5);
    expect(fioPointAt(0).x).toBeCloseTo(0, 5);
  });

  it('a fração é por comprimento de arco, não por largura', () => {
    // O fio começa quase plano e ondula: 9,1 % do comprimento cai perto de 9,4 % da largura, não nos 9,1 %.
    expect(FIO_MARKS.solid.x / FIO_W).toBeGreaterThan(CAPTURED);
    expect(FIO_MARKS.solid.x / FIO_W).toBeGreaterThan(0.092);
    expect(FIO_MARKS.solid.x / FIO_W).toBeLessThan(0.11);
  });
});

describe('prazo do regime europeu', () => {
  it('conta os dias até 17 abr 2028 e nunca é negativo', () => {
    expect(daysUntilDeadline(new Date(2026, 9, 21, 15, 30))).toBe(544);
    expect(daysUntilDeadline(new Date(2028, 3, 17))).toBe(0);
    expect(daysUntilDeadline(new Date(2029, 0, 1))).toBe(0);
  });
});
