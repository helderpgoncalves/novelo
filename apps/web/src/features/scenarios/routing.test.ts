import { describe, expect, it } from 'vitest';
import { followsRoads, formatDuration, isRoadRoute, routingOf, routingText } from './routing';

describe('formatDuration', () => {
  it('mostra traço sem medição', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
    expect(formatDuration(Number.NaN)).toBe('—');
  });
  it('formata minutos e horas', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(42.4)).toBe('42 min');
    expect(formatDuration(60)).toBe('1 h 00 min');
    expect(formatDuration(125.6)).toBe('2 h 06 min');
  });
});

describe('routing', () => {
  it('cenários antigos contam como estimativa', () => {
    expect(routingOf({})).toBe('estimate');
    expect(routingOf({ routing: 'road' })).toBe('road');
  });
  it('distingue origem e traçado', () => {
    expect(isRoadRoute({ source: 'road' })).toBe(true);
    expect(isRoadRoute({})).toBe(false);
    expect(followsRoads({ road_path: true })).toBe(true);
    expect(followsRoads({})).toBe(false);
  });
  it('escolhe um texto diferente por origem', () => {
    const texts = new Set((['road', 'mixed', 'estimate'] as const).map(routingText));
    expect(texts.size).toBe(3);
  });
});
