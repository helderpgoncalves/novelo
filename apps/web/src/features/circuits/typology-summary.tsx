import type { CircuitOut, Typology } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { formatNumber } from '@/lib/format';
import { typologyLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

interface TypologyRow {
  typology: Typology;
  circuits: number;
  withVehicle: number;
  localities: number;
  vehicles: number;
}

/** Agrega os circuitos por tipologia: o resumo que responde a "onde já há camião". */
function summarise(circuits: CircuitOut[]): TypologyRow[] {
  const groups = new Map<Typology, CircuitOut[]>();
  for (const c of circuits) groups.set(c.typology, [...(groups.get(c.typology) ?? []), c]);
  return [...groups.entries()]
    .map(([typology, items]) => ({
      typology,
      circuits: items.length,
      withVehicle: items.filter((c) => c.vehicles.length > 0).length,
      localities: new Set(items.flatMap((c) => c.localities)).size,
      vehicles: new Set(items.flatMap((c) => c.vehicles)).size,
    }))
    .sort((a, b) => b.circuits - a.circuits);
}

export function TypologySummary({ circuits }: { circuits: CircuitOut[] }) {
  const columns: Column<TypologyRow>[] = [
    {
      id: 'typology',
      header: m.circuits_table_typology(),
      primary: true,
      value: (r) => typologyLabel[r.typology](),
      cell: (r) => typologyLabel[r.typology](),
    },
    {
      id: 'circuits',
      header: m.fleet_table_circuits(),
      align: 'right',
      value: (r) => r.circuits,
      cell: (r) => formatNumber(r.circuits),
    },
    {
      id: 'with-vehicle',
      header: m.rw_circuits_with_vehicle(),
      align: 'right',
      value: (r) => r.withVehicle,
      cell: (r) => formatNumber(r.withVehicle),
    },
    {
      id: 'without',
      header: m.fleet_table_without_vehicle(),
      align: 'right',
      value: (r) => r.circuits - r.withVehicle,
      cell: (r) => formatNumber(r.circuits - r.withVehicle),
    },
    {
      id: 'localities',
      header: m.circuits_table_localities(),
      align: 'right',
      value: (r) => r.localities,
      cell: (r) => formatNumber(r.localities),
    },
    {
      id: 'vehicles',
      header: m.circuits_table_vehicles(),
      align: 'right',
      value: (r) => r.vehicles,
      cell: (r) => formatNumber(r.vehicles),
    },
  ];
  return (
    <DataTable
      id="circuits-typology"
      controls="never"
      columns={columns}
      rows={summarise(circuits)}
      getKey={(r) => r.typology}
      caption={m.rw_circuits_tab_typology()}
    />
  );
}
