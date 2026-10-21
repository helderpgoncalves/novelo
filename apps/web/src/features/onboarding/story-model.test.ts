import { describe, expect, it } from 'vitest';
import type { CollectionPlanEntry } from '@/client';
import {
  clampStory,
  daysUntil,
  pickOnboardingReference,
  pickSitesReference,
  planLines,
  STORY_STEPS,
  STORY_TOTAL,
  storyKeyAction,
  waffle,
} from './story-model';

describe('apresentação: passos', () => {
  it('são seis, pela ordem da história', () => {
    expect(STORY_STEPS).toEqual(['problem', 'where', 'answer', 'cost', 'copilot', 'pilot']);
    expect(STORY_TOTAL).toBe(6);
  });

  it('o índice fica sempre dentro dos passos (progresso antigo, valores estranhos)', () => {
    expect(clampStory(8)).toBe(5);
    expect(clampStory(-1)).toBe(0);
    expect(clampStory(Number.NaN)).toBe(0);
    expect(clampStory(2.7)).toBe(2);
  });
});

describe('apresentação: teclado', () => {
  it('→ avança e ← recua, sem dar a volta', () => {
    expect(storyKeyAction('ArrowRight', 0)).toEqual({ type: 'go', index: 1 });
    expect(storyKeyAction('ArrowLeft', 3)).toEqual({ type: 'go', index: 2 });
    expect(storyKeyAction('ArrowLeft', 0)).toBeNull();
    expect(storyKeyAction('ArrowRight', 5)).toBeNull();
  });

  it('Home e End vão ao primeiro e ao último', () => {
    expect(storyKeyAction('Home', 4)).toEqual({ type: 'go', index: 0 });
    expect(storyKeyAction('End', 1)).toEqual({ type: 'go', index: 5 });
    expect(storyKeyAction('Home', 0)).toBeNull();
    expect(storyKeyAction('End', 5)).toBeNull();
  });

  it('Esc fecha em qualquer passo', () => {
    expect(storyKeyAction('Escape', 0)).toEqual({ type: 'close' });
    expect(storyKeyAction('Escape', 5)).toEqual({ type: 'close' });
  });

  it('com modificadores (atalhos do sistema) não faz nada; outras teclas também não', () => {
    expect(storyKeyAction('ArrowRight', 1, { alt: true })).toBeNull();
    expect(storyKeyAction('ArrowLeft', 1, { meta: true })).toBeNull();
    expect(storyKeyAction('Escape', 1, { ctrl: true })).toBeNull();
    expect(storyKeyAction('Enter', 1)).toBeNull();
    expect(storyKeyAction('Tab', 1)).toBeNull();
  });
});

describe('apresentação: dias até ao prazo RAP (17 abr 2028)', () => {
  it('conta dias de calendário em datas locais, à mão', () => {
    // 21 out 2026 → 17 abr 2028: 10 + 30 + 31 (2026) + 365 (2027) + 31 + 29 + 31 + 17 (2028) = 544
    expect(daysUntil(new Date(2026, 9, 21, 23, 59))).toBe(544);
    expect(daysUntil(new Date(2026, 9, 21, 0, 1))).toBe(544);
    // 2028 é bissexto: 1 mar 2028 → 17 abr = 30 + 17 = 47
    expect(daysUntil(new Date(2028, 2, 1))).toBe(47);
    expect(daysUntil(new Date(2028, 3, 16))).toBe(1);
  });

  it('no próprio dia e depois é 0', () => {
    expect(daysUntil(new Date(2028, 3, 17, 12))).toBe(0);
    expect(daysUntil(new Date(2029, 0, 1))).toBe(0);
  });
});

const ref = (
  reference_key: string | null,
  extra: Partial<{ onboarding: boolean; status: 'computed' | 'infeasible' }> = {},
) => ({
  reference_key,
  onboarding: false,
  status: 'computed' as const,
  ...extra,
});

describe('apresentação: cenário de referência', () => {
  it('escolhe o «parish:60000» mesmo que outro esteja marcado', () => {
    const refs = [ref('sites:60000', { onboarding: true }), ref('parish:60000')];
    expect(pickOnboardingReference(refs)?.reference_key).toBe('parish:60000');
  });

  it('sem a chave, usa o marcado `onboarding`', () => {
    expect(
      pickOnboardingReference([ref('sites:20000'), ref('x', { onboarding: true })])?.reference_key,
    ).toBe('x');
  });

  it('lista vazia (ainda a calcular) ou só por calcular: nenhum', () => {
    expect(pickOnboardingReference([])).toBeNull();
    expect(pickOnboardingReference(undefined)).toBeNull();
    expect(pickOnboardingReference([ref('parish:60000', { status: 'infeasible' })])).toBeNull();
  });

  it('o exemplo do Copiloto usa os de locais reais pelo orçamento', () => {
    const refs = [ref('sites:40000'), ref('parish:60000'), ref('sites:60000')];
    expect(pickSitesReference(refs, 40_000)?.reference_key).toBe('sites:40000');
    expect(pickSitesReference(refs, 100_000)).toBeNull();
  });
});

const entry = (p: Partial<CollectionPlanEntry>): CollectionPlanEntry => ({
  channel: 'door_to_door',
  circuit: 'C1',
  crew: 3,
  fits_capacity: null,
  kg_per_round: 100,
  new_km_year: 0,
  parish_code: '0',
  parish_name: 'X',
  pickups_year: 10,
  round_kg: 100,
  tonnes_year: 1,
  vehicle: 'AA-00-AA',
  weekday: 1,
  ...p,
});

describe('apresentação: linhas do plano', () => {
  it('só porta a porta completas, das que mais desviam, até ao limite', () => {
    const plan = [
      entry({ parish_name: 'Ponte', tonnes_year: 13.85, circuit: 'C14', weekday: 2 }),
      entry({ parish_name: 'Creixomil', tonnes_year: 20.1, circuit: 'C14', vehicle: 'BD-86-EN' }),
      entry({ parish_name: 'Sem viatura', tonnes_year: 99, vehicle: null }),
      entry({ parish_name: 'Desvio', tonnes_year: 50, channel: 'detour' }),
      entry({ parish_name: 'Caldelas', tonnes_year: 13.05 }),
      entry({ parish_name: 'Brito', tonnes_year: 9.9 }),
    ];
    expect(planLines(plan).map((l) => l.parish)).toEqual(['Creixomil', 'Ponte', 'Caldelas']);
    expect(planLines(plan)[0]).toEqual({
      parish: 'Creixomil',
      circuit: 'C14',
      weekday: 1,
      vehicle: 'BD-86-EN',
      tonnes: 20.1,
    });
    expect(planLines(null)).toEqual([]);
  });
});

describe('apresentação: grelha de 100 pontos', () => {
  it('11,5% → 11 cheios e um a meio', () => {
    const w = waffle(11.5);
    expect(w.full).toBe(11);
    expect(w.partial).toBeCloseTo(0.5, 9);
  });

  it('inteiros e limites', () => {
    expect(waffle(12)).toEqual({ full: 12, partial: 0 });
    expect(waffle(0)).toEqual({ full: 0, partial: 0 });
    expect(waffle(100)).toEqual({ full: 100, partial: 0 });
    expect(waffle(140)).toEqual({ full: 100, partial: 0 });
    expect(waffle(-3)).toEqual({ full: 0, partial: 0 });
  });
});
