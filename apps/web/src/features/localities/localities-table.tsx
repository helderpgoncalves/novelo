import { useDeferredValue, useMemo, useState } from 'react';
import type { LocalityOut } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { FilterChips, normalizeText, SearchBox } from '@/components/data-table-toolbar';
import { WeekdayDots } from '@/components/weekdays';
import { collectionLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

type Frequency = 'frequent' | 'sparse';
const dash = <span className="text-muted-foreground">{m.common_dash()}</span>;

export function LocalitiesTable({ localities }: { localities: LocalityOut[] }) {
  const [query, setQuery] = useState('');
  const [frequency, setFrequency] = useState<Frequency | null>(null);
  const deferred = useDeferredValue(query);

  const rows = useMemo(() => {
    const q = normalizeText(deferred.trim());
    return localities.filter(
      (l) =>
        (!frequency ||
          (frequency === 'frequent'
            ? l.days_per_week >= 3
            : l.days_per_week > 0 && l.days_per_week < 3)) &&
        (!q || normalizeText(`${l.name} ${l.circuits.join(' ')}`).includes(q)),
    );
  }, [localities, deferred, frequency]);

  const columns: Column<LocalityOut>[] = [
    { id: 'name', header: m.localities_table_locality(), cell: (l) => l.name, primary: true },
    {
      id: 'frequency',
      header: m.localities_table_frequency(),
      cell: (l) => l.days_per_week,
      badge: true,
      align: 'right',
    },
    {
      id: 'circuits',
      header: m.localities_table_circuits(),
      cell: (l) => <span className="text-muted-foreground">{l.circuits.join(', ')}</span>,
    },
    {
      id: 'collection',
      header: m.localities_table_collection(),
      cell: (l) => (
        <span className="text-muted-foreground">
          {l.collection_types.map((c) => collectionLabel[c]()).join(', ') || m.common_dash()}
        </span>
      ),
    },
    {
      id: 'days',
      header: m.localities_table_days(),
      cell: (l) => (l.weekdays.length ? <WeekdayDots days={l.weekdays} /> : dash),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchBox value={query} onChange={setQuery} label={m.localities_search()} />
        <FilterChips<Frequency>
          legend={m.localities_filter_frequency()}
          value={frequency}
          onChange={setFrequency}
          options={[
            { value: null, label: m.common_all() },
            { value: 'frequent', label: m.localities_filter_frequent() },
            { value: 'sparse', label: m.localities_filter_sparse() },
          ]}
        />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getKey={(l) => l.name}
        caption={m.localities_title()}
        empty={
          <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
            {m.localities_no_results()}
          </p>
        }
      />
      <p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
        {m.localities_count({ shown: rows.length, total: localities.length })}
      </p>
    </div>
  );
}
