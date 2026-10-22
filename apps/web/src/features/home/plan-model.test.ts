import { describe, expect, it } from 'vitest';
import type { CollectionPlanEntry, ScenarioOut } from '@/client';
import { planChannels } from './plan-model';

const entry = (over: Partial<CollectionPlanEntry>): CollectionPlanEntry => ({
  channel: 'on_demand',
  every_weeks: 2,
  hours_year: 30,
  kg_per_round: 100,
  km_year: 200,
  parish_code: '030801',
  parish_name: 'Aldão',
  rounds_year: 26,
  stops_year: 104,
  tonnes_year: 10,
  trips_per_round: 1,
  vehicle: 1,
  weekday: 1,
  ...over,
});

const scenario = (plan: CollectionPlanEntry[] | null, existing?: number) =>
  ({
    result: {
      collection_plan: plan,
      kpis: plan ? { vehicles: 1, vehicle_days_week: 2.5, vehicle_capex_eur: 42_500 } : {},
      modes: existing
        ? [{ mode: 'existing', zones: 3, points: existing, tonnes: 42, annual_cost_eur: 1 }]
        : [],
    },
  }) as unknown as Pick<ScenarioOut, 'result'>;

describe('planChannels', () => {
  it('soma o saco à porta, os locais e a viatura dedicada', () => {
    const out = planChannels(
      scenario(
        [
          entry({ tonnes_year: 20 }),
          entry({ parish_code: '2', tonnes_year: 5, km_year: 100 }),
          entry({ parish_code: '3', channel: 'existing', tonnes_year: 3, km_year: 120 }),
        ],
        55,
      ),
    );
    expect(out.doorBag).toEqual({ parishes: 2, tonnes: 25, km: 300, everyWeeks: 2 });
    expect(out.existing).toEqual({ points: 55, zones: 3, tonnes: 42 });
    expect(out.vehicle).toEqual({ vehicles: 1, daysPerWeek: 2.5, capexEur: 42_500 });
  });

  it('sem plano de recolha devolve zeros', () => {
    const out = planChannels(scenario(null));
    expect(out.doorBag.parishes).toBe(0);
    expect(out.existing.points).toBe(0);
    expect(out.vehicle.vehicles).toBe(0);
  });
});
