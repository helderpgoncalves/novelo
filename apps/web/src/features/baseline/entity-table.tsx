import type { EntityBaseline } from '@/client';
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
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 px-4">{m.entity_table_entity()}</TableHead>
            <TableHead className="h-10 text-right">{m.entity_table_collected()}</TableHead>
            <TableHead className="h-10 w-44">{m.entity_table_destination()}</TableHead>
            <TableHead className="h-10 text-right">{m.entity_table_reuse()}</TableHead>
            <TableHead className="h-10 text-right">{m.entity_table_recycle()}</TableHead>
            <TableHead className="h-10 text-right">{m.entity_table_reject()}</TableHead>
            <TableHead className="h-10 pr-4">{m.entity_table_data()}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entities.map((e) => (
            <TableRow key={e.entity}>
              <TableCell className="px-4 font-medium">{e.entity}</TableCell>
              <TableCell className="text-right tabular-nums">{formatTonnes(e.total_t)}</TableCell>
              <TableCell>
                <DestinationBar entity={e} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPercent(e.reuse_pct)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPercent(e.recycle_pct)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPercent(e.reject_pct)}
              </TableCell>
              <TableCell className="pr-4">
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
