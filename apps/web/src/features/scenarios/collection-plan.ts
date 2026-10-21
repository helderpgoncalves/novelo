import type { CollectionPlanEntry } from '@/client';
import { weekdayLong } from '@/lib/i18n';

export type PlanChannel = CollectionPlanEntry['channel'];

/** Nome do dia fixo do saco à porta (1 = segunda ... 7 = domingo), sem o «-feira»: «segunda», «Monday». */
export function planWeekday(weekday: number | null | undefined): string | null {
  if (weekday == null || !Number.isInteger(weekday) || weekday < 1 || weekday > 7) return null;
  return weekdayLong(weekday).replace(/-feira$/, '');
}

/** O mesmo, com maiúscula inicial (para tabelas e cartões). */
export function planWeekdayTitle(weekday: number | null | undefined): string | null {
  const name = planWeekday(weekday);
  return name ? `${name.charAt(0).toUpperCase()}${name.slice(1)}` : null;
}

export type FitsState = 'yes' | 'no' | 'unknown' | 'na';

/** Cabe na viatura? Só faz sentido no circuito porta a porta; nulo = por validar (capacidade livre sem valor). */
export function fitsState(
  entry: Pick<CollectionPlanEntry, 'channel' | 'fits_capacity'>,
): FitsState {
  if (entry.channel !== 'door_to_door') return 'na';
  if (entry.fits_capacity == null) return 'unknown';
  return entry.fits_capacity ? 'yes' : 'no';
}

export interface ChannelTotals {
  parishes: number;
  tonnes: number;
  newKm: number;
}

export interface PlanSummary {
  doorToDoor: ChannelTotals;
  detour: ChannelTotals;
  /** Kg da ronda (circuito, dia) mais carregada; nulo sem rondas porta a porta. */
  maxRoundKg: number | null;
  /** Rondas distintas (circuito, dia) cuja capacidade está por validar / em que o têxtil não cabe. */
  roundsUnknown: number;
  roundsOver: number;
}

const empty = (): ChannelTotals => ({ parishes: 0, tonnes: 0, newKm: 0 });

/** Resumo do plano a partir só do resultado do otimizador (nada escrito à mão). */
export function summarizePlan(plan: readonly CollectionPlanEntry[]): PlanSummary {
  const doorToDoor = empty();
  const detour = empty();
  const rounds = new Map<string, { kg: number; fits: boolean | null }>();
  for (const e of plan) {
    const totals = e.channel === 'door_to_door' ? doorToDoor : detour;
    totals.parishes += 1;
    totals.tonnes += e.tonnes_year;
    totals.newKm += e.new_km_year;
    if (e.channel === 'door_to_door' && e.circuit != null && e.weekday != null) {
      rounds.set(`${e.circuit}|${e.weekday}`, {
        kg: e.round_kg ?? e.kg_per_round ?? 0,
        fits: e.fits_capacity,
      });
    }
  }
  const values = [...rounds.values()];
  return {
    doorToDoor,
    detour,
    maxRoundKg: values.length ? Math.max(...values.map((r) => r.kg)) : null,
    roundsUnknown: values.filter((r) => r.fits == null).length,
    roundsOver: values.filter((r) => r.fits === false).length,
  };
}

/** Freguesias no circuito porta a porta, por código, com o circuito e o dia fixo (para o mapa). */
export function doorToDoorByParish(
  plan: readonly CollectionPlanEntry[] | null | undefined,
): Map<string, CollectionPlanEntry> {
  return new Map(
    (plan ?? []).filter((e) => e.channel === 'door_to_door').map((e) => [e.parish_code, e]),
  );
}
