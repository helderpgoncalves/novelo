import { type Column, DataTable } from '@/components/data-table';
import { EmptyState } from '@/components/states';
import { formatNumber, formatPercent } from '@/lib/format';
import { m } from '@/paraglide/messages';
import type { ParishRow } from './rows';

const dash = <span className="text-muted-foreground">{m.common_dash()}</span>;

/** Barra de cobertura com o valor ao lado; a barra é decorativa e o texto leva o significado. */
function CoverageBar({ pct }: { pct: number }) {
  return (
    <div className="flex min-w-32 items-center gap-2.5">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={m.cov_bar_label({ value: formatPercent(pct, 0) })}
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className="w-11 text-right font-medium tabular-nums">{formatPercent(pct, 0)}</span>
    </div>
  );
}

interface CoverageTableProps {
  rows: ParishRow[];
  /** Com contentores mostra a cobertura; sem eles, só a população e a referência. */
  ready: boolean;
}

export function CoverageTable({ rows, ready }: CoverageTableProps) {
  const base: Column<ParishRow>[] = [
    {
      id: 'parish',
      header: m.cov_table_parish(),
      cell: (r) => <span className="font-medium">{r.name}</span>,
      value: (r) => r.name,
      primary: true,
      className: 'whitespace-normal',
    },
    {
      id: 'population',
      header: m.cov_table_population(),
      cell: (r) => formatNumber(r.population),
      value: (r) => r.population,
      align: 'right',
      className: 'tabular-nums',
    },
  ];

  const columns: Column<ParishRow>[] = ready
    ? [
        ...base,
        {
          id: 'covered',
          header: m.cov_table_covered(),
          cell: (r) => (r.coverage ? <CoverageBar pct={r.coverage.covered_pct} /> : dash),
          value: (r) => r.coverage?.covered_pct,
          badge: true,
          full: true,
        },
        {
          id: 'containers',
          header: m.cov_table_containers(),
          cell: (r) => (r.coverage ? formatNumber(r.coverage.containers) : dash),
          value: (r) => r.coverage?.containers,
          align: 'right',
          className: 'tabular-nums',
        },
        {
          id: 'per1000',
          header: m.cov_table_per_1000(),
          cell: (r) => (r.coverage ? formatNumber(r.coverage.containers_per_1000, 1) : dash),
          value: (r) => r.coverage?.containers_per_1000,
          align: 'right',
          className: 'tabular-nums',
        },
        {
          id: 'gap',
          header: m.cov_table_gap(),
          cell: (r) => (r.coverage ? formatNumber(r.coverage.gap_points) : dash),
          value: (r) => r.coverage?.gap_points,
          align: 'right',
          className: 'tabular-nums',
          defaultHidden: true,
        },
        {
          id: 'nearest',
          header: m.cov_table_nearest(),
          cell: (r) =>
            r.coverage?.nearest_container_m != null
              ? m.cov_nearest_value({ value: formatNumber(r.coverage.nearest_container_m) })
              : dash,
          value: (r) => r.coverage?.nearest_container_m,
          align: 'right',
          className: 'tabular-nums',
          defaultHidden: true,
        },
      ]
    : [
        ...base,
        {
          id: 'reference',
          header: m.cov_table_reference_short(),
          label: m.cov_table_reference(),
          cell: (r) => formatNumber(r.reference),
          value: (r) => r.reference,
          align: 'right',
          className: 'tabular-nums',
        },
      ];

  return (
    <DataTable
      id={ready ? 'coverage-ready' : 'coverage-waiting'}
      columns={columns}
      rows={rows}
      getRowId={(r) => r.code}
      pageSize={10}
      initialSort={ready ? { id: 'covered', desc: false } : { id: 'population', desc: true }}
      searchLabel={m.cov_table_search()}
      empty={
        <EmptyState title={m.cov_table_empty_title()} description={m.cov_table_empty_text()} />
      }
    />
  );
}
