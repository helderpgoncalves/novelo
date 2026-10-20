import { useMemo } from 'react';
import type { Allocation } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { ModeBadges } from '@/components/mode-badge';
import { formatEur, formatNumber, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';

export function AllocationsTable({ allocations }: { allocations: Allocation[] }) {
  const rows = useMemo(() => [...allocations].sort((x, y) => y.tonnes - x.tonnes), [allocations]);

  const active = (a: Allocation, value: string) => (a.modes.length ? value : m.common_dash());
  const columns: Column<Allocation>[] = [
    {
      id: 'parish',
      header: m.alloc_parish(),
      primary: true,
      cell: (a) => a.parish_name,
      value: (a) => a.parish_name,
    },
    {
      id: 'mode',
      header: m.alloc_mode(),
      badge: true,
      sortable: false,
      value: (a) => a.modes.join(' '),
      cell: (a) => <ModeBadges modes={a.modes} />,
    },
    {
      id: 'population',
      aggregate: 'sum',
      format: (n) => formatNumber(n),
      value: (a) => a.population,
      searchable: false,
      header: m.alloc_population(),
      align: 'right',
      cell: (a) => formatNumber(a.population),
    },
    {
      id: 'points',
      aggregate: 'sum',
      format: (n) => formatNumber(n),
      value: (a) => a.points,
      searchable: false,
      header: m.alloc_points(),
      align: 'right',
      cell: (a) => active(a, formatNumber(a.points)),
    },
    {
      id: 'tonnes',
      aggregate: 'sum',
      format: (n) => formatTonnes(n, 2),
      value: (a) => a.tonnes,
      searchable: false,
      header: m.alloc_tonnes(),
      align: 'right',
      cell: (a) => active(a, formatTonnes(a.tonnes, 2)),
    },
    {
      id: 'capex',
      aggregate: 'sum',
      format: (n) => formatEur(n),
      value: (a) => a.capex_eur,
      searchable: false,
      header: m.alloc_capex(),
      align: 'right',
      cell: (a) => active(a, formatEur(a.capex_eur)),
    },
    {
      id: 'cost',
      aggregate: 'sum',
      format: (n) => formatEur(n),
      value: (a) => a.annual_cost_eur,
      searchable: false,
      header: m.alloc_annual_cost(),
      align: 'right',
      cell: (a) => active(a, formatEur(a.annual_cost_eur)),
    },
    {
      id: 'km',
      aggregate: 'sum',
      format: (n) => formatNumber(n),
      value: (a) => a.km_year,
      searchable: false,
      header: m.alloc_km(),
      align: 'right',
      cell: (a) => active(a, formatNumber(a.km_year)),
    },
  ];

  return (
    <DataTable
      id="allocations"
      exportName="cenario-freguesias"
      columns={columns}
      rows={rows}
      getRowId={(a) => a.parish_code}
      caption={m.alloc_parish()}
      searchLabel={m.scenario_search_parish()}
      pageSize={10}
    />
  );
}
