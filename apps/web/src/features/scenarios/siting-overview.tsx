import { Info } from 'lucide-react';
import type { SiteSelection, SitingSummary } from '@/client';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { formatMetres, formatNumber, formatPercent } from '@/lib/format';
import { m } from '@/paraglide/messages';

/**
 * Cenário por locais reais: quantos locais se abriram, que parte dos pontos de procura servem e o raio a pé.
 * A população por local é um proxy (repartida pelos contentores da freguesia), por isso tudo leva "estimativa".
 */
export function SitingOverview({
  siting,
  sites,
}: {
  siting: SitingSummary;
  sites: SiteSelection[];
}) {
  const servedPct =
    siting.demand_points > 0 ? (siting.served_points / siting.demand_points) * 100 : 0;
  const onDemand = siting.on_demand === true;
  const population = sites.reduce((sum, s) => sum + s.population_covered, 0);
  const staffed = sites.filter((s) => s.kind === 'staffed').length;
  const withStaffed = staffed > 0 || (siting.site_candidates ?? 'public') !== 'public';
  return (
    <div className="space-y-3">
      <StatStrip>
        <StatCell
          label={m.site_kpi_opened()}
          value={formatNumber(siting.opened)}
          tone="primary"
          hint={
            <>
              {m.site_kpi_opened_hint({ n: formatNumber(siting.candidates) })}
              {withStaffed && (
                <span className="block">
                  {m.site_kpi_opened_kinds({
                    public: formatNumber(sites.length - staffed),
                    staffed: formatNumber(staffed),
                  })}
                </span>
              )}
              {onDemand && (
                <span className="block">
                  {m.site_kpi_opened_on_demand({ n: formatNumber(siting.on_demand_zones ?? 0) })}
                </span>
              )}
            </>
          }
        />
        <StatCell
          label={m.site_kpi_served()}
          value={formatPercent(servedPct, 0)}
          tone="primary"
          tag={m.common_estimate()}
          hint={(onDemand ? m.site_kpi_served_hint_on_demand : m.site_kpi_served_hint)({
            served: formatNumber(siting.served_points),
            total: formatNumber(siting.demand_points),
          })}
        />
        <StatCell
          label={m.site_kpi_radius()}
          value={formatMetres(siting.radius_m)}
          hint={m.site_kpi_radius_hint()}
        />
        <StatCell
          label={m.site_kpi_population()}
          value={formatNumber(population)}
          tag={m.common_estimate()}
          hint={m.site_kpi_population_hint()}
        />
      </StatStrip>
      <p className="flex gap-2 text-muted-foreground text-xs leading-relaxed">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          {m.site_note_candidates()} {siting.population_proxy} {m.site_note_estimate()}
        </span>
      </p>
    </div>
  );
}
