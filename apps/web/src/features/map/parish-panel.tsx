import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { MousePointerClick } from 'lucide-react';
import type { ZoneOut } from '@/client';
import { getMunicipalParishOptions } from '@/client/@tanstack/react-query.gen';
import { WeekdayDots } from '@/components/weekdays';
import { EstimateBadge } from '@/features/municipal/note';
import { formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { tipauLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

/**
 * Métricas dos contentores municipais da freguesia, à parte do resto do painel: não são contentores de têxteis.
 * Se o pacote municipal não estiver importado, o bloco não aparece (não é essencial a este painel).
 */
function MunicipalSummary({ code }: { code: string }) {
  const { data, isPending, isError } = useQuery(
    getMunicipalParishOptions({ path: { dicofre: code } }),
  );
  if (isError) return null;
  return (
    <section
      aria-label={m.mapm_parish_title()}
      className="space-y-2 border-t pt-4"
      data-testid="parish-municipal"
    >
      <p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
        {m.mapm_parish_title()}
      </p>
      {isPending ? (
        <p role="status" className="text-muted-foreground text-xs">
          {m.common_loading()}
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">{m.mapm_parish_containers()}</dt>
              <dd className="font-medium tabular-nums">{formatNumber(data.containers)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">{m.mapm_parish_per_1000()}</dt>
              <dd className="font-medium tabular-nums">
                {formatNumber(data.containers_per_1000_hab, 1)}
              </dd>
            </div>
            <div>
              <dt className="flex flex-wrap items-center gap-1 text-muted-foreground text-xs">
                {m.mapm_parish_cover()} <EstimateBadge />
              </dt>
              <dd className="font-medium tabular-nums">{formatPercent(data.cover_pct_300m, 0)}</dd>
            </div>
          </dl>
          <p className="text-muted-foreground text-xs leading-relaxed">{m.mapm_parish_note()}</p>
          <Link
            to="/municipal"
            search={{ tab: 'parishes', parish: code }}
            className="inline-flex min-h-10 items-center text-primary text-sm underline-offset-4 hover:underline"
          >
            {m.mapm_parish_link()}
          </Link>
        </>
      )}
    </section>
  );
}

export function ParishPanel({ zone }: { zone: ZoneOut | null }) {
  if (!zone) {
    return (
      <aside className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
        <MousePointerClick className="size-5" aria-hidden="true" />
        {m.map_panel_empty()}
      </aside>
    );
  }
  return (
    <aside className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div>
        <p className="eyebrow">{m.map_panel_eyebrow({ code: zone.code })}</p>
        <h2 className="mt-1 text-2xl">{zone.name}</h2>
      </div>
      {zone.tipau && <p className="text-muted-foreground text-xs">{tipauLabel[zone.tipau]()}</p>}
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground text-xs">
            {m.map_panel_population({ year: zone.population_year ?? '' })}
          </dt>
          <dd className="font-medium tabular-nums">{formatNumber(zone.population)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">{m.map_panel_demand()}</dt>
          <dd className="font-medium tabular-nums">{formatTonnes(zone.demand_t)}</dd>
        </div>
      </dl>
      <div className="space-y-1.5">
        <p className="text-muted-foreground text-xs">{m.map_panel_service()}</p>
        {zone.service_days > 0 ? (
          <p className="text-sm">{m.map_tip_service({ days: zone.service_days })}</p>
        ) : (
          <p className="text-muted-foreground text-sm">{m.map_panel_no_service()}</p>
        )}
      </div>
      {zone.localities.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs">{m.map_panel_localities()}</p>
          <p className="text-sm leading-relaxed">{zone.localities.join(', ')}</p>
        </div>
      )}
      <WeekdayDots days={Array.from({ length: zone.service_days }, (_, i) => i + 1)} />
      <MunicipalSummary code={zone.code} />
    </aside>
  );
}
