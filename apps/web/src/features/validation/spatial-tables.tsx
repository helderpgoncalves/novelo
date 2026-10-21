import type { SpatialCheckOut, ZoneCheckOut } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { formatNumber, formatPercent } from '@/lib/format';
import { m } from '@/paraglide/messages';

const KIND: Record<SpatialCheckOut['kind'], () => string> = {
  all: () => m.validation_kind_all(),
  underground: () => m.validation_kind_underground(),
  surface: () => m.validation_kind_surface(),
};

export function SpatialSummary({ checks }: { checks: SpatialCheckOut[] }) {
  const columns: Column<SpatialCheckOut>[] = [
    {
      id: 'kind',
      header: m.validation_kind(),
      primary: true,
      value: (c) => KIND[c.kind](),
      cell: (c) => <span className="font-medium">{KIND[c.kind]()}</span>,
    },
    {
      id: 'r',
      header: m.validation_r(),
      align: 'right',
      type: 'number',
      value: (c) => c.pearson_r,
      format: (v) => formatNumber(v, 2),
      cell: (c) => <span className="tabular-nums">{formatNumber(c.pearson_r, 2)}</span>,
    },
    {
      id: 'r2',
      header: m.validation_r2(),
      align: 'right',
      type: 'number',
      badge: true,
      value: (c) => c.r2,
      format: (v) => formatNumber(v, 2),
      cell: (c) => <span className="font-medium tabular-nums">{formatNumber(c.r2, 2)}</span>,
    },
    {
      id: 'median',
      header: m.validation_median_error(),
      align: 'right',
      type: 'number',
      value: (c) => c.median_abs_pct_error,
      format: (v) => formatPercent(v, 0),
      cell: (c) => <span className="tabular-nums">{formatPercent(c.median_abs_pct_error, 0)}</span>,
    },
    {
      id: 'within',
      header: m.validation_within_25(),
      align: 'right',
      type: 'number',
      value: (c) => c.within_25_pct,
      format: (v) => formatNumber(v),
      cell: (c) => (
        <span className="tabular-nums">
          {formatNumber(c.within_25_pct)} / {formatNumber(c.n)}
        </span>
      ),
    },
  ];
  return (
    <DataTable
      id="validation-spatial"
      exportName="validacao-espacial"
      columns={columns}
      rows={checks}
      getRowId={(c) => c.kind}
      controls="never"
      caption={m.validation_spatial_title()}
    />
  );
}

export function WorstZones({ zones }: { zones: ZoneCheckOut[] }) {
  const columns: Column<ZoneCheckOut>[] = [
    {
      id: 'zone',
      header: m.validation_zone(),
      primary: true,
      value: (z) => z.zone,
      cell: (z) => <span className="font-medium">{z.zone}</span>,
    },
    {
      id: 'population',
      header: m.validation_population(),
      align: 'right',
      type: 'number',
      value: (z) => z.population,
      format: (v) => formatNumber(v),
      cell: (z) => <span className="tabular-nums">{formatNumber(z.population)}</span>,
    },
    {
      id: 'observed',
      header: m.validation_observed_count(),
      align: 'right',
      type: 'number',
      value: (z) => z.observed,
      format: (v) => formatNumber(v),
      cell: (z) => <span className="tabular-nums">{formatNumber(z.observed)}</span>,
    },
    {
      id: 'predicted',
      header: m.validation_predicted(),
      align: 'right',
      type: 'number',
      value: (z) => z.predicted,
      format: (v) => formatNumber(v, 1),
      cell: (z) => <span className="tabular-nums">{formatNumber(z.predicted, 1)}</span>,
    },
    {
      id: 'error',
      header: m.validation_error(),
      align: 'right',
      type: 'number',
      badge: true,
      value: (z) => z.pct_error,
      format: (v) => formatPercent(v, 0),
      cell: (z) => (
        <span className="font-medium tabular-nums">
          {z.pct_error == null ? m.common_dash() : formatPercent(z.pct_error, 0)}
        </span>
      ),
    },
  ];
  return (
    <DataTable
      id="validation-worst"
      exportName="validacao-freguesias"
      columns={columns}
      rows={zones}
      getRowId={(z) => z.zone}
      controls="never"
      caption={m.validation_worst_title()}
    />
  );
}
