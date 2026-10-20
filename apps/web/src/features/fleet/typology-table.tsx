import type { TypologyFleet } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { formatNumber } from '@/lib/format';
import { typologyLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

const num = (value: number | null | undefined) =>
  value == null ? m.common_dash() : formatNumber(value);

export function TypologyTable({ typologies }: { typologies: TypologyFleet[] }) {
  const columns: Column<TypologyFleet>[] = [
    {
      id: 'typology',
      header: m.fleet_typology_header(),
      cell: (t) => typologyLabel[t.typology](),
      value: (t) => typologyLabel[t.typology](),
      primary: true,
    },
    {
      id: 'circuits',
      header: m.fleet_table_circuits(),
      value: (t) => t.circuits,
      cell: (t) => num(t.circuits),
      align: 'right',
    },
    {
      id: 'without',
      header: m.fleet_table_without_vehicle(),
      value: (t) => t.circuits_without_vehicle,
      cell: (t) => num(t.circuits_without_vehicle),
      align: 'right',
    },
    {
      id: 'vs',
      header: m.fleet_table_vehicle_shifts(),
      value: (t) => t.vehicle_shifts_week,
      cell: (t) => num(t.vehicle_shifts_week),
      align: 'right',
    },
    {
      id: 'cs',
      header: m.fleet_table_crew_shifts(),
      value: (t) => t.crew_shifts_week,
      cell: (t) => num(t.crew_shifts_week),
      align: 'right',
    },
    {
      id: 'fv',
      header: m.fleet_table_fleet_vehicles(),
      value: (t) => t.fleet_vehicles,
      cell: (t) => num(t.fleet_vehicles),
      align: 'right',
    },
    {
      id: 'fc',
      header: m.fleet_table_fleet_crew(),
      value: (t) => t.fleet_crew,
      cell: (t) => num(t.fleet_crew),
      align: 'right',
    },
  ];
  return (
    <DataTable
      id="typologies"
      exportName="frota-por-tipologia"
      controls="never"
      columns={columns}
      rows={typologies}
      getRowId={(t) => t.typology}
      caption={m.fleet_summary_title()}
    />
  );
}
