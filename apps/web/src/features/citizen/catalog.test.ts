import { describe, expect, it } from 'vitest';
import type { CatalogItemPublic, RedemptionOut } from '@/client';
import {
  catalogItemKindLabel,
  donationValueNote,
  redeemBlocked,
  redemptionStateLabel,
} from './catalog';

const item = (over: Partial<CatalogItemPublic>): CatalogItemPublic => ({
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Cesto alimentar',
  kind: 'ipss_donation',
  points_cost: 300,
  donation_value_cents: 150,
  partner_name: null,
  description: null,
  stock: null,
  ...over,
});

describe('catalogItemKindLabel', () => {
  it('traduz as três prateleiras do catálogo em pt-PT', () => {
    expect(catalogItemKindLabel('ipss_donation')).toBe('Donativo IPSS');
    expect(catalogItemKindLabel('partner_prize')).toBe('Prémio de parceiro');
    expect(catalogItemKindLabel('environmental')).toBe('Acumulado ambiental');
  });
});

describe('donationValueNote', () => {
  it('mostra a âncora € como VALOR DO DONATIVO, nunca como valor dos pontos', () => {
    // 1 000 pontos ≈ 5 € é o valor do donativo que a Vitrus paga — a âncora é apresentação.
    // (O valor vem em cêntimos: duas casas sempre, e o Intl usa espaço inquebrável antes do €.)
    expect(donationValueNote(item({ donation_value_cents: 500 }))).toBe('donativo de 5,00\u00A0€');
    expect(donationValueNote(item({ donation_value_cents: 150 }))).toBe('donativo de 1,50\u00A0€');
  });
});

describe('redeemBlocked', () => {
  it('bloqueia por saldo insuficiente, dizendo o que falta', () => {
    expect(redeemBlocked(item({ points_cost: 300 }), 250)).toBe('Faltam 50 pontos');
  });

  it('bloqueia esgotado (stock a zero) mesmo com saldo de sobra', () => {
    expect(redeemBlocked(item({ stock: 0, points_cost: 100 }), 1000)).toBe('Esgotado');
  });

  it('não bloqueia com saldo e stock, e não diz nada sem limite de stock', () => {
    expect(redeemBlocked(item({ points_cost: 300, stock: 3 }), 300)).toBeNull();
    expect(redeemBlocked(item({ points_cost: 300, stock: null }), 300)).toBeNull();
  });

  it('o esgotado ganha ao saldo (motivo mais concreto primeiro)', () => {
    expect(redeemBlocked(item({ stock: 0, points_cost: 500 }), 10)).toBe('Esgotado');
  });
});

describe('redemptionStateLabel', () => {
  it('traduz o estado do código', () => {
    const base = {
      id: 'x',
      code: 'RDM-ABC234',
      points_spent: 50,
      validated_at: null,
      created_at: '',
    } as Partial<RedemptionOut>;
    expect(redemptionStateLabel({ ...(base as RedemptionOut), state: 'pending' })).toBe('pendente');
    expect(redemptionStateLabel({ ...(base as RedemptionOut), state: 'validated' })).toBe(
      'validado',
    );
  });
});
