import type { CircuitOut, CircuitStatus, CollectionType, Typology } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { WeekdayDots } from '@/components/weekdays';
import { circuitStatusLabel, collectionLabel, typologyLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

const dash = <span className="text-muted-foreground">{m.common_dash()}</span>;

export function CircuitsTable({ circuits }: { circuits: CircuitOut[] }) {
  const columns: Column<CircuitOut>[] = [
    {
      id: 'code',
      header: m.circuits_table_circuit(),
      cell: (c) => c.code,
      value: (c) => c.code,
      primary: true,
    },
    {
      id: 'status',
      header: m.circuits_table_status(),
      badge: true,
      value: (c) => c.status,
      filter: { format: (v) => circuitStatusLabel[v as CircuitStatus]() },
      cell: (c) => (
        <Badge
          variant={c.status === 'ok' ? 'secondary' : 'outline'}
          className="whitespace-nowrap font-semibold text-[10px] uppercase tracking-wider"
        >
          {circuitStatusLabel[c.status]()}
        </Badge>
      ),
    },
    {
      id: 'typology',
      header: m.circuits_table_typology(),
      value: (c) => c.typology,
      filter: { format: (v) => typologyLabel[v as Typology]() },
      cell: (c) => typologyLabel[c.typology](),
    },
    {
      id: 'collection',
      header: m.circuits_table_collection(),
      value: (c) => c.collection_type,
      filter: { format: (v) => collectionLabel[v as CollectionType]() },
      cell: (c) =>
        c.collection_type === 'unspecified' ? dash : collectionLabel[c.collection_type](),
    },
    {
      id: 'days',
      header: m.circuits_table_days(),
      value: (c) => c.weekdays.length,
      cell: (c) => (c.weekdays.length ? <WeekdayDots days={c.weekdays} /> : dash),
    },
    {
      id: 'vehicles',
      header: m.circuits_table_vehicles(),
      value: (c) => c.vehicles.join(', '),
      cell: (c) => c.vehicles.join(', ') || dash,
      className: 'max-w-[12rem] whitespace-normal',
    },
    {
      id: 'localities',
      header: m.circuits_table_localities(),
      value: (c) => c.localities.join(', '),
      cell: (c) => (
        <span className="text-muted-foreground">{c.localities.join(', ') || m.common_dash()}</span>
      ),
      className: 'min-w-56 max-w-xs whitespace-normal',
    },
  ];

  return (
    <DataTable
      id="circuits"
      exportName="circuitos"
      columns={columns}
      rows={circuits}
      getRowId={(c) => c.code}
      caption={m.circuits_title()}
      searchLabel={m.circuits_search()}
      pageSize={25}
    />
  );
}
