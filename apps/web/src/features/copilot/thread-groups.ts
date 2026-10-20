import { intlTag } from '@/lib/i18n';
import { m } from '@/paraglide/messages';

export type GroupKey = 'pinned' | 'today' | 'yesterday' | 'week' | 'month' | 'older';

export const groupLabel: Record<GroupKey, () => string> = {
  pinned: () => m.cp_group_pinned(),
  today: () => m.cp_group_today(),
  yesterday: () => m.cp_group_yesterday(),
  week: () => m.cp_group_week(),
  month: () => m.cp_group_month(),
  older: () => m.cp_group_older(),
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const DAY = 86_400_000;

/** Em que grupo (Hoje, Ontem, Últimos 7 dias…) cai uma data, no fuso do utilizador. */
export function dateGroup(iso: string, now: Date = new Date()): Exclude<GroupKey, 'pinned'> {
  const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return 'week';
  if (days < 30) return 'month';
  return 'older';
}

export interface Grouped<T> {
  key: GroupKey;
  items: T[];
}

/** Fixadas primeiro; depois por data, mantendo a ordem recebida dentro de cada grupo. */
export function groupThreads<T extends { pinned: boolean; updated_at: string }>(
  threads: T[],
  now: Date = new Date(),
): Grouped<T>[] {
  const order: GroupKey[] = ['pinned', 'today', 'yesterday', 'week', 'month', 'older'];
  const buckets = new Map<GroupKey, T[]>();
  for (const t of threads) {
    const key: GroupKey = t.pinned ? 'pinned' : dateGroup(t.updated_at, now);
    buckets.set(key, [...(buckets.get(key) ?? []), t]);
  }
  return order.flatMap((key) => {
    const items = buckets.get(key);
    return items ? [{ key, items }] : [];
  });
}

/** Hora nas conversas de hoje e de ontem, dia da semana na última semana, dia e mês depois (e o ano nas antigas). */
export function threadTime(iso: string, group: GroupKey, tag: string = intlTag()): string {
  const date = new Date(iso);
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, o).format(date);
  if (group === 'today' || group === 'yesterday')
    return fmt({ hour: '2-digit', minute: '2-digit' });
  if (group === 'week') return fmt({ weekday: 'short' });
  if (group === 'month') return fmt({ day: 'numeric', month: 'short' });
  return fmt({ day: 'numeric', month: 'short', year: 'numeric' });
}
