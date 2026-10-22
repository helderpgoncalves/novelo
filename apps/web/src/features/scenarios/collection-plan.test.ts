import { afterEach, describe, expect, it } from 'vitest';
import type { CollectionPlanEntry } from '@/client';
import { overwriteGetLocale } from '@/paraglide/runtime';
import { doorBagByParish, planWeekday, planWeekdayTitle, summarizePlan } from './collection-plan';

afterEach(() => overwriteGetLocale(() => 'pt-PT'));

/** Saco fechado à porta, numa ronda da viatura dedicada a cada 2 semanas. */
const door = (over: Partial<CollectionPlanEntry> = {}): CollectionPlanEntry => ({
  parish_code: '030813',
  parish_name: 'Creixomil',
  channel: 'on_demand',
  weekday: 1,
  vehicle: 1,
  every_weeks: 2,
  rounds_year: 26,
  trips_per_round: 1,
  stops_year: 1040,
  tonnes_year: 26,
  kg_per_round: 1000,
  km_year: 400,
  hours_year: 50,
  ...over,
});

/** Paragens nos locais (pontos existentes). */
const site = (over: Partial<CollectionPlanEntry> = {}): CollectionPlanEntry => ({
  ...door(),
  parish_code: '030807',
  parish_name: 'Brito',
  channel: 'existing',
  trips_per_round: null,
  stops_year: 52,
  tonnes_year: 4,
  kg_per_round: 153.8,
  km_year: 120.5,
  hours_year: 12,
  ...over,
});

describe('planWeekday', () => {
  it('1 = segunda ... 7 = domingo, sem o «-feira»', () => {
    expect(planWeekday(1)).toBe('segunda');
    expect(planWeekday(3)).toBe('quarta');
    expect(planWeekday(6)).toBe('sábado');
    expect(planWeekday(7)).toBe('domingo');
    expect(planWeekdayTitle(1)).toBe('Segunda');
  });

  it('em inglês usa o nome do dia', () => {
    overwriteGetLocale(() => 'en');
    expect(planWeekday(1)).toBe('Monday');
    expect(planWeekday(7)).toBe('Sunday');
  });

  it('sem dia ou fora de 1 a 7 dá nulo', () => {
    expect(planWeekday(null)).toBeNull();
    expect(planWeekday(undefined)).toBeNull();
    expect(planWeekday(0)).toBeNull();
    expect(planWeekday(8)).toBeNull();
    expect(planWeekday(1.5)).toBeNull();
    expect(planWeekdayTitle(null)).toBeNull();
  });
});

describe('summarizePlan', () => {
  it('soma por canal só a partir do resultado e conta cada freguesia uma vez', () => {
    const plan = [
      door(),
      door({ parish_code: '030838', parish_name: 'Ponte', weekday: 2, tonnes_year: 13.8 }),
      door({ parish_code: '030810', vehicle: 2, tonnes_year: 13.2 }),
      site(),
      site({ parish_code: '030813', km_year: 79.5, tonnes_year: 2.5 }),
    ];
    const s = summarizePlan(plan);
    expect(s.doorBag.parishes).toBe(3);
    expect(s.doorBag.tonnes).toBeCloseTo(53, 6);
    expect(s.doorBag.km).toBe(1200);
    expect(s.sites).toEqual({ parishes: 2, tonnes: 6.5, km: 200, hours: 24 });
    expect(s.everyWeeks).toBe(2);
    expect(s.vehicles).toBe(2);
  });

  it('plano vazio ou só com locais: sem porta a porta', () => {
    expect(summarizePlan([]).everyWeeks).toBeNull();
    const s = summarizePlan([site()]);
    expect(s.doorBag.parishes).toBe(0);
    expect(s.everyWeeks).toBeNull();
  });
});

describe('doorBagByParish', () => {
  it('só as freguesias com saco à porta, por código', () => {
    const map = doorBagByParish([door(), site()]);
    expect([...map.keys()]).toEqual(['030813']);
    expect(map.get('030813')?.weekday).toBe(1);
    expect(doorBagByParish(null).size).toBe(0);
  });
});
