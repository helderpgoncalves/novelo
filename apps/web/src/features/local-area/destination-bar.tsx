/** Barra e legenda de destinos (reutilização/reciclagem/rejeito) — as mesmas cores da composição do lote. */

import { formatKg, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { destinationLabel } from '@/lib/vocab';

export interface DestinationSplit {
  reuse: number;
  recycle: number;
  reject: number;
}

const DESTINO_SHADE = {
  reuse: 'bg-chart-1',
  recycle: 'bg-chart-2',
  reject: 'bg-muted-foreground/40',
} as const;

export function DestinationBar({
  split,
  className,
}: {
  split: DestinationSplit;
  className?: string;
}) {
  const total = split.reuse + split.recycle + split.reject;
  const seg = (kg: number) => `${total > 0 ? (kg / total) * 100 : 0}%`;
  return (
    <div
      className={cn(
        'flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-transparent',
        className,
      )}
    >
      <div className={DESTINO_SHADE.reuse} style={{ width: seg(split.reuse) }} />
      <div className={DESTINO_SHADE.recycle} style={{ width: seg(split.recycle) }} />
      <div className={DESTINO_SHADE.reject} style={{ width: seg(split.reject) }} />
    </div>
  );
}

export function DestinationLegend({
  split,
  pct,
  className,
}: {
  split: DestinationSplit;
  pct?: DestinationSplit | null;
  className?: string;
}) {
  const rows: { key: keyof DestinationSplit; kg: number }[] = [
    { key: 'reuse', kg: split.reuse },
    { key: 'recycle', kg: split.recycle },
    { key: 'reject', kg: split.reject },
  ];
  return (
    <dl className={cn('space-y-1.5 text-sm', className)}>
      {rows.map((row) => (
        <div key={row.key} className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground flex items-center gap-2">
            <span className={cn('size-2 rounded-full', DESTINO_SHADE[row.key])} aria-hidden />
            {destinationLabel[row.key]()}
            {pct && <span className="text-xs">({formatPercent(pct[row.key])})</span>}
          </dt>
          <dd className="font-medium tabular-nums">{formatKg(row.kg)}</dd>
        </div>
      ))}
    </dl>
  );
}
