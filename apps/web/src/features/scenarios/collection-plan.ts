import type { CollectionPlanEntry } from '@/client';
import { weekdayLong } from '@/lib/i18n';

export type PlanChannel = CollectionPlanEntry['channel'];

/** Nome do dia de recolha (1 = segunda ... 7 = domingo), sem o «-feira»: «segunda», «Monday». */
export function planWeekday(weekday: number | null | undefined): string | null {
  if (weekday == null || !Number.isInteger(weekday) || weekday < 1 || weekday > 7) return null;
  return weekdayLong(weekday).replace(/-feira$/, '');
}

/** O mesmo, com maiúscula inicial (para tabelas e cartões). */
export function planWeekdayTitle(weekday: number | null | undefined): string | null {
  const name = planWeekday(weekday);
  return name ? `${name.charAt(0).toUpperCase()}${name.slice(1)}` : null;
}

export interface ChannelTotals {
  parishes: number;
  tonnes: number;
  km: number;
  hours: number;
}

export interface PlanSummary {
  /** Saco fechado à porta, numa ronda da viatura dedicada. */
  doorBag: ChannelTotals;
  /** Paragens nos locais (pontos existentes, escolas; contentor de rua só como referência). */
  sites: ChannelTotals;
  /** Intervalo entre rondas porta a porta (semanas); nulo sem porta a porta. */
  everyWeeks: number | null;
  /** Viaturas dedicadas com rondas atribuídas (a maior numeração no plano). */
  vehicles: number;
}

const empty = (): ChannelTotals => ({ parishes: 0, tonnes: 0, km: 0, hours: 0 });

/** Resumo do plano da viatura dedicada a partir só do resultado do otimizador (nada escrito à mão). */
export function summarizePlan(plan: readonly CollectionPlanEntry[]): PlanSummary {
  const doorBag = empty();
  const sites = empty();
  const parishes = { door: new Set<string>(), sites: new Set<string>() };
  let everyWeeks: number | null = null;
  let vehicles = 0;
  for (const e of plan) {
    const door = e.channel === 'on_demand';
    const totals = door ? doorBag : sites;
    (door ? parishes.door : parishes.sites).add(e.parish_code);
    totals.tonnes += e.tonnes_year;
    totals.km += e.km_year;
    totals.hours += e.hours_year;
    if (door && everyWeeks == null) everyWeeks = e.every_weeks;
    if (e.vehicle != null) vehicles = Math.max(vehicles, e.vehicle);
  }
  doorBag.parishes = parishes.door.size;
  sites.parishes = parishes.sites.size;
  return { doorBag, sites, everyWeeks, vehicles };
}

/** Freguesias com saco à porta, por código, com o dia e a frequência da ronda (para o mapa). */
export function doorBagByParish(
  plan: readonly CollectionPlanEntry[] | null | undefined,
): Map<string, CollectionPlanEntry> {
  return new Map(
    (plan ?? []).filter((e) => e.channel === 'on_demand').map((e) => [e.parish_code, e]),
  );
}
