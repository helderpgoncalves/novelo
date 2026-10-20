import { describe, expect, it } from 'vitest';
import { type FioOptions, fioLayout } from './fio-model';

const opts: FioOptions = {
  width: 900,
  band: 200,
  nodeW: 10,
  columns: [0, 300, 700],
  gap: 12,
  minNode: 8,
};
const input = { potentialT: 1000, collectedT: 250, reuseT: 150, recycleT: 70, rejectT: 30 };

describe('fioLayout', () => {
  const l = fioLayout(input, opts);
  const node = (id: string) => {
    const n = l.nodes.find((x) => x.id === id);
    if (!n) throw new Error(id);
    return n;
  };
  it('as alturas são proporcionais às toneladas', () => {
    expect(node('potential').h).toBe(200);
    expect(node('collected').h).toBeCloseTo(50, 9);
    expect(node('missing').h).toBeCloseTo(150, 9);
    expect(node('collected').h + node('missing').h).toBeCloseTo(node('potential').h, 9);
  });
  it('os destinos somam as percentagens do recolhido', () => {
    const pct = ['reuse', 'recycle', 'reject'].map((id) => node(id).pct);
    expect(pct[0]).toBeCloseTo(60, 9);
    expect(pct.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 9);
  });
  it('um destino muito fino ganha altura mínima', () => {
    expect(node('reject').h).toBeGreaterThanOrEqual(8);
  });
  it('há uma fita por nó de chegada e o fio solto fica sob o recolhido', () => {
    expect(l.ribbons.map((r) => r.to).sort()).toEqual(
      ['collected', 'missing', 'recycle', 'reject', 'reuse'].sort(),
    );
    expect(l.loose.y0).toBeGreaterThan(node('collected').h);
    expect(l.height).toBeGreaterThan(node('potential').h * 0.99);
  });
  it('o recolhido nunca passa do potencial', () => {
    const over = fioLayout({ ...input, collectedT: 5000 }, opts);
    expect(over.nodes.find((n) => n.id === 'missing')?.h).toBe(0);
  });
});
