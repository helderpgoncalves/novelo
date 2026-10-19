import type { WasteComposition } from '@/client';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { wasteCategoryLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

/** Composição dos resíduos em Portugal: onde pesam os têxteis face ao resto. */
export function WasteCompositionChart({ waste }: { waste: WasteComposition }) {
  const rows = waste.shares
    .filter((s) => s.scope === 'portugal')
    .sort((a, b) => b.share_pct - a.share_pct);
  const max = Math.max(...rows.map((r) => r.share_pct));

  return (
    <ul className="space-y-2" aria-label={m.waste_aria()}>
      {rows.map((r) => {
        const highlight = r.category === 'textiles';
        return (
          <li
            key={r.category}
            className="grid grid-cols-[9.5rem_1fr_3.5rem] items-center gap-3 text-sm"
          >
            <span className={cn('truncate', highlight ? 'font-semibold' : 'text-muted-foreground')}>
              {wasteCategoryLabel[r.category]()}
            </span>
            <span className="h-2.5 overflow-hidden rounded-full bg-muted">
              <span
                className={cn(
                  'block h-full rounded-full',
                  highlight
                    ? 'bg-primary'
                    : r.category === 'sanitary_textiles'
                      ? 'bg-areia'
                      : 'bg-muted-foreground/40',
                )}
                style={{ width: `${(r.share_pct / max) * 100}%` }}
              />
            </span>
            <span className="text-right tabular-nums">{formatNumber(r.share_pct, 2)}%</span>
          </li>
        );
      })}
    </ul>
  );
}
