import type { LocalityOut } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { WeekdayDots } from '@/components/weekdays';
import { collectionLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

const dash = <span className="text-muted-foreground">{m.common_dash()}</span>;

export function LocalitiesTable({ localities }: { localities: LocalityOut[] }) {
  const columns: Column<LocalityOut>[] = [
    {
      id: 'name',
      header: m.localities_table_locality(),
      cell: (l) => l.name,
      value: (l) => l.name,
      primary: true,
    },
    {
      id: 'frequency',
      header: m.localities_table_frequency(),
      cell: (l) => l.days_per_week,
      value: (l) => l.days_per_week,
      filter: { format: (v) => m.localities_days_filter({ days: v }) },
      badge: true,
      align: 'right',
    },
    {
      id: 'circuits',
      header: m.localities_table_circuits(),
      value: (l) => l.circuits.join(', '),
      cell: (l) => <span className="text-muted-foreground">{l.circuits.join(', ')}</span>,
    },
    {
      id: 'collection',
      header: m.localities_table_collection(),
      value: (l) => l.collection_types.map((c) => collectionLabel[c]()).join(', '),
      cell: (l) => (
        <span className="text-muted-foreground">
          {l.collection_types.map((c) => collectionLabel[c]()).join(', ') || m.common_dash()}
        </span>
      ),
    },
    {
      id: 'days',
      header: m.localities_table_days(),
      value: (l) => l.weekdays.length,
      cell: (l) => (l.weekdays.length ? <WeekdayDots days={l.weekdays} /> : dash),
    },
  ];

  return (
    <DataTable
      id="localities"
      exportName="localidades"
      columns={columns}
      rows={localities}
      getRowId={(l) => l.name}
      caption={m.localities_title()}
      searchLabel={m.localities_search()}
      pageSize={25}
    />
  );
}
