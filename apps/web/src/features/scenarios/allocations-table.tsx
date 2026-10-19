import { useDeferredValue, useMemo, useState } from 'react';
import type { Allocation } from '@/client';
import { normalizeText, SearchBox } from '@/components/data-table-toolbar';
import { ModeBadges } from '@/components/mode-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatEur, formatNumber, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';

export function AllocationsTable({ allocations }: { allocations: Allocation[] }) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const rows = useMemo(() => {
    const q = normalizeText(deferred.trim());
    return [...allocations]
      .filter((a) => !q || normalizeText(a.parish_name).includes(q))
      .sort((x, y) => y.tonnes - x.tonnes);
  }, [allocations, deferred]);

  return (
    <div className="space-y-3">
      <SearchBox value={query} onChange={setQuery} label={m.scenario_search_parish()} />
      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-10 px-4">{m.alloc_parish()}</TableHead>
              <TableHead className="h-10">{m.alloc_mode()}</TableHead>
              <TableHead className="h-10 text-right">{m.alloc_population()}</TableHead>
              <TableHead className="h-10 text-right">{m.alloc_points()}</TableHead>
              <TableHead className="h-10 text-right">{m.alloc_tonnes()}</TableHead>
              <TableHead className="h-10 text-right">{m.alloc_capex()}</TableHead>
              <TableHead className="h-10 text-right">{m.alloc_annual_cost()}</TableHead>
              <TableHead className="h-10 pr-4 text-right">{m.alloc_km()}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.parish_code}>
                <TableCell className="px-4 font-medium">{a.parish_name}</TableCell>
                <TableCell>
                  <ModeBadges modes={a.modes} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(a.population)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {a.modes.length ? formatNumber(a.points) : m.common_dash()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {a.modes.length ? formatTonnes(a.tonnes, 2) : m.common_dash()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {a.modes.length ? formatEur(a.capex_eur) : m.common_dash()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {a.modes.length ? formatEur(a.annual_cost_eur) : m.common_dash()}
                </TableCell>
                <TableCell className="pr-4 text-right tabular-nums">
                  {a.modes.length ? formatNumber(a.km_year) : m.common_dash()}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  {m.scenario_no_parish()}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
