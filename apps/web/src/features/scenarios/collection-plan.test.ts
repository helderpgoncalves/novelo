import { afterEach, describe, expect, it } from 'vitest';
import type { CollectionPlanEntry } from '@/client';
import { overwriteGetLocale } from '@/paraglide/runtime';
import {
  doorToDoorByParish,
  fitsState,
  planWeekday,
  planWeekdayTitle,
  summarizePlan,
} from './collection-plan';

afterEach(() => overwriteGetLocale(() => 'pt-PT'));

const pap = (over: Partial<CollectionPlanEntry> = {}): CollectionPlanEntry => ({
  parish_code: '030813',
  parish_name: 'Creixomil',
  channel: 'door_to_door',
  circuit: 'C14',
  circuits: ['C14'],
  weekday: 1,
  vehicle: 'BD-86-EN',
  crew: 3,
  new_km_year: 0,
  tonnes_year: 20.1,
  pickups_year: 1340,
  kg_per_round: 386.5,
  round_kg: 386.5,
  fits_capacity: null,
  ...over,
});

const detour = (over: Partial<CollectionPlanEntry> = {}): CollectionPlanEntry => ({
  ...pap(),
  parish_code: '030807',
  parish_name: 'Brito',
  channel: 'detour',
  circuit: null,
  circuits: [],
  weekday: null,
  vehicle: null,
  crew: null,
  new_km_year: 120.5,
  tonnes_year: 4,
  kg_per_round: null,
  round_kg: null,
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

describe('fitsState', () => {
  it('nulo é «por validar» no circuito porta a porta e não se aplica com desvio', () => {
    expect(fitsState(pap())).toBe('unknown');
    expect(fitsState(pap({ fits_capacity: true }))).toBe('yes');
    expect(fitsState(pap({ fits_capacity: false }))).toBe('no');
    expect(fitsState(detour())).toBe('na');
  });
});

describe('summarizePlan', () => {
  it('soma por canal só a partir do resultado', () => {
    const plan = [
      pap(),
      pap({ parish_code: '030838', parish_name: 'Ponte', weekday: 2, tonnes_year: 13.8 }),
      pap({ parish_code: '030810', parish_name: 'Caldelas', circuit: 'C11', tonnes_year: 13.1 }),
      detour(),
      detour({ parish_code: '030812', new_km_year: 79.5, tonnes_year: 2.5 }),
    ];
    const s = summarizePlan(plan);
    expect(s.doorToDoor.parishes).toBe(3);
    expect(s.doorToDoor.tonnes).toBeCloseTo(47, 6);
    expect(s.doorToDoor.newKm).toBe(0);
    expect(s.detour).toEqual({ parishes: 2, tonnes: 6.5, newKm: 200 });
  });

  it('a ronda mais carregada e as rondas por validar contam cada (circuito, dia) uma vez', () => {
    const plan = [
      pap({ round_kg: 500, fits_capacity: null }),
      pap({ parish_code: 'x', round_kg: 500, fits_capacity: null }),
      pap({ parish_code: 'y', weekday: 2, round_kg: 4200, fits_capacity: false }),
      pap({ parish_code: 'z', circuit: 'C11', round_kg: 100, fits_capacity: true }),
    ];
    const s = summarizePlan(plan);
    expect(s.maxRoundKg).toBe(4200);
    expect(s.roundsUnknown).toBe(1);
    expect(s.roundsOver).toBe(1);
  });

  it('plano vazio ou só com desvio: sem rondas', () => {
    expect(summarizePlan([]).maxRoundKg).toBeNull();
    const s = summarizePlan([detour()]);
    expect(s.doorToDoor.parishes).toBe(0);
    expect(s.maxRoundKg).toBeNull();
  });
});

describe('doorToDoorByParish', () => {
  it('só as freguesias no circuito porta a porta, por código', () => {
    const map = doorToDoorByParish([pap(), detour()]);
    expect([...map.keys()]).toEqual(['030813']);
    expect(map.get('030813')?.circuit).toBe('C14');
  });

  it('cenários antigos (sem plano) dão um mapa vazio', () => {
    expect(doorToDoorByParish(null).size).toBe(0);
    expect(doorToDoorByParish(undefined).size).toBe(0);
  });
});
