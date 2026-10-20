import { describe, expect, it } from 'vitest';
import { newestFirst, stamp } from './recent';
import { eur, num, pct, tonnes } from './safe';

describe('formatadores seguros', () => {
  it('valores ausentes ou inválidos dão «—»', () => {
    for (const v of [undefined, null, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(num(v)).toBe('—');
      expect(tonnes(v)).toBe('—');
      expect(pct(v)).toBe('—');
      expect(eur(v)).toBe('—');
    }
  });
  it('números válidos usam o formato da app', () => {
    expect(tonnes(301.3, 1)).toMatch(/301[,.]3\s*t/);
    expect(num(0)).toBe('0');
  });
});

describe('newestFirst', () => {
  const list = [
    { id: 'old', at: '2026-01-01T10:00:00+00:00' },
    { id: 'none', at: '' },
    { id: 'new', at: '2026-10-20T16:28:35+00:00' },
    { id: 'bad', at: 'xx' },
  ];
  it('ordena por data e deixa inválidas no fim, sem rebentar', () => {
    expect(newestFirst(list, (x) => x.at).map((x) => x.id)).toEqual(['new', 'old', 'none', 'bad']);
    expect(stamp(null)).toBe(Number.NEGATIVE_INFINITY);
  });
});
