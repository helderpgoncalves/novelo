import { useDeferredValue, useMemo, useState } from 'react';
import type { VehicleOut } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { normalizeText, SearchBox } from '@/components/data-table-toolbar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { typologyLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

const dash = <span className="text-muted-foreground">{m.common_dash()}</span>;

function Flag({ label, hint, tone }: { label: string; hint: string; tone?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={`cursor-help font-semibold text-[10px] uppercase tracking-wider ${tone ?? ''}`}
        >
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{hint}</TooltipContent>
    </Tooltip>
  );
}

export function VehiclesTable({ vehicles }: { vehicles: VehicleOut[] }) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const rows = useMemo(() => {
    const q = normalizeText(deferred.trim());
    return vehicles.filter(
      (v) => !q || normalizeText(`${v.plate} ${v.circuits.join(' ')}`).includes(q),
    );
  }, [vehicles, deferred]);

  const columns: Column<VehicleOut>[] = [
    {
      id: 'plate',
      header: m.fleet_vehicle_plate(),
      cell: (v) => <span className="tabular-nums">{v.plate}</span>,
      primary: true,
    },
    {
      id: 'flags',
      header: m.fleet_vehicle_flags(),
      badge: true,
      cell: (v) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          {v.never_assigned && (
            <Flag
              label={m.fleet_flag_idle()}
              hint={m.fleet_flag_idle_hint()}
              tone="border-areia/60"
            />
          )}
          {v.multi_typology && (
            <Flag label={m.fleet_flag_multi()} hint={m.fleet_flag_multi_hint()} />
          )}
        </div>
      ),
    },
    {
      id: 'circuits',
      header: m.fleet_vehicle_circuits(),
      cell: (v) => (
        <span className="text-muted-foreground">{v.circuits.join(', ') || m.common_dash()}</span>
      ),
      className: 'max-w-xs whitespace-normal',
    },
    {
      id: 'typologies',
      header: m.fleet_vehicle_typologies(),
      cell: (v) => (
        <span className="text-muted-foreground">
          {v.typologies.map((t) => typologyLabel[t]()).join(', ') || m.common_dash()}
        </span>
      ),
      className: 'whitespace-normal',
    },
    {
      id: 'shifts',
      header: m.fleet_vehicle_shifts(),
      cell: (v) => v.weekday_shifts,
      align: 'right',
    },
    { id: 'crew', header: m.fleet_vehicle_crew(), cell: (v) => v.max_crew || dash, align: 'right' },
  ];

  return (
    <div className="space-y-3">
      <SearchBox value={query} onChange={setQuery} label={m.fleet_vehicle_search()} />
      <DataTable
        columns={columns}
        rows={rows}
        getKey={(v) => v.plate}
        caption={m.fleet_vehicles_title()}
      />
      <p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
        {m.fleet_vehicle_count({ shown: rows.length, total: vehicles.length })}
      </p>
    </div>
  );
}
