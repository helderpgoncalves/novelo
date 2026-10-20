import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Overview } from '@/client';
import { SituationStrip } from './situation-strip';

const overview = (date: string | null | undefined) =>
  ({
    gap: {
      year: 2025,
      collected_t: 301.3,
      capture_pct: 22.9,
      missing_t: 1016,
      potential_t: 1317,
      potential_kg_per_inhab_month: 0.7,
    },
    timeline: [{ who_pays: 'producers', date, source_label: 'X', verified: true }],
  }) as unknown as Overview;

describe('SituationStrip', () => {
  it('mostra os quatro números', () => {
    render(<SituationStrip overview={overview('2028-04-17')} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText(/301[,.]3/)).toBeTruthy();
  });
  it('datas vazias ou inválidas não rebentam', () => {
    for (const d of ['', 'xx', null, undefined]) {
      const { unmount } = render(<SituationStrip overview={overview(d)} />);
      expect(screen.getAllByRole('listitem')).toHaveLength(4);
      unmount();
    }
  });
  it('números inválidos dão «—»', () => {
    const o = overview('2028-04-17');
    (o.gap as { missing_t: number }).missing_t = Number.NaN;
    render(<SituationStrip overview={o} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
