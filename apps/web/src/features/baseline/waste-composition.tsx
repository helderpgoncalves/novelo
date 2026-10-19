import type { WasteComposition } from '@/client';
import { formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

const TEXTILE = 'Têxteis';
const SANITARY = 'Têxteis Sanitários';

/** Composição dos resíduos em Portugal: onde pesam os têxteis face ao resto. */
export function WasteCompositionChart({ waste }: { waste: WasteComposition }) {
  const rows = waste.shares
    .filter((s) => s.scope === 'Portugal')
    .sort((a, b) => b.share_pct - a.share_pct);
  const max = Math.max(...rows.map((r) => r.share_pct));

  return (
    <ul className="space-y-2" aria-label="Composição dos resíduos urbanos em Portugal">
      {rows.map((r) => {
        const highlight = r.category === TEXTILE;
        return (
          <li
            key={r.category}
            className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-3 text-sm"
          >
            <span className={cn('truncate', highlight ? 'font-semibold' : 'text-muted-foreground')}>
              {r.category}
            </span>
            <span className="h-2.5 overflow-hidden rounded-full bg-muted">
              <span
                className={cn(
                  'block h-full rounded-full',
                  highlight
                    ? 'bg-primary'
                    : r.category === SANITARY
                      ? 'bg-areia'
                      : 'bg-muted-foreground/40',
                )}
                style={{ width: `${(r.share_pct / max) * 100}%` }}
              />
            </span>
            <span className="text-right tabular-nums">
              {formatPercent(r.share_pct, 2).replace(/,00%$/, '%')}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
