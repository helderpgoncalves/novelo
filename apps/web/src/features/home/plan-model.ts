import type { ScenarioOut } from '@/client';

export interface PlanChannels {
  /** Saco fechado no circuito porta a porta de indiferenciado que já passa. */
  doorToDoor: { parishes: number; tonnes: number; newKm: number; circuits: number };
  /** Locais existentes onde a viatura já passa (sem contentor novo). */
  existing: { points: number; zones: number; tonnes: number };
  /** Recolha a pedido com desvio, onde não há circuito porta a porta. */
  detour: { parishes: number; tonnes: number; kmYear: number };
}

/** Resume o plano de recolha de um cenário pelos canais da rede sem contentores. Só soma o que a API devolve. */
export function planChannels(scenario: Pick<ScenarioOut, 'result'>): PlanChannels {
  const plan = scenario.result.collection_plan ?? [];
  const pap = plan.filter((p) => p.channel === 'door_to_door');
  const detour = plan.filter((p) => p.channel === 'detour');
  const existing = scenario.result.modes.find((x) => x.mode === 'existing');
  const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);
  return {
    doorToDoor: {
      parishes: pap.length,
      tonnes: sum(pap, (p) => p.tonnes_year),
      newKm: sum(pap, (p) => p.new_km_year),
      circuits: new Set(
        pap.flatMap((p) => (p.circuits?.length ? p.circuits : p.circuit ? [p.circuit] : [])),
      ).size,
    },
    existing: {
      points: existing?.points ?? 0,
      zones: existing?.zones ?? 0,
      tonnes: existing?.tonnes ?? 0,
    },
    detour: {
      parishes: detour.length,
      tonnes: sum(detour, (p) => p.tonnes_year),
      kmYear: sum(detour, (p) => p.new_km_year),
    },
  };
}
