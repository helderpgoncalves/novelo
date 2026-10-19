import type { LocalityOut } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { formatNumber, formatPercent } from '@/lib/format';
import { m } from '@/paraglide/messages';

interface FrequencyRow {
  days: number;
  localities: number;
  share: number;
}

function summarise(localities: LocalityOut[]): FrequencyRow[] {
  const counts = new Map<number, number>();
  for (const l of localities) counts.set(l.days_per_week, (counts.get(l.days_per_week) ?? 0) + 1);
  return [...counts.entries()]
    .map(([days, count]) => ({
      days,
      localities: count,
      share: localities.length ? (count / localities.length) * 100 : 0,
    }))
    .sort((a, b) => b.days - a.days);
}

/** Quantas localidades têm camião 0, 1, 2... dias por semana. */
export function FrequencySummary({ localities }: { localities: LocalityOut[] }) {
  const columns: Column<FrequencyRow>[] = [
    {
      id: 'days',
      header: m.localities_table_frequency(),
      primary: true,
      value: (r) => r.days,
      cell: (r) => m.localities_days_filter({ days: r.days }),
    },
    {
      id: 'count',
      header: m.localities_table_locality(),
      align: 'right',
      value: (r) => r.localities,
      cell: (r) => formatNumber(r.localities),
    },
    {
      id: 'share',
      header: m.rw_share(),
      full: true,
      className: 'w-2/5',
      value: (r) => r.share,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${r.share}%` }}
            />
          </span>
          <span className="w-14 text-right text-xs tabular-nums">{formatPercent(r.share, 0)}</span>
        </div>
      ),
    },
  ];
  return (
    <DataTable
      id="localities-frequency"
      controls="never"
      columns={columns}
      rows={summarise(localities)}
      getKey={(r) => String(r.days)}
      caption={m.rw_localities_tab_frequency()}
    />
  );
}
