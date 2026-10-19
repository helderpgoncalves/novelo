import { useDeferredValue, useMemo, useState } from 'react';
import type { Allocation } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { normalizeText, SearchBox } from '@/components/data-table-toolbar';
import { ModeBadges } from '@/components/mode-badge';
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

  const active = (a: Allocation, value: string) => (a.modes.length ? value : m.common_dash());
  const columns: Column<Allocation>[] = [
    { id: 'parish', header: m.alloc_parish(), primary: true, cell: (a) => a.parish_name },
    {
      id: 'mode',
      header: m.alloc_mode(),
      badge: true,
      cell: (a) => <ModeBadges modes={a.modes} />,
    },
    {
      id: 'population',
      header: m.alloc_population(),
      align: 'right',
      cell: (a) => formatNumber(a.population),
    },
    {
      id: 'points',
      header: m.alloc_points(),
      align: 'right',
      cell: (a) => active(a, formatNumber(a.points)),
    },
    {
      id: 'tonnes',
      header: m.alloc_tonnes(),
      align: 'right',
      cell: (a) => active(a, formatTonnes(a.tonnes, 2)),
    },
    {
      id: 'capex',
      header: m.alloc_capex(),
      align: 'right',
      cell: (a) => active(a, formatEur(a.capex_eur)),
    },
    {
      id: 'cost',
      header: m.alloc_annual_cost(),
      align: 'right',
      cell: (a) => active(a, formatEur(a.annual_cost_eur)),
    },
    {
      id: 'km',
      header: m.alloc_km(),
      align: 'right',
      cell: (a) => active(a, formatNumber(a.km_year)),
    },
  ];

  return (
    <div className="space-y-3">
      <SearchBox value={query} onChange={setQuery} label={m.scenario_search_parish()} />
      <DataTable
        columns={columns}
        rows={rows}
        getKey={(a) => a.parish_code}
        caption={m.alloc_parish()}
        empty={
          <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
            {m.scenario_no_parish()}
          </p>
        }
      />
    </div>
  );
}
