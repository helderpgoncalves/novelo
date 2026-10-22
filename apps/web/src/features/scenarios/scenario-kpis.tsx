import type { Kpis } from '@/client';
import { Section } from '@/components/page';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { formatEur, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { reusableSummary } from './reusable';

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

const eurPerT = (v: number) => `${formatNumber(v, 0)} €/t`;
const sharePct = (v: number) => formatPercent(v * 100, 1);

/**
 * Têxtil reutilizável: o que o desafio pede. Toneladas × quota de reutilização de 2025 (as 4 entidades ao centro; o
 * intervalo só das entidades com pesagem) e o € por tonelada reutilizável. Escondido nos cenários antigos (sem os campos).
 */
export function ScenarioReusable({ kpis }: { kpis: Kpis }) {
  const r = reusableSummary(kpis);
  if (!r) return null;
  const ranged = r.shareLow != null && r.shareHigh != null;
  return (
    <Section
      title={m.reuse_title()}
      description={
        ranged
          ? m.reuse_description({
              share: sharePct(r.share),
              low: sharePct(r.shareLow ?? 0),
              high: sharePct(r.shareHigh ?? 0),
            })
          : m.reuse_description_no_range({ share: sharePct(r.share) })
      }
    >
      <StatStrip className="lg:grid-cols-2">
        <StatCell
          label={m.reuse_kpi_tonnes()}
          value={formatTonnes(r.tonnes)}
          tone="primary"
          tag={m.common_estimate()}
          hint={
            r.tonnesLow != null && r.tonnesHigh != null
              ? m.reuse_kpi_tonnes_hint({
                  low: formatTonnes(r.tonnesLow),
                  high: formatTonnes(r.tonnesHigh),
                })
              : undefined
          }
        />
        <StatCell
          label={m.reuse_kpi_eur()}
          value={r.eurPerTonne == null ? m.common_dash() : eurPerT(r.eurPerTonne)}
          tag={m.common_estimate()}
          hint={
            r.eurPerTonneLow != null && r.eurPerTonneHigh != null
              ? m.reuse_kpi_eur_hint({
                  low: eurPerT(r.eurPerTonneLow),
                  high: eurPerT(r.eurPerTonneHigh),
                })
              : undefined
          }
        />
      </StatStrip>
    </Section>
  );
}
