import type { ModeSummary } from '@/client';
import { ModeDot } from '@/components/mode-badge';
import { formatEur, formatNumber, formatTonnes } from '@/lib/format';
import { modeHint, modeLabel } from '@/lib/scenario';
import { m } from '@/paraglide/messages';

export function ModeSummaryCards({
  modes,
  totalTonnes,
}: {
  modes: ModeSummary[];
  totalTonnes: number;
}) {
  return (
    <ul className="grid gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border sm:grid-cols-3">
      {modes.map((s) => (
        <li key={s.mode} className="space-y-2 bg-card p-5">
          <p className="flex items-center gap-2 font-medium">
            <ModeDot mode={s.mode} /> {modeLabel[s.mode]()}
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">{modeHint[s.mode]()}</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-sm tabular-nums">
            <dt className="text-muted-foreground">{m.mode_summary_zones()}</dt>
            <dd className="text-right">{formatNumber(s.zones)}</dd>
            <dt className="text-muted-foreground">{m.mode_summary_points()}</dt>
            <dd className="text-right">{formatNumber(s.points)}</dd>
            <dt className="text-muted-foreground">{m.mode_summary_tonnes()}</dt>
            <dd className="text-right">
              {formatTonnes(s.tonnes)}{' '}
              <span className="text-muted-foreground">
                ({formatNumber(totalTonnes ? (s.tonnes / totalTonnes) * 100 : 0, 0)}%)
              </span>
            </dd>
            <dt className="text-muted-foreground">{m.mode_summary_cost()}</dt>
            <dd className="text-right">{formatEur(s.annual_cost_eur)}</dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}
