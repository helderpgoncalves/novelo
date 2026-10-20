import { describe, expect, it } from 'vitest';
import {
  angleFromMatrix,
  appearance,
  clampWait,
  classifyGesture,
  degreesToAlign,
  isArmed,
  PULL_MAX,
  PULL_THRESHOLD,
  progressOf,
  rawForPull,
  rawFromDelta,
  resist,
} from './pull-to-refresh-math';

describe('resistência elástica', () => {
  it('começa em zero e nunca devolve valores negativos ou inválidos', () => {
    expect(resist(0)).toBe(0);
    expect(resist(-30)).toBe(0);
    expect(resist(Number.NaN)).toBe(0);
  });

  it('é crescente, sempre abaixo do dedo e nunca passa do máximo', () => {
    // 160 * (1 - 1 / (80 / 160 + 1)) = 160 * (1 - 2/3) = 53,33
    expect(resist(80)).toBeCloseTo(53.333, 2);
    expect(resist(80)).toBeLessThan(80);
    expect(resist(200)).toBeGreaterThan(resist(100));
    expect(resist(100_000)).toBeLessThan(PULL_MAX);
  });

  it('a inversa devolve o dedo necessário para o limiar', () => {
    // 72 -> 160 * (1 / (1 - 0,45) - 1) = 160 * 0,81818 = 130,909
    expect(rawForPull(PULL_THRESHOLD)).toBeCloseTo(130.909, 2);
    expect(resist(rawForPull(PULL_THRESHOLD))).toBeCloseTo(PULL_THRESHOLD, 6);
  });
});

describe('limiar e aparência', () => {
  it('arma só ao atingir o limiar', () => {
    expect(isArmed(PULL_THRESHOLD - 0.1)).toBe(false);
    expect(isArmed(PULL_THRESHOLD)).toBe(true);
  });

  it('progresso 0..1 e escala/opacidade de 0,4 a 1', () => {
    expect(progressOf(0)).toBe(0);
    expect(progressOf(36)).toBe(0.5);
    expect(progressOf(500)).toBe(1);
    expect(appearance(0)).toEqual({ scale: 0.4, opacity: 0.4 });
    expect(appearance(36).scale).toBeCloseTo(0.7, 6);
    expect(appearance(500)).toEqual({ scale: 1, opacity: 1 });
  });
});

describe('leitura do gesto', () => {
  it('espera por movimento suficiente', () => {
    expect(classifyGesture(2, 5)).toBe('pending');
  });

  it('puxar = para baixo com o eixo vertical a dominar', () => {
    expect(classifyGesture(2, 12)).toBe('pull');
    expect(classifyGesture(-4, 14)).toBe('pull');
  });

  it('para cima, na horizontal ou na diagonal deixa a rolagem normal', () => {
    expect(classifyGesture(0, -14)).toBe('ignore');
    expect(classifyGesture(20, 4)).toBe('ignore');
    expect(classifyGesture(12, 14)).toBe('ignore');
  });

  it('desconta a folga usada a decidir', () => {
    expect(rawFromDelta(5)).toBe(0);
    expect(rawFromDelta(30)).toBe(22);
  });
});

describe('tempo de espera', () => {
  it('mantém entre o mínimo e o máximo', () => {
    expect(clampWait(100, 600, 8000)).toBe(600);
    expect(clampWait(2000, 600, 8000)).toBe(2000);
    expect(clampWait(20_000, 600, 8000)).toBe(8000);
  });
});

describe('alinhamento dos arcos', () => {
  it('lê o ângulo de uma matriz de rotação', () => {
    expect(angleFromMatrix('none')).toBe(0);
    expect(angleFromMatrix('matrix(0, 1, -1, 0, 0, 0)')).toBeCloseTo(90, 6);
    expect(angleFromMatrix('matrix(0, -1, 1, 0, 0, 0)')).toBeCloseTo(-90, 6);
  });

  it('calcula quanto falta rodar até 0° no sentido do arco', () => {
    expect(degreesToAlign(90, 1)).toBe(270);
    expect(degreesToAlign(-90, 1)).toBe(90);
    expect(degreesToAlign(90, -1)).toBe(-90);
    expect(degreesToAlign(0, 1)).toBe(0);
  });
});
