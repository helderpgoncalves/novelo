import { describe, expect, it } from 'vitest';
import type { BagActivationOut, CollectionHistoryOut } from '@/client';
import { bagsAtHome, milestones, onboardingCollapsed } from './onboarding';

const bag = (over: Partial<BagActivationOut>): BagActivationOut => ({
  id: 'b1',
  code: 'NVL-A2B3C4',
  nickname: null,
  declaration: null,
  declared_at: null,
  active: true,
  created_at: '2026-11-17T10:00:00Z',
  ...over,
});

const historyRow = (over: Partial<CollectionHistoryOut>): CollectionHistoryOut => ({
  bag_id: 'b1',
  bag_code: 'NVL-A2B3C4',
  nickname: null,
  declaration: null,
  activated_at: '2026-11-17T10:00:00Z',
  lot_code: null,
  lot_state: null,
  weight_kg: null,
  collected_at: null,
  ...over,
});

describe('milestones', () => {
  it('conta nova: nenhum marco feito', () => {
    const list = milestones([], []);
    expect(list.map((m) => m.done)).toEqual([false, false, false]);
    expect(list.map((m) => m.id)).toEqual(['saco', 'declaracao', 'recolha']);
  });

  it('ativar saco marca o primeiro; declarar marca o segundo', () => {
    expect(milestones([bag({})], [])[0]?.done).toBe(true);
    expect(milestones([bag({})], [])[1]?.done).toBe(false);
    expect(milestones([bag({ declaration: 'reuse' })], [])[1]?.done).toBe(true);
  });

  it('a 1.ª recolha marca o terceiro e colapsa o onboarding', () => {
    const history = [historyRow({ lot_code: 'NOV-ABC123' })];
    expect(milestones([bag({})], history)[2]?.done).toBe(true);
    expect(onboardingCollapsed(history)).toBe(true);
  });

  it('saco ativado mas ainda em casa não colapsa o onboarding', () => {
    expect(onboardingCollapsed([historyRow({})])).toBe(false);
  });
});

describe('bagsAtHome', () => {
  it('exclui os sacos já recolhidos e fica com os que estão em casa', () => {
    const bags = [bag({ id: 'b1', code: 'NVL-AAAAAA' }), bag({ id: 'b2', code: 'NVL-BBBBBB' })];
    const history = [
      historyRow({ bag_code: 'NVL-AAAAAA', lot_code: 'NOV-ABC123' }),
      historyRow({ bag_code: 'NVL-BBBBBB', lot_code: null }),
    ];
    expect(bagsAtHome(bags, history).map((b) => b.code)).toEqual(['NVL-BBBBBB']);
  });
});
