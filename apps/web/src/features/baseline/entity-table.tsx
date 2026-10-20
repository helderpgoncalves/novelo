import type { EntityBaseline } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatPercent, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { DESTINATIONS } from './destination';

function DestinationBar({ entity }: { entity: EntityBaseline }) {
  return (
    <div
      className="flex h-2 w-32 overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={m.entity_destination_aria({
        reuse: formatPercent(entity.reuse_pct),
        recycle: formatPercent(entity.recycle_pct),
        reject: formatPercent(entity.reject_pct),
      })}
    >
      {DESTINATIONS.map((d) => (
        <div
          key={d.key}
          className={d.className}
          style={{ width: `${entity[`${d.key}_pct` as const]}%` }}
        />
      ))}
    </div>
  );
}

export function EntityTable({ entities }: { entities: EntityBaseline[] }) {
  const pct = (v: number) => formatPercent(v);
  const columns: Column<EntityBaseline>[] = [
    {
      id: 'entity',
      header: m.entity_table_entity(),
      cell: (e) => e.entity,
      value: (e) => e.entity,
      primary: true,
    },
    {
      id: 'method',
      header: m.entity_table_data(),
      badge: true,
      value: (e) => e.method,
      filter: { format: (v) => (v === 'weighed' ? m.method_weighed() : m.method_percentage()) },
      cell: (e) => <MethodBadge entity={e} />,
    },
    {
      id: 'collected',
      aggregate: 'sum',
      format: (n) => formatTonnes(n),
      header: m.entity_table_collected(),
      align: 'right',
      value: (e) => e.total_t,
      cell: (e) => formatTonnes(e.total_t),
    },
    {
      id: 'destination',
      header: m.entity_table_destination(),
      className: 'w-44',
      full: true,
      sortable: false,
      cell: (e) => <DestinationBar entity={e} />,
    },
    {
      id: 'reuse',
      header: m.entity_table_reuse(),
      align: 'right',
      value: (e) => e.reuse_pct,
      cell: (e) => pct(e.reuse_pct),
    },
    {
      id: 'recycle',
      header: m.entity_table_recycle(),
      align: 'right',
      value: (e) => e.recycle_pct,
      cell: (e) => pct(e.recycle_pct),
    },
    {
      id: 'reject',
      header: m.entity_table_reject(),
      align: 'right',
      value: (e) => e.reject_pct,
      cell: (e) => pct(e.reject_pct),
    },
  ];
  return (
    <DataTable
      id="entities"
      exportName="entidades"
      controls="never"
      columns={columns}
      rows={entities}
      getRowId={(e) => e.entity}
      caption={m.entity_table_entity()}
    />
  );
}

function MethodBadge({ entity: e }: { entity: EntityBaseline }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={e.method === 'weighed' ? 'secondary' : 'outline'}
          className="cursor-help font-semibold text-[10px] uppercase tracking-wider"
        >
          {e.method === 'weighed' ? m.method_weighed() : m.method_percentage()}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {e.provenance}
        <span className="mt-1 block opacity-70">{m.common_original_pt()}</span>
      </TooltipContent>
    </Tooltip>
  );
}
