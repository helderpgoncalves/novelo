import type { RouteOut } from '@/client';
import { ModeBadge } from '@/components/mode-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatNumber, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';

export function RoutesTable({ routes }: { routes: RouteOut[] }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 px-4">{m.route_vehicle()}</TableHead>
            <TableHead className="h-10">{m.alloc_mode()}</TableHead>
            <TableHead className="h-10">{m.route_stops()}</TableHead>
            <TableHead className="h-10 text-right">{m.route_load()}</TableHead>
            <TableHead className="h-10 pr-4 text-right">{m.route_km_round()}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {routes.map((r) => (
            <TableRow key={`${r.mode}-${r.vehicle}`} className="align-top">
              <TableCell className="px-4 font-medium tabular-nums">#{r.vehicle}</TableCell>
              <TableCell>
                <ModeBadge mode={r.mode} />
              </TableCell>
              <TableCell className="max-w-md whitespace-normal text-muted-foreground">
                {r.stops.map((s) => s.parish_name).join(' → ')}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatTonnes(r.load_t, 2)}</TableCell>
              <TableCell className="pr-4 text-right tabular-nums">
                {formatNumber(r.km, 1)} km
              </TableCell>
            </TableRow>
          ))}
          {routes.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                {m.route_none()}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
