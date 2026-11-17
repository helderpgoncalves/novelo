import type { CollectionAgendaOut, PublicAgendaEntry } from '@/client';
import { weekdayLong } from '@/lib/i18n';

// Strings em pt-PT de propósito: a área do cidadão é só portuguesa no MVP (decisão da spec #54).

/** Um dia da agenda: as rondas publicadas desse dia da semana, com as freguesias e cadências. */
export interface AgendaDay {
  /** 1 = segunda … 5 = sexta (a ronda não passa ao fim de semana). */
  weekday: number;
  label: string;
  entries: PublicAgendaEntry[];
}

/** Cadência em palavras: «todas as semanas», «de 2 em 2 semanas», «de 3 em 3»… */
export function cadenceLabel(everyWeeks: number): string {
  const weeks = Math.max(1, Math.round(everyWeeks));
  if (weeks === 1) return 'todas as semanas';
  return `de ${weeks} em ${weeks} semanas`;
}

export function channelLabel(channel: PublicAgendaEntry['channel']): string {
  return channel === 'on_demand' ? 'à porta' : 'nos locais';
}

/** Agrupa a agenda publicada por dia da semana, pela ordem do calendário (segunda a sexta). */
export function agendaByDay(agenda: PublicAgendaEntry[] | null | undefined): AgendaDay[] {
  if (!agenda?.length) return [];
  const byWeekday = new Map<number, PublicAgendaEntry[]>();
  for (const entry of agenda) {
    const list = byWeekday.get(entry.weekday) ?? [];
    list.push(entry);
    byWeekday.set(entry.weekday, list);
  }
  return [...byWeekday.entries()]
    .sort(([a], [b]) => a - b)
    .map(([weekday, entries]) => ({
      weekday,
      label: weekdayLong(weekday),
      entries: entries.sort((a, b) => a.parish_name.localeCompare(b.parish_name, 'pt')),
    }));
}

/** O próximo dia da ronda a partir de hoje (segunda = 1 … domingo = 7). */
export function nextRoundWeekday(weekdays: number[], today: Date = new Date()): number | null {
  if (!weekdays.length) return null;
  // getDay(): domingo = 0 … sábado = 6 → converter para segunda = 1 … domingo = 7.
  const todayIso = today.getDay() === 0 ? 7 : today.getDay();
  const sorted = [...new Set(weekdays)].sort((a, b) => a - b);
  return sorted.find((d) => d > todayIso) ?? sorted[0] ?? null;
}

/** Estado da página pública: à espera, sem agenda publicada, ou com agenda. */
export type AgendaView =
  | { kind: 'loading' }
  | { kind: 'empty'; message: string }
  | { kind: 'ready'; agenda: AgendaDay[]; scenarioLabel: string | null; updatedAt: string | null };

export function agendaView(data: CollectionAgendaOut | undefined, hasError: boolean): AgendaView {
  if (hasError) return { kind: 'empty', message: 'Não foi possível carregar a agenda.' };
  if (!data) return { kind: 'loading' };
  const days = agendaByDay(data.agenda ?? null);
  if (!days.length)
    return {
      kind: 'empty',
      message: 'Ainda não há agenda publicada — a Vitrus anunciará aqui os dias da ronda.',
    };
  return {
    kind: 'ready',
    agenda: days,
    scenarioLabel: data.scenario_label ?? null,
    updatedAt: data.updated_at ?? null,
  };
}
