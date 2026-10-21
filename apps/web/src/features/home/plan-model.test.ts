import { describe, expect, it } from 'vitest';
import type { CollectionPlanEntry, ScenarioOut } from '@/client';
import { planChannels } from './plan-model';

const entry = (over: Partial<CollectionPlanEntry>): CollectionPlanEntry => ({
  channel: 'door_to_door',
  circuit: 'C1',
  circuits: ['C1'],
  crew: 3,
  fits_capacity: null,
  kg_per_round: 100,
  new_km_year: 0,
  parish_code: '030801',
  parish_name: 'Aldão',
  pickups_year: 10,
  round_kg: 100,
  tonnes_year: 10,
  vehicle: 'AA-00-AA',
  weekday: 1,
  ...over,
});

const scenario = (plan: CollectionPlanEntry[] | null, existing?: number) =>
  ({
    result: {
      collection_plan: plan,
      modes: existing
        ? [{ mode: 'existing', zones: 3, points: existing, tonnes: 42, annual_cost_eur: 1 }]
        : [],
    },
  }) as unknown as Pick<ScenarioOut, 'result'>;

describe('planChannels', () => {
  it('separa porta a porta e desvio e conta circuitos distintos', () => {
    const out = planChannels(
      scenario(
        [
          entry({ tonnes_year: 20, circuits: ['C1', 'C2'] }),
          entry({ parish_code: '2', tonnes_year: 5, circuits: ['C2'] }),
          entry({ parish_code: '3', channel: 'detour', tonnes_year: 3, new_km_year: 120 }),
        ],
        55,
      ),
    );
    expect(out.doorToDoor).toEqual({ parishes: 2, tonnes: 25, newKm: 0, circuits: 2 });
    expect(out.detour).toEqual({ parishes: 1, tonnes: 3, kmYear: 120 });
    expect(out.existing).toEqual({ points: 55, zones: 3, tonnes: 42 });
  });

  it('sem plano de recolha devolve zeros', () => {
    const out = planChannels(scenario(null));
    expect(out.doorToDoor.parishes).toBe(0);
    expect(out.existing.points).toBe(0);
    expect(out.detour.parishes).toBe(0);
  });
});
