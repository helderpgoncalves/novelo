import { useDeferredValue, useMemo, useState } from 'react';
import type { VehicleOut } from '@/client';
import { normalizeText, SearchBox } from '@/components/data-table-toolbar';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { typologyLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

export function VehiclesTable({ vehicles }: { vehicles: VehicleOut[] }) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const rows = useMemo(() => {
    const q = normalizeText(deferred.trim());
    return vehicles.filter(
      (v) => !q || normalizeText(`${v.plate} ${v.circuits.join(' ')}`).includes(q),
    );
  }, [vehicles, deferred]);

  return (
    <div className="space-y-3">
      <SearchBox value={query} onChange={setQuery} label={m.fleet_vehicle_search()} />
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-10 px-4">{m.fleet_vehicle_plate()}</TableHead>
              <TableHead className="h-10">{m.fleet_vehicle_circuits()}</TableHead>
              <TableHead className="h-10">{m.fleet_vehicle_typologies()}</TableHead>
              <TableHead className="h-10 text-right">{m.fleet_vehicle_shifts()}</TableHead>
              <TableHead className="h-10 text-right">{m.fleet_vehicle_crew()}</TableHead>
              <TableHead className="h-10 pr-4">{m.fleet_vehicle_flags()}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((v) => (
              <TableRow key={v.plate} className="align-top">
                <TableCell className="px-4 font-medium tabular-nums">{v.plate}</TableCell>
                <TableCell className="max-w-xs whitespace-normal text-muted-foreground">
                  {v.circuits.join(', ') || m.common_dash()}
                </TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">
                  {v.typologies.map((t) => typologyLabel[t]()).join(', ') || m.common_dash()}
                </TableCell>
                <TableCell className="text-right tabular-nums">{v.weekday_shifts}</TableCell>
                <TableCell className="text-right tabular-nums">{v.max_crew}</TableCell>
                <TableCell className="pr-4">
                  <div className="flex flex-wrap gap-1.5">
                    {v.never_assigned && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className="cursor-help border-areia/60 font-semibold text-[10px] uppercase tracking-wider"
                          >
                            {m.fleet_flag_idle()}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          {m.fleet_flag_idle_hint()}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {v.multi_typology && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className="cursor-help font-semibold text-[10px] uppercase tracking-wider"
                          >
                            {m.fleet_flag_multi()}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          {m.fleet_flag_multi_hint()}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
        {m.fleet_vehicle_count({ shown: rows.length, total: vehicles.length })}
      </p>
    </div>
  );
}
