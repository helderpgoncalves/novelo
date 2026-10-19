import { Check } from 'lucide-react';
import type { CompositionPart, LotEventOut, LotState } from '@/client';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/format';
import { formatDateTime } from '@/lib/i18n';
import { fibreLabel, lotEventLabel, lotStateLabel } from '@/lib/lots';
import { cn } from '@/lib/utils';

const STATE_TONE: Record<LotState, string> = {
  collected: 'border-areia/70',
  sorted: 'border-primary/50 text-primary',
  reserved: 'border-primary bg-primary/10 text-primary',
  delivered: 'bg-primary text-primary-foreground',
};

export function LotStateBadge({ state }: { state: LotState }) {
  return (
    <Badge
      variant="outline"
      className={cn('font-semibold text-[10px] uppercase tracking-wider', STATE_TONE[state])}
    >
      {lotStateLabel[state]()}
    </Badge>
  );
}

const FIBRE_SHADES = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
  'bg-muted-foreground/40',
];

/** Barra de composição com legenda: o mesmo desenho no lote, no passaporte e na bolsa. */
export function CompositionBar({ composition }: { composition: CompositionPart[] }) {
  if (composition.length === 0) return <p className="text-muted-foreground text-sm">-</p>;
  return (
    <div className="space-y-2">
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={composition
          .map((p) => `${fibreLabel[p.fibre]()} ${formatNumber(p.pct, 0)}%`)
          .join(', ')}
      >
        {composition.map((p, i) => (
          <div
            key={p.fibre}
            className={FIBRE_SHADES[i % FIBRE_SHADES.length]}
            style={{ width: `${p.pct}%` }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {composition.map((p, i) => (
          <li key={p.fibre} className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className={cn('size-2.5 rounded-sm', FIBRE_SHADES[i % FIBRE_SHADES.length])}
              aria-hidden="true"
            />
            {fibreLabel[p.fibre]()}{' '}
            <span className="font-medium text-foreground tabular-nums">
              {formatNumber(p.pct, 0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EventTimeline({ events }: { events: LotEventOut[] }) {
  // "Peça acrescentada" repete-se: agrupa para o histórico ficar legível.
  const grouped = events.reduce<{ kind: LotEventOut['kind']; at: string; count: number }[]>(
    (acc, e) => {
      const last = acc[acc.length - 1];
      if (last && last.kind === e.kind && e.kind === 'item_added') last.count += 1;
      else acc.push({ kind: e.kind, at: e.occurred_at, count: 1 });
      return acc;
    },
    [],
  );

  return (
    <ol className="space-y-4">
      {grouped.map((e) => (
        <li key={`${e.kind}-${e.at}`} className="relative flex gap-3 pl-1">
          <span
            className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            <Check className="size-3" />
          </span>
          <div>
            <p className="font-medium text-sm">
              {lotEventLabel[e.kind]()}
              {e.count > 1 && (
                <span className="ml-1 text-muted-foreground tabular-nums">×{e.count}</span>
              )}
            </p>
            <p className="text-muted-foreground text-xs tabular-nums">{formatDateTime(e.at)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
