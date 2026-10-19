import { useDeferredValue, useMemo, useState } from 'react';
import type { CircuitOut, Typology } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { FilterChips, normalizeText, SearchBox } from '@/components/data-table-toolbar';
import { Badge } from '@/components/ui/badge';
import { WeekdayDots } from '@/components/weekdays';
import { circuitStatusLabel, collectionLabel, typologyLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

const dash = <span className="text-muted-foreground">{m.common_dash()}</span>;

export function CircuitsTable({ circuits }: { circuits: CircuitOut[] }) {
  const [query, setQuery] = useState('');
  const [typology, setTypology] = useState<Typology | null>(null);
  const deferred = useDeferredValue(query);

  const typologies = useMemo(() => [...new Set(circuits.map((c) => c.typology))], [circuits]);
  const rows = useMemo(() => {
    const q = normalizeText(deferred.trim());
    return circuits.filter(
      (c) =>
        (!typology || c.typology === typology) &&
        (!q ||
          normalizeText(`${c.code} ${c.localities.join(' ')} ${c.vehicles.join(' ')}`).includes(q)),
    );
  }, [circuits, deferred, typology]);

  const columns: Column<CircuitOut>[] = [
    { id: 'code', header: m.circuits_table_circuit(), cell: (c) => c.code, primary: true },
    {
      id: 'status',
      header: m.circuits_table_status(),
      badge: true,
      cell: (c) => (
        <Badge
          variant={c.status === 'ok' ? 'secondary' : 'outline'}
          className="whitespace-nowrap font-semibold text-[10px] uppercase tracking-wider"
        >
          {circuitStatusLabel[c.status]()}
        </Badge>
      ),
    },
    {
      id: 'typology',
      header: m.circuits_table_typology(),
      cell: (c) => typologyLabel[c.typology](),
    },
    {
      id: 'collection',
      header: m.circuits_table_collection(),
      cell: (c) =>
        c.collection_type === 'unspecified' ? dash : collectionLabel[c.collection_type](),
    },
    {
      id: 'days',
      header: m.circuits_table_days(),
      cell: (c) => (c.weekdays.length ? <WeekdayDots days={c.weekdays} /> : dash),
    },
    {
      id: 'vehicles',
      header: m.circuits_table_vehicles(),
      cell: (c) => c.vehicles.join(', ') || dash,
    },
    {
      id: 'localities',
      header: m.circuits_table_localities(),
      cell: (c) => (
        <span className="text-muted-foreground">{c.localities.join(', ') || m.common_dash()}</span>
      ),
      className: 'max-w-xs whitespace-normal',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchBox value={query} onChange={setQuery} label={m.circuits_search()} />
        <FilterChips
          legend={m.circuits_filter_typology()}
          value={typology}
          onChange={setTypology}
          options={[
            { value: null, label: m.common_all() },
            ...typologies.map((t) => ({ value: t, label: typologyLabel[t]() })),
          ]}
        />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getKey={(c) => c.code}
        caption={m.circuits_title()}
        empty={
          <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
            {m.circuits_no_results()}
          </p>
        }
      />
      <p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
        {m.circuits_count({ shown: rows.length, total: circuits.length })}
      </p>
    </div>
  );
}
