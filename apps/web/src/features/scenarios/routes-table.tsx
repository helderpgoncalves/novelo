import type { CollectionMode, RouteOut } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { ModeBadge } from '@/components/mode-badge';
import { formatNumber, formatTonnes } from '@/lib/format';
import { modeLabel } from '@/lib/scenario';
import { m } from '@/paraglide/messages';
import { formatDuration, isRoadRoute } from './routing';

const stopNames = (r: RouteOut) => r.stops.map((s) => s.label ?? s.parish_name);

export function RoutesTable({ routes }: { routes: RouteOut[] }) {
  const columns: Column<RouteOut>[] = [
    {
      id: 'vehicle',
      header: m.route_vehicle(),
      primary: true,
      value: (r) => r.vehicle,
      cell: (r) => <span className="tabular-nums">#{r.vehicle}</span>,
    },
    {
      id: 'mode',
      header: m.alloc_mode(),
      badge: true,
      value: (r) => r.mode,
      filter: { format: (v) => modeLabel[v as CollectionMode]() },
      cell: (r) => <ModeBadge mode={r.mode} />,
    },
    {
      id: 'stops',
      header: m.route_stops(),
      full: true,
      value: (r) => stopNames(r).join(' '),
      sortable: false,
      className: 'max-w-md whitespace-normal text-muted-foreground',
      // Uma ronda pode ter centenas de paragens: na linha só a contagem, a primeira e a última; a lista toda no detalhe.
      cell: (r) => {
        const names = stopNames(r);
        const first = names[0];
        const last = names[names.length - 1];
        if (!first || !last || names.length <= 3) return names.join(' → ');
        return m.route_stops_summary({ n: formatNumber(names.length), first, last });
      },
    },
    {
      id: 'load',
      aggregate: 'sum',
      format: (n) => formatTonnes(n, 2),
      header: m.route_load(),
      align: 'right',
      value: (r) => r.load_t,
      searchable: false,
      cell: (r) => formatTonnes(r.load_t, 2),
    },
    {
      id: 'km',
      aggregate: 'sum',
      format: (n) => `${formatNumber(n, 1)} km`,
      header: m.route_km_round(),
      align: 'right',
      value: (r) => r.km,
      searchable: false,
      cell: (r) => `${formatNumber(r.km, 1)} km`,
    },
    {
      id: 'duration',
      aggregate: 'sum',
      format: (n) => formatDuration(n),
      header: m.route_duration(),
      align: 'right',
      value: (r) => r.duration_min ?? null,
      exportValue: (r) => r.duration_min ?? '',
      searchable: false,
      cell: (r) => (
        <span title={m.route_duration_hint()} className="tabular-nums">
          {formatDuration(r.duration_min)}
        </span>
      ),
    },
    {
      id: 'source',
      header: m.route_source(),
      badge: true,
      value: (r) => (isRoadRoute(r) ? 'road' : 'estimate'),
      filter: {
        format: (v) => (v === 'road' ? m.route_source_road() : m.route_source_estimate()),
      },
      cell: (r) => (isRoadRoute(r) ? m.route_source_road() : `${m.route_source_estimate()}`),
    },
  ];
  return (
    <DataTable
      id="routes"
      exportName="cenario-rotas"
      columns={columns}
      rows={routes}
      getRowId={(r) => `${r.mode}-${r.vehicle}`}
      caption={m.route_vehicle()}
      renderExpanded={(r) =>
        r.stops.length > 3 ? (
          <ol className="max-h-96 list-decimal gap-8 space-y-0.5 overflow-y-auto pl-6 text-muted-foreground text-sm marker:tabular-nums sm:columns-2 lg:columns-3">
            {stopNames(r).map((name, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a mesma rua pode repetir-se na ronda
              <li key={i}>{name}</li>
            ))}
          </ol>
        ) : null
      }
      empty={
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
          {m.route_none()}
        </p>
      }
    />
  );
}
