import { formatPercent } from '@/lib/format';
import { m } from '@/paraglide/messages';

/** Barra de percentagem com o valor ao lado; a barra é decorativa e o texto leva o significado. */
export function PctBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="flex min-w-28 items-center gap-2.5">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={m.mun_bar_label({ label, value: formatPercent(pct, 0) })}
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <span className="w-11 text-right font-medium tabular-nums">{formatPercent(pct, 0)}</span>
    </div>
  );
}
