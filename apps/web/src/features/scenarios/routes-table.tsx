import type { RouteOut } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { ModeBadge } from '@/components/mode-badge';
import { formatNumber, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';

export function RoutesTable({ routes }: { routes: RouteOut[] }) {
  const columns: Column<RouteOut>[] = [
    {
      id: 'vehicle',
      header: m.route_vehicle(),
      primary: true,
      cell: (r) => <span className="tabular-nums">#{r.vehicle}</span>,
    },
    { id: 'mode', header: m.alloc_mode(), badge: true, cell: (r) => <ModeBadge mode={r.mode} /> },
    {
      id: 'stops',
      header: m.route_stops(),
      full: true,
      className: 'max-w-md whitespace-normal text-muted-foreground',
      cell: (r) => r.stops.map((s) => s.parish_name).join(' → '),
    },
    { id: 'load', header: m.route_load(), align: 'right', cell: (r) => formatTonnes(r.load_t, 2) },
    {
      id: 'km',
      header: m.route_km_round(),
      align: 'right',
      cell: (r) => `${formatNumber(r.km, 1)} km`,
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={routes}
      getKey={(r) => `${r.mode}-${r.vehicle}`}
      caption={m.route_vehicle()}
      empty={
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
          {m.route_none()}
        </p>
      }
    />
  );
}
