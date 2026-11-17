import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { CalibrationReadingOut } from '@/client';
import { getCalibrationOptions } from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { formatValue, metricLabel, scopeLabel } from './rows';

/** O tom do rótulo da fonte: observado com confiança, estimativa em espera, pressuposto neutro. */
function SourceLabel({ row }: { row: CalibrationReadingOut }) {
  const observed = row.label.startsWith('observado');
  const estimated = row.label.startsWith('estimativa');
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-5 font-semibold text-[9px] uppercase tracking-wider',
        observed && 'border-primary bg-primary/10 text-primary',
        estimated && 'border-areia/70 text-foreground/80',
      )}
    >
      {row.label}
    </Badge>
  );
}

/** O painel «Calibração»: por métrica e unidade, n, rótulo e o valor corrente vs o prior.
 * Os quatro estados do ecrã (a carregar, vazio, erro, sucesso) vivem no DataTable. */
export function CalibrationTable({ id }: { id: string }) {
  const query = useQuery(getCalibrationOptions());
  const data = query.data;
  const rows = useMemo(() => data?.rows ?? [], [data]);

  const columns = useMemo<Column<CalibrationReadingOut>[]>(
    () => [
      {
        id: 'metric',
        header: m.calibration_col_metric(),
        cell: (row) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{metricLabel(row.metric)}</span>
            <span className="text-muted-foreground text-xs">{scopeLabel(row.scope)}</span>
          </span>
        ),
        value: (row) => `${metricLabel(row.metric)} ${scopeLabel(row.scope)}`,
        searchable: true,
        filter: true,
        primary: true,
      },
      {
        id: 'unit',
        header: m.calibration_col_unit(),
        cell: (row) => <span className="truncate">{row.unit_name}</span>,
        value: (row) => row.unit_name,
        searchable: true,
      },
      {
        id: 'n',
        header: m.calibration_col_n(),
        cell: (row) => (
          <span className="tabular-nums">
            {formatNumber(row.n)}
            <span className="text-muted-foreground"> / k={row.pseudo_k}</span>
          </span>
        ),
        value: (row) => row.n,
        type: 'number',
        sortable: true,
        filter: 'range',
      },
      {
        id: 'label',
        header: m.calibration_col_label(),
        cell: (row) => <SourceLabel row={row} />,
        value: (row) => row.label,
        filter: true,
        badge: true,
      },
      {
        id: 'current',
        header: m.calibration_col_current(),
        cell: (row) => (
          <span className="font-medium tabular-nums">{formatValue(row, row.blended)}</span>
        ),
        value: (row) => row.blended,
        type: 'number',
        sortable: true,
      },
      {
        id: 'observed',
        header: m.calibration_col_observed(),
        cell: (row) => <span className="tabular-nums">{formatValue(row, row.observed)}</span>,
        value: (row) => row.observed ?? 0,
        type: 'number',
        sortable: true,
      },
      {
        id: 'prior',
        header: m.calibration_col_prior(),
        cell: (row) => (
          <span className="text-muted-foreground tabular-nums">{formatValue(row, row.prior)}</span>
        ),
        value: (row) => row.prior,
        type: 'number',
        sortable: true,
      },
      {
        id: 'weight',
        header: m.calibration_col_weight(),
        cell: (row) => <span className="tabular-nums">{formatNumber(row.weight * 100, 0)}%</span>,
        value: (row) => row.weight,
        type: 'number',
        sortable: true,
        defaultHidden: true,
      },
    ],
    [],
  );

  return (
    <DataTable
      id={id}
      title={m.calibration_title()}
      caption={m.calibration_title()}
      columns={columns}
      rows={rows}
      getRowId={(row) => `${row.metric}:${row.unit_code}`}
      loading={query.isPending}
      refreshing={query.isFetching}
      error={query.error}
      onRetry={() => void query.refetch()}
      empty={m.calibration_empty()}
    />
  );
}
