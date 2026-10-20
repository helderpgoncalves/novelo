import { describe, expect, it } from 'vitest';
import { announceMark, formatCountdown, secondsUntil } from './countdown';

describe('secondsUntil', () => {
  const now = Date.parse('2026-10-20T12:00:00Z');

  it('conta os segundos que faltam, arredondando para cima', () => {
    expect(secondsUntil('2026-10-20T12:30:00Z', now)).toBe(1800);
    expect(secondsUntil('2026-10-20T12:00:00.400Z', now)).toBe(1);
  });

  it('nunca é negativo e chega a zero no fim', () => {
    expect(secondsUntil('2026-10-20T12:00:00Z', now)).toBe(0);
    expect(secondsUntil('2026-10-20T11:00:00Z', now)).toBe(0);
  });

  it('sem data (ou inválida) devolve null, para a faixa não expirar por engano', () => {
    expect(secondsUntil(null, now)).toBeNull();
    expect(secondsUntil(undefined, now)).toBeNull();
    expect(secondsUntil('não é uma data', now)).toBeNull();
  });
});

describe('formatCountdown', () => {
  it('mm:ss com zeros à esquerda', () => {
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(59)).toBe('00:59');
    expect(formatCountdown(61)).toBe('01:01');
    expect(formatCountdown(1799)).toBe('29:59');
  });

  it('passa a h:mm:ss quando chega à hora', () => {
    expect(formatCountdown(3600)).toBe('1:00:00');
    expect(formatCountdown(3725)).toBe('1:02:05');
  });

  it('ignora negativos e frações', () => {
    expect(formatCountdown(-5)).toBe('00:00');
    expect(formatCountdown(10.9)).toBe('00:10');
  });
});

describe('announceMark', () => {
  it('só avisa nos marcos de 5 min, 1 min e 30 s', () => {
    expect(announceMark(null)).toBeNull();
    expect(announceMark(1800)).toBeNull();
    expect(announceMark(301)).toBeNull();
    expect(announceMark(300)).toBe(300);
    expect(announceMark(120)).toBe(300);
    expect(announceMark(60)).toBe(60);
    expect(announceMark(31)).toBe(60);
    expect(announceMark(30)).toBe(30);
    expect(announceMark(0)).toBe(30);
  });
});
