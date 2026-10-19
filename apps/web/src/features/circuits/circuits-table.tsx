import { useDeferredValue, useMemo, useState } from 'react';
import type { CircuitOut, Typology } from '@/client';
import { FilterChips, normalizeText, SearchBox } from '@/components/data-table-toolbar';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { WeekdayDots } from '@/components/weekdays';
import { circuitStatusLabel, collectionLabel, typologyLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
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

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-10 px-4">{m.circuits_table_circuit()}</TableHead>
              <TableHead className="h-10">{m.circuits_table_typology()}</TableHead>
              <TableHead className="h-10">{m.circuits_table_collection()}</TableHead>
              <TableHead className="h-10">{m.circuits_table_localities()}</TableHead>
              <TableHead className="h-10">{m.circuits_table_days()}</TableHead>
              <TableHead className="h-10">{m.circuits_table_vehicles()}</TableHead>
              <TableHead className="h-10 pr-4">{m.circuits_table_status()}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.code} className="align-top">
                <TableCell className="px-4 font-medium">{c.code}</TableCell>
                <TableCell>{typologyLabel[c.typology]()}</TableCell>
                <TableCell>
                  {c.collection_type === 'unspecified' ? (
                    <span className="text-muted-foreground">{m.common_dash()}</span>
                  ) : (
                    collectionLabel[c.collection_type]()
                  )}
                </TableCell>
                <TableCell className="max-w-xs whitespace-normal text-muted-foreground">
                  {c.localities.join(', ') || m.common_dash()}
                </TableCell>
                <TableCell>
                  {c.weekdays.length > 0 ? (
                    <WeekdayDots days={c.weekdays} />
                  ) : (
                    <span className="text-muted-foreground">{m.common_dash()}</span>
                  )}
                </TableCell>
                <TableCell className="max-w-40 whitespace-normal text-muted-foreground tabular-nums">
                  {c.vehicles.join(', ') || m.common_dash()}
                </TableCell>
                <TableCell className="pr-4">
                  <Badge
                    variant={c.status === 'ok' ? 'secondary' : 'outline'}
                    className="whitespace-nowrap font-semibold text-[10px] uppercase tracking-wider"
                  >
                    {circuitStatusLabel[c.status]()}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {m.circuits_no_results()}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
        {m.circuits_count({ shown: rows.length, total: circuits.length })}
      </p>
    </div>
  );
}
