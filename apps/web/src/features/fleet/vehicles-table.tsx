import type { VehicleOut } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
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
  const columns: Column<VehicleOut>[] = [
    {
      id: 'plate',
      header: m.fleet_vehicle_plate(),
      cell: (v) => <span className="tabular-nums">{v.plate}</span>,
      value: (v) => v.plate,
      primary: true,
    },
    {
      id: 'flags',
      header: m.fleet_vehicle_flags(),
      badge: true,
      sortable: false,
      value: (v) =>
        [v.never_assigned && m.fleet_flag_idle(), v.multi_typology && m.fleet_flag_multi()]
          .filter(Boolean)
          .join(' '),
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
      value: (v) => v.circuits.join(', '),
      cell: (v) => (
        <span className="text-muted-foreground">{v.circuits.join(', ') || m.common_dash()}</span>
      ),
      className: 'max-w-xs whitespace-normal',
    },
    {
      id: 'typologies',
      header: m.fleet_vehicle_typologies(),
      value: (v) => v.typologies.map((t) => typologyLabel[t]()).join(', '),
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
      value: (v) => v.weekday_shifts,
      searchable: false,
      align: 'right',
    },
    {
      id: 'crew',
      header: m.fleet_vehicle_crew(),
      cell: (v) => v.max_crew || dash,
      value: (v) => v.max_crew,
      searchable: false,
      align: 'right',
    },
  ];

  return (
    <DataTable
      id="vehicles"
      columns={columns}
      rows={vehicles}
      getKey={(v) => v.plate}
      caption={m.fleet_vehicles_title()}
      searchLabel={m.fleet_vehicle_search()}
      pageSize={10}
    />
  );
}
