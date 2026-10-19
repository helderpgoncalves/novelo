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
import { DESTINATIONS } from './destination';

function DestinationBar({ entity }: { entity: EntityBaseline }) {
  return (
    <div
      className="flex h-2 w-32 overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`Reutilização ${formatPercent(entity.reuse_pct)}, reciclagem ${formatPercent(entity.recycle_pct)}, rejeito ${formatPercent(entity.reject_pct)}`}
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
            <TableHead className="h-10 px-4">Entidade</TableHead>
            <TableHead className="h-10 text-right">Recolhido</TableHead>
            <TableHead className="h-10 w-44">Destino</TableHead>
            <TableHead className="h-10 text-right">Reutilização</TableHead>
            <TableHead className="h-10 text-right">Reciclagem</TableHead>
            <TableHead className="h-10 text-right">Rejeito</TableHead>
            <TableHead className="h-10 pr-4">Dados</TableHead>
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
                      variant={e.exact_weights ? 'secondary' : 'outline'}
                      className="cursor-help font-semibold text-[10px] uppercase tracking-wider"
                    >
                      {e.exact_weights ? 'kg exatos' : 'estimativa'}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{e.source}</TooltipContent>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
