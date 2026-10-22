import type { ScenarioOut } from '@/client';
import { summarizePlan } from '@/features/scenarios/collection-plan';

export interface PlanChannels {
  /** Saco fechado à porta, numa ronda da viatura nova de têxtil (sem compactação). */
  doorBag: { parishes: number; tonnes: number; km: number; everyWeeks: number | null };
  /** Locais onde já há contentores municipais e escolas (sem contentor novo), na mesma viatura. */
  existing: { points: number; zones: number; tonnes: number };
  /** A viatura dedicada: quantas, dias por semana e investimento (nulos nos cenários antigos). */
  vehicle: { vehicles: number; daysPerWeek: number; capexEur: number };
}

/** Resume o plano da viatura dedicada de um cenário pelos canais da rede sem contentores. Só soma o que a API devolve. */
export function planChannels(scenario: Pick<ScenarioOut, 'result'>): PlanChannels {
  const plan = summarizePlan(scenario.result.collection_plan ?? []);
  const existing = scenario.result.modes.find((x) => x.mode === 'existing');
  const { kpis } = scenario.result;
  return {
    doorBag: {
      parishes: plan.doorBag.parishes,
      tonnes: plan.doorBag.tonnes,
      km: plan.doorBag.km,
      everyWeeks: plan.everyWeeks,
    },
    existing: {
      points: existing?.points ?? 0,
      zones: existing?.zones ?? 0,
      tonnes: existing?.tonnes ?? 0,
    },
    vehicle: {
      vehicles: kpis.vehicles ?? 0,
      daysPerWeek: kpis.vehicle_days_week ?? 0,
      capexEur: kpis.vehicle_capex_eur ?? 0,
    },
  };
}
