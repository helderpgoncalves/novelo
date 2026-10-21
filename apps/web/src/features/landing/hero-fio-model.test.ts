import { describe, expect, it } from 'vitest';
import { daysUntilDeadline } from './hero-deadline';
import { CAPTURED, FIO_MARKS, FIO_W, fioPointAt, GAP_MID, GAP_T } from './hero-fio-model';

describe('fio do hero', () => {
  it('o troço cheio acaba aos 11,5 % (301,3 t de ≈ 2 626 t gerados) e ≈ 2 325 t ainda vão para o lixo', () => {
    expect(CAPTURED).toBeCloseTo(0.1147, 3);
    expect(GAP_T).toBe(2325);
    expect(GAP_MID).toBeCloseTo(0.5574, 3);
  });

  it('as marcas seguem o fio da esquerda para a direita e a ponta fecha o viewBox', () => {
    const { solid, gap, end } = FIO_MARKS;
    expect(solid.x).toBeLessThan(gap.x);
    expect(gap.x).toBeLessThan(end.x);
    expect(end.x).toBeCloseTo(FIO_W, 5);
    expect(fioPointAt(0).x).toBeCloseTo(0, 5);
  });

  it('a fração é por comprimento de arco, não por largura', () => {
    // O fio começa quase plano e ondula: 11,5 % do comprimento cai perto de 11,9 % da largura, não nos 11,5 %.
    expect(FIO_MARKS.solid.x / FIO_W).toBeGreaterThan(0.116);
    expect(FIO_MARKS.solid.x / FIO_W).toBeLessThan(0.13);
  });
});

describe('prazo do regime europeu', () => {
  it('conta os dias até 17 abr 2028 e nunca é negativo', () => {
    expect(daysUntilDeadline(new Date(2026, 9, 21, 15, 30))).toBe(544);
    expect(daysUntilDeadline(new Date(2028, 3, 17))).toBe(0);
    expect(daysUntilDeadline(new Date(2029, 0, 1))).toBe(0);
  });
});
