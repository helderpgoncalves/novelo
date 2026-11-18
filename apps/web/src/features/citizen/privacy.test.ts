import { describe, expect, it } from 'vitest';
import type {
  DeletionPreviewOut,
  NoveloFeaturesPrivacySchemasTimelineItem as TimelineItem,
} from '@/client';
import { losses, timelineRows } from '@/features/citizen/privacy';

/** Datas fixas: a formatação pt-PT não pode depender do relógio do teste. */
const JUNHO = '2027-06-10T10:00:00Z';
const DEZEMBRO = '2027-12-25T10:00:00Z';

function preview(overrides: Partial<DeletionPreviewOut> = {}): DeletionPreviewOut {
  return {
    balance: {
      balance: 150,
      flat: 100,
      bonus: 50,
      expiring_soon: 0,
      expired: 0,
      monthly_cap: 500,
      credited_this_month: 0,
    },
    timeline: [],
    active_bags: 1,
    bags: 2,
    requests: 1,
    points_entries: 3,
    points_are_not_money: true,
    redeem_hint_path: '/cidadao?tab=saldo',
    ...overrides,
  };
}

describe('losses', () => {
  it('lists the balance first, with the exact points', () => {
    const rows = losses(preview());
    expect(rows[0]).toContain('150');
    expect(rows[0]).toContain('pontos');
  });

  it('mentions bags, requests and history with the real counts', () => {
    const rows = losses(preview({ active_bags: 2, bags: 5, requests: 3, points_entries: 12 }));
    const joined = rows.join(' ');
    expect(joined).toContain('5'); // sacos (2 ativos de 5)
    expect(joined).toContain('3'); // pedidos
    expect(joined).toContain('12'); // movimentos
  });

  it('never hides that points are not money', () => {
    expect(losses(preview()).join(' ')).toContain('não são dinheiro');
  });
});

describe('timelineRows', () => {
  const items: TimelineItem[] = [
    { expires_at: JUNHO, amount: 100 },
    { expires_at: DEZEMBRO, amount: 50 },
  ];

  it('renders one row per expiry, oldest first, with date and amount', () => {
    const rows = timelineRows(items);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.amount).toBe(100);
    expect(rows[1]?.amount).toBe(50);
    expect(rows[0]?.when).toMatch(/10.*2027/); // dia + ano no rótulo pt-PT
    expect(rows[1]?.when).toMatch(/25.*2027/);
  });

  it('keeps an empty timeline empty (zero balance)', () => {
    expect(timelineRows([])).toEqual([]);
  });
});
