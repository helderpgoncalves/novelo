import { CalendarDays, MapPin } from 'lucide-react';
import type { VehicleOut } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatNumber } from '@/lib/format';
import { typologyLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';
import { MiniWeek } from './mini-week';
import { buildBlocks, type Occurrence, slotKey } from './schedule';
import { TypologyMark } from './typology-style';

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

interface Row extends VehicleOut {
  occs: Occurrence[];
  weekShifts: number;
  weekDays: number;
}

interface VehiclesTableProps {
  vehicles: VehicleOut[];
  occs: Occurrence[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  refreshing?: boolean;
  onOpen: (plate: string) => void;
  onCalendar: (plate: string) => void;
  onMap: (plate: string) => void;
}

export function VehiclesTable({
  vehicles,
  occs,
  loading,
  error,
  onRetry,
  refreshing,
  onOpen,
  onCalendar,
  onMap,
}: VehiclesTableProps) {
  const rows: Row[] = vehicles.map((v) => {
    const own = occs.filter((o) => o.plate === v.plate);
    return {
      ...v,
      occs: own,
      weekShifts: new Set(own.map((o) => slotKey(o.day, o.shift))).size,
      weekDays: new Set(own.map((o) => o.day)).size,
    };
  });

  const columns: Column<Row>[] = [
    {
      id: 'plate',
      header: m.fleet_vehicle_plate(),
      cell: (v) => (
        <button
          type="button"
          onClick={() => onOpen(v.plate)}
          className="rounded font-medium tabular-nums underline-offset-2 hover:underline"
          aria-haspopup="dialog"
        >
          {v.plate}
        </button>
      ),
      value: (v) => v.plate,
      primary: true,
      pinned: 'left',
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
      filter: false,
      cell: (v) => (
        <div className="flex flex-wrap justify-end gap-1.5 sm:justify-start">
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
          {!v.never_assigned && !v.multi_typology && dash}
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
      filter: false,
      cell: (v) =>
        v.typologies.length ? (
          <span className="flex flex-wrap gap-x-3 gap-y-0.5">
            {v.typologies.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-muted-foreground">
                <TypologyMark typology={t} />
                {typologyLabel[t]()}
              </span>
            ))}
          </span>
        ) : (
          dash
        ),
      className: 'whitespace-normal',
    },
    {
      id: 'week-shifts',
      header: m.fl_vehicle_week_shifts(),
      cell: (v) => formatNumber(v.weekShifts),
      value: (v) => v.weekShifts,
      searchable: false,
      aggregate: 'sum',
      format: formatNumber,
      align: 'right',
    },
    {
      id: 'week-days',
      header: m.fl_vehicle_week_days(),
      cell: (v) => formatNumber(v.weekDays),
      value: (v) => v.weekDays,
      searchable: false,
      align: 'right',
    },
    {
      id: 'shifts',
      header: m.fleet_vehicle_shifts(),
      cell: (v) => v.weekday_shifts,
      value: (v) => v.weekday_shifts,
      searchable: false,
      defaultHidden: true,
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
      exportName="viaturas"
      columns={columns}
      rows={rows}
      getRowId={(v) => v.plate}
      caption={m.fleet_vehicles_title()}
      searchLabel={m.fleet_vehicle_search()}
      pageSize={10}
      loading={loading}
      error={error}
      onRetry={onRetry}
      refreshing={refreshing}
      rowActions={(v) => [
        { id: 'open', label: m.fl_action_detail(), onSelect: () => onOpen(v.plate) },
        {
          id: 'calendar',
          label: m.fl_action_calendar(),
          icon: <CalendarDays />,
          onSelect: () => onCalendar(v.plate),
        },
        {
          id: 'map',
          label: m.fl_action_map(),
          icon: <MapPin />,
          disabled: v.never_assigned,
          onSelect: () => onMap(v.plate),
        },
      ]}
      renderExpanded={(v) =>
        v.never_assigned ? (
          <p className="text-muted-foreground text-sm">{m.fl_vehicle_idle_row()}</p>
        ) : (
          <div className="max-w-3xl space-y-2">
            <MiniWeek
              caption={m.fl_detail_week_caption({ name: v.plate })}
              items={buildBlocks(
                occs.filter((o) => o.plate === v.plate),
                occs,
              ).map((b) => ({
                day: b.day,
                shift: b.shift,
                label: b.circuit,
                typology: b.typology,
              }))}
            />
            <p className="text-muted-foreground text-xs">{m.fl_calendar_notice_short()}</p>
          </div>
        )
      }
    />
  );
}
