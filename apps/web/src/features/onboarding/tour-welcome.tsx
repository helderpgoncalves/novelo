import { useQuery } from '@tanstack/react-query';
import { getOverviewOptions } from '@/client/@tanstack/react-query.gen';
import { BrandSymbol } from '@/components/brand-logo';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPercent, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';

/** Números reais de Guimarães (os mesmos da página inicial), lidos da API; nunca inventados. */
function Stats({ enabled }: { enabled: boolean }) {
  const overview = useQuery({ ...getOverviewOptions(), enabled });
  const gap = overview.data?.gap;

  if (overview.isPending && enabled) {
    return (
      <div className="space-y-3" role="status" aria-label={m.common_loading()}>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }
  if (!gap) {
    return (
      <p className="text-muted-foreground text-sm leading-relaxed">{m.tour_stats_fallback()}</p>
    );
  }
  const rows = [
    [formatTonnes(gap.collected_t, 1), m.tour_stat_collected()],
    [formatPercent(gap.capture_pct, 1), m.tour_stat_capture()],
    [formatTonnes(gap.missing_t, 0), m.tour_stat_missing()],
  ] as const;
  return (
    <div className="space-y-2.5">
      <ul
        aria-label={m.tour_stats_label()}
        className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-background/60"
      >
        {rows.map(([value, label]) => (
          <li key={label} className="flex items-baseline gap-3 px-3.5 py-2.5">
            <span className="w-24 shrink-0 font-serif text-2xl tabular-nums leading-none">
              {value}
            </span>
            <span className="text-muted-foreground text-sm leading-snug">{label}</span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs leading-relaxed">{m.tour_stats_source()}</p>
    </div>
  );
}

export function TourWelcome({ short, active }: { short: boolean; active: boolean }) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <BrandSymbol className="size-9 text-primary" />
        <div className="space-y-1.5">
          <p className="font-semibold text-[11px] text-primary uppercase tracking-[0.18em]">
            {m.tour_welcome_eyebrow()}
          </p>
          <h2 id="tour-title" className="text-balance font-serif text-2xl leading-tight">
            {m.tour_welcome_title()}
          </h2>
          <p id="tour-text" className="text-muted-foreground text-sm leading-relaxed">
            {m.tour_welcome_text()} {short ? m.tour_welcome_short() : m.tour_welcome_full()}
          </p>
        </div>
      </div>
      <Stats enabled={active} />
    </div>
  );
}
