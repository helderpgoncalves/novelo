import { ExternalLink } from 'lucide-react';
import type { OverviewReference } from '@/client';
import { intlTag } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { useInView, useMotion } from './motion';
import { EstimateTag, UnverifiedTag } from './story-section';

const kg = (v: number) =>
  new Intl.NumberFormat(intlTag(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    v,
  );

/** Comparação em kg por habitante e por ano: Guimarães contra as referências e o potencial. */
export function GapChart({ references }: { references: OverviewReference[] }) {
  const { enabled } = useMotion();
  const [ref, seen] = useInView<HTMLUListElement>(0.15);
  const self = references.find((r) => r.key === 'guimaraes_2025');
  const rows = [...references].sort((a, b) => a.kg_per_inhab_year - b.kg_per_inhab_year);
  const max = Math.ceil(Math.max(...rows.map((r) => r.kg_per_inhab_year)) + 0.5);
  const base = self?.kg_per_inhab_year ?? 0;
  const pct = (v: number) => `${(v / max) * 100}%`;
  const drawn = seen || !enabled;

  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
      <ul ref={ref} className="divide-y divide-border">
        {rows.map((r, index) => {
          const isSelf = r.key === 'guimaraes_2025';
          const gapKg = r.kg_per_inhab_year - base;
          const flip = r.kg_per_inhab_year / max > 0.78;
          return (
            <li
              key={r.key}
              className="grid grid-cols-1 gap-x-6 gap-y-1 py-3.5 first:pt-0 last:pb-0 sm:grid-cols-[13rem_minmax(0,1fr)] sm:items-center"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={cn('text-sm', isSelf ? 'font-semibold' : 'font-medium')}>
                    {r.label}
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">{r.year}</span>
                  {!r.verified && <UnverifiedTag />}
                  {r.verified && r.is_estimate && !isSelf && <EstimateTag />}
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {r.source_url ? (
                    <a
                      href={r.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 underline-offset-2 hover:text-foreground hover:underline"
                    >
                      {r.source_label}
                      <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                      <span className="sr-only">{m.common_opens_new_tab()}</span>
                    </a>
                  ) : (
                    r.source_label
                  )}
                </p>
              </div>
              <div className="relative h-11">
                <div aria-hidden="true" className="absolute inset-x-0 top-4 h-px bg-border" />
                {/* haste: de 0 até ao valor (ou até Guimarães, e o resto a tracejado) */}
                <div
                  aria-hidden="true"
                  className={cn(
                    'absolute top-[15px] h-[3px] origin-left rounded-full',
                    r.verified ? 'bg-primary' : 'bg-foreground/35',
                  )}
                  style={{
                    width: pct(isSelf ? base : Math.min(base, r.kg_per_inhab_year)),
                    transform: drawn ? 'scaleX(1)' : 'scaleX(0)',
                    transition: enabled
                      ? `transform 0.8s cubic-bezier(.22,.8,.3,1) ${index * 80}ms`
                      : 'none',
                  }}
                />
                {!isSelf && gapKg > 0 && (
                  <div
                    aria-hidden="true"
                    className="absolute top-[14px] h-[5px] border-foreground/55 border-y-0 border-t-2 border-dashed"
                    style={{
                      left: pct(base),
                      width: pct(gapKg),
                      opacity: drawn ? 1 : 0,
                      transition: enabled ? `opacity 0.5s ease ${600 + index * 80}ms` : 'none',
                    }}
                  />
                )}
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-4 z-10 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card',
                    isSelf && 'size-5 bg-primary',
                    !isSelf && r.verified && 'bg-foreground',
                    !r.verified && 'border-2 border-foreground/60 border-dashed bg-card',
                  )}
                  style={{ left: pct(r.kg_per_inhab_year) }}
                />
                <span
                  className={cn(
                    'absolute top-1 whitespace-nowrap font-semibold text-sm tabular-nums',
                    flip ? '-translate-x-full bg-card pr-5' : 'pl-4',
                  )}
                  style={{ left: pct(r.kg_per_inhab_year) }}
                >
                  {kg(r.kg_per_inhab_year)}
                  <span className="ml-1 font-normal text-muted-foreground text-xs">
                    {m.home_gap_unit()}
                  </span>
                </span>
                {!isSelf && gapKg > 0 && (
                  <span
                    className="absolute top-[26px] -translate-x-1/2 whitespace-nowrap text-[11px] text-muted-foreground tabular-nums"
                    style={{ left: pct(base + gapKg / 2) }}
                  >
                    {m.home_gap_distance({ kg: kg(gapKg) })}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-border border-t pt-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-foreground" aria-hidden="true" />
          {m.home_gap_legend_verified()}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-full border border-foreground/60 border-dashed"
            aria-hidden="true"
          />
          {m.home_gap_legend_unverified()}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-5 border-foreground/55 border-t-2 border-dashed" aria-hidden="true" />
          {m.home_gap_legend_distance()}
        </span>
      </p>
    </div>
  );
}
