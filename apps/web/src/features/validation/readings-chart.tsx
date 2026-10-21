import type { ModelValidationOut, PotentialReadingOut } from '@/client';
import { EstimateTag, Panel } from '@/components/panel';
import { formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';

const LABEL: Record<PotentialReadingOut['key'], () => string> = {
  vitrus_apa_share_of_rsu: () => m.validation_reading_vitrus_apa_share_of_rsu(),
  plan_per_capita: () => m.validation_reading_plan_per_capita(),
  plan_share_of_residual: () => m.validation_reading_plan_share_of_residual(),
  pt_composition: () => m.validation_reading_pt_composition(),
};

/** Barras do potencial por habitante e ano, com a marca do que se recolhe hoje: a distância é o problema. */
export function ReadingsChart({ data }: { data: ModelValidationOut }) {
  const observed = data.baseline.observed_kg_per_inhab_year;
  const top = Math.max(...data.readings.map((r) => r.kg_per_inhab_year), observed);
  // As leituras alternativas (não usadas pela Vitrus) mostram-se, mas não definem o teto da frase.
  const used = data.readings.filter((r) => !r.is_alternative);
  const maxCapture = Math.max(
    ...(used.length > 0 ? used : data.readings).map((r) => r.implied_capture_pct),
  );
  const at = (kg: number) => `${(kg / top) * 100}%`;

  return (
    <Panel
      title={m.validation_readings_title()}
      description={m.validation_readings_description({ max: formatPercent(maxCapture, 1) })}
      aside={<EstimateTag label={m.common_estimate()} />}
    >
      <ul className="space-y-4">
        {data.readings.map((r) => (
          <li key={r.key} className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p className="font-medium text-sm">
                {LABEL[r.key]()}
                {r.is_model_base && (
                  <span className="ml-2 font-normal text-muted-foreground text-xs">
                    {m.validation_reading_base()}
                  </span>
                )}
                {r.is_alternative && (
                  <span className="ml-2 font-normal text-muted-foreground text-xs">
                    {m.validation_reading_alternative()}
                  </span>
                )}
              </p>
              <p className="text-muted-foreground text-xs tabular-nums">
                {formatNumber(r.kg_per_inhab_year, 1)} kg · {formatTonnes(r.implied_potential_t, 0)}{' '}
                ·{' '}
                <span className="font-semibold text-foreground">
                  {formatPercent(r.implied_capture_pct, 1)}
                </span>
              </p>
            </div>
            <div
              className="relative h-3 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${LABEL[r.key]()}: ${formatNumber(r.kg_per_inhab_year, 1)} kg`}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary/30"
                style={{ width: at(r.kg_per_inhab_year) }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary"
                style={{ width: at(observed) }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">{r.source}</p>
          </li>
        ))}
      </ul>
      <p className="border-t pt-3 text-muted-foreground text-xs leading-relaxed">
        {m.validation_observed({ kg: formatNumber(observed, 2) })}{' '}
        {m.validation_france({
          kg: formatNumber(data.france.kg_per_inhab_year, 2),
          pct: formatPercent(data.france.capture_of_model_base_pct, 1),
        })}
      </p>
    </Panel>
  );
}
