import type { ScenarioOut } from '@/client';
import { EstimateTag, Panel } from '@/components/panel';
import { formatEur, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';

/**
 * Frase-âncora do cenário: todos os números vêm do resultado do otimizador (nenhum é calculado por IA)
 * e a frase diz o que é medido, o que é estimado e de onde se parte.
 */
export function ScenarioAnchor({ scenario }: { scenario: ScenarioOut }) {
  const { kpis } = scenario.result;
  const eurT =
    kpis.eur_per_tonne == null ? m.common_dash() : `${formatNumber(kpis.eur_per_tonne, 0)} €/t`;
  const share = kpis.potential_t > 0 ? (kpis.tonnes_year / kpis.potential_t) * 100 : 0;
  const sentence =
    scenario.objective === 'max_tonnes' && scenario.budget_eur_year != null
      ? m.scn_anchor_budget({
          budget: formatEur(scenario.budget_eur_year),
          tonnes: formatTonnes(kpis.tonnes_year),
          share: formatPercent(share, 0),
          potential: formatTonnes(kpis.potential_t, 0),
          eurT,
        })
      : m.scn_anchor_target({
          target: formatTonnes(scenario.target_tonnes ?? kpis.tonnes_year, 0),
          cost: formatEur(kpis.annual_cost_eur),
          tonnes: formatTonnes(kpis.tonnes_year),
          eurT,
        });

  return (
    <Panel className="bg-primary/5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl space-y-2">
          <p className="flex items-center gap-2 font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
            {m.scn_anchor_label()} <EstimateTag label={m.common_estimate()} />
          </p>
          <p className="text-pretty font-serif text-xl leading-snug sm:text-2xl">{sentence}</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {m.scn_anchor_note({ baseline: formatTonnes(kpis.baseline_observed_t, 0) })}
          </p>
        </div>
        <dl className="grid shrink-0 grid-cols-3 gap-x-6 gap-y-1 text-sm tabular-nums lg:text-right">
          <div>
            <dt className="text-muted-foreground text-xs">{m.kpi_coverage()}</dt>
            <dd className="font-medium">{formatPercent(kpis.coverage_pct)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">{m.kpi_km()}</dt>
            <dd className="font-medium">{formatNumber(kpis.km_year)} km</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">{m.compare_points()}</dt>
            <dd className="font-medium">{formatNumber(kpis.points)}</dd>
          </div>
        </dl>
      </div>
    </Panel>
  );
}
