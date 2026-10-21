import type { Kpis } from '@/client';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { formatEur, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';

/** Os quatro números que decidem: toneladas, €/t, custo anual e investimento. */
export function ScenarioKpis({ kpis, bySites = false }: { kpis: Kpis; bySites?: boolean }) {
  const uplift = kpis.tonnes_year - kpis.baseline_observed_t;
  return (
    <StatStrip>
      <StatCell
        label={m.kpi_tonnes()}
        value={formatTonnes(kpis.tonnes_year)}
        tone="primary"
        tag={m.common_estimate()}
        hint={m.kpi_tonnes_hint({
          baseline: formatTonnes(kpis.baseline_observed_t, 0),
          delta: `${uplift >= 0 ? '+' : ''}${formatTonnes(uplift, 0)}`,
        })}
      />
      <StatCell
        label={m.kpi_eur_per_tonne()}
        value={
          kpis.eur_per_tonne == null
            ? m.common_dash()
            : `${formatNumber(kpis.eur_per_tonne, 0)} €/t`
        }
        tone="primary"
        tag={m.common_estimate()}
        hint={m.kpi_eur_per_tonne_hint()}
      />
      <StatCell
        label={m.kpi_annual_cost()}
        value={formatEur(kpis.annual_cost_eur)}
        tag={m.common_estimate()}
        hint={m.kpi_annual_cost_hint({ opex: formatEur(kpis.opex_eur_year) })}
      />
      <StatCell
        label={m.kpi_capex()}
        value={formatEur(kpis.capex_eur)}
        tag={m.common_estimate()}
        hint={
          bySites
            ? m.kpi_capex_hint_sites({ points: kpis.points })
            : m.kpi_capex_hint({ points: kpis.points })
        }
      />
    </StatStrip>
  );
}

/**
 * Segunda linha: captura sobre o têxtil no lixo, rotas e a poupança no tratamento do indiferenciado. A poupança fica
 * «por validar» enquanto a Vitrus não der o custo de tratamento por tonelada (nunca um número inventado).
 */
export function ScenarioSecondaryKpis({ kpis, routes }: { kpis: Kpis; routes: number }) {
  const capturePct = kpis.potential_t > 0 ? (kpis.tonnes_year / kpis.potential_t) * 100 : 0;
  const baselinePct =
    kpis.potential_t > 0 ? (kpis.baseline_observed_t / kpis.potential_t) * 100 : 0;
  const avoided = kpis.avoided_treatment_eur;
  return (
    <StatStrip className="lg:grid-cols-3">
      <StatCell
        label={m.simx_kpi_capture()}
        value={formatPercent(capturePct, 1)}
        tag={m.common_estimate()}
        hint={m.simx_kpi_capture_hint({ baseline: formatPercent(baselinePct, 1) })}
      />
      <StatCell
        label={m.simx_kpi_routes()}
        value={formatNumber(routes)}
        hint={m.simx_kpi_routes_hint({ km: `${formatNumber(kpis.km_year)} km` })}
      />
      <StatCell
        label={m.kpi_avoided()}
        value={avoided == null ? m.kpi_avoided_pending() : formatEur(avoided)}
        tone={avoided == null ? 'muted' : 'default'}
        tag={avoided == null ? undefined : m.common_estimate()}
        hint={avoided == null ? m.kpi_avoided_pending_hint() : m.kpi_avoided_hint()}
      />
    </StatStrip>
  );
}
