import { useDeferredValue, useMemo, useState } from 'react';
import type { LocalityOut } from '@/client';
import { FilterChips, normalizeText, SearchBox } from '@/components/data-table-toolbar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { WeekdayDots } from '@/components/weekdays';
import { collectionLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

type Frequency = 'frequent' | 'sparse';

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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
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
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-10 px-4">{m.localities_table_locality()}</TableHead>
              <TableHead className="h-10">{m.localities_table_circuits()}</TableHead>
              <TableHead className="h-10">{m.localities_table_collection()}</TableHead>
              <TableHead className="h-10">{m.localities_table_days()}</TableHead>
              <TableHead className="h-10 pr-4 text-right">
                {m.localities_table_frequency()}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((l) => (
              <TableRow key={l.name} className="align-top">
                <TableCell className="px-4 font-medium">{l.name}</TableCell>
                <TableCell className="text-muted-foreground">{l.circuits.join(', ')}</TableCell>
                <TableCell className="text-muted-foreground">
                  {l.collection_types.map((c) => collectionLabel[c]()).join(', ') ||
                    m.common_dash()}
                </TableCell>
                <TableCell>
                  {l.weekdays.length > 0 ? (
                    <WeekdayDots days={l.weekdays} />
                  ) : (
                    <span className="text-muted-foreground">{m.common_dash()}</span>
                  )}
                </TableCell>
                <TableCell className="pr-4 text-right font-medium tabular-nums">
                  {l.days_per_week}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  {m.localities_no_results()}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
        {m.localities_count({ shown: rows.length, total: localities.length })}
      </p>
    </div>
  );
}
