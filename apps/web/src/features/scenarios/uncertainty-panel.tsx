import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Info, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { runScenarioSensitivity, type ScenarioOut, type SensitivityOut } from '@/client';
import { NumberField } from '@/components/number-field';
import { EstimateTag, Panel } from '@/components/panel';
import { RangeBar } from '@/components/range-bar';
import { CardSkeleton, StatStripSkeleton } from '@/components/skeletons';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { ErrorState } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatEur, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { TornadoChart } from './tornado-chart';

const SWINGS = [0.1, 0.2, 0.3, 0.5];
const TOP_DRIVERS = 5;

const eurPerTonne = (v: number | null) =>
  v == null ? m.common_dash() : `${formatNumber(v, 0)} €/t`;

export function useSensitivity(scenarioId: string, swing: number, threshold: number | null) {
  // A rota é um POST sem efeitos (cálculo puro com semente fixa): trata-se como leitura em cache.
  return useQuery<SensitivityOut>({
    queryKey: ['scenario-sensitivity', scenarioId, swing, threshold],
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const { data } = await runScenarioSensitivity({
        path: { scenario_id: scenarioId },
        body: { swing, threshold_eur_per_tonne: threshold },
        throwOnError: true,
      });
      return data;
    },
  });
}

/** Separador "Incerteza": o quanto o resultado muda se os pressupostos estiverem errados. */
export function UncertaintyPanel({ scenario }: { scenario: ScenarioOut }) {
  const [swing, setSwing] = useState(0.3);
  const [threshold, setThreshold] = useState<number | null>(null);
  const [draft, setDraft] = useState<number>(Number.NaN);
  const query = useSensitivity(scenario.id, swing, threshold);

  return (
    <div className="space-y-6">
      <Panel
        title={m.sens_controls_title()}
        description={m.sens_controls_description()}
        aside={<EstimateTag label={m.common_estimate()} />}
      >
        <form
          className="flex flex-wrap items-end gap-x-4 gap-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setThreshold(draft > 0 ? draft : null);
          }}
        >
          <div className="w-full space-y-1.5 sm:w-48">
            <p id="sens-swing-label" className="font-medium text-sm">
              {m.sens_swing()}
            </p>
            <Select value={String(swing)} onValueChange={(v) => setSwing(Number(v))}>
              <SelectTrigger className="h-10 w-full" aria-labelledby="sens-swing-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SWINGS.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    ± {formatNumber(s * 100, 0)}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <NumberField
            className="w-full sm:w-56"
            label={m.sens_threshold()}
            value={draft}
            onChange={setDraft}
            unit="€/t"
            step={10}
            min={0}
          />
          <Button type="submit" variant="outline" className="h-10 w-full sm:w-auto">
            {m.sens_apply()}
          </Button>
        </form>
        <p className="text-muted-foreground text-xs">{m.sens_threshold_hint()}</p>
      </Panel>

      {query.isPending ? (
        <div className="space-y-6" aria-busy="true">
          <span className="sr-only">{m.common_loading()}</span>
          <StatStripSkeleton />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <CardSkeleton className="lg:col-span-7" />
            <CardSkeleton className="lg:col-span-5" />
          </div>
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <UncertaintyResult data={query.data} />
      )}
    </div>
  );
}

function UncertaintyResult({ data }: { data: SensitivityOut }) {
  const unsupported = Math.round(data.assumption_share_of_top_drivers * TOP_DRIVERS);
  const base = data.base.eur_per_tonne;
  const eur = data.eur_per_tonne;
  const cost = data.annual_cost_eur;
  const tonnes = data.tonnes;
  const range = (a: number, b: number, f: (v: number) => string) => `${f(a)} – ${f(b)}`;

  return (
    <div className="space-y-6">
      <StatStrip>
        <StatCell
          label={m.kpi_eur_per_tonne()}
          value={eurPerTonne(eur.p50)}
          tone="primary"
          tag={m.common_estimate()}
          hint={m.sens_p10_p90({
            range: range(eur.p10, eur.p90, (v) => `${formatNumber(v, 0)} €/t`),
          })}
        />
        <StatCell
          label={m.kpi_annual_cost()}
          value={formatEur(cost.p50)}
          tag={m.common_estimate()}
          hint={m.sens_p10_p90({ range: range(cost.p10, cost.p90, formatEur) })}
        />
        <StatCell
          label={m.kpi_tonnes()}
          value={formatTonnes(tonnes.p50)}
          tag={m.common_estimate()}
          hint={m.sens_p10_p90({ range: range(tonnes.p10, tonnes.p90, (v) => formatTonnes(v)) })}
        />
        {data.prob_below_threshold != null && data.threshold_eur_per_tonne != null ? (
          <StatCell
            label={m.sens_prob_title()}
            value={formatPercent(data.prob_below_threshold * 100, 0)}
            tag={m.common_estimate()}
            hint={m.sens_prob_hint({ value: eurPerTonne(data.threshold_eur_per_tonne) })}
          />
        ) : (
          <StatCell
            label={m.sens_unsupported_title()}
            value={m.sens_unsupported_value({ n: unsupported, total: TOP_DRIVERS })}
            tag={m.common_estimate()}
            hint={m.sens_unsupported_hint()}
          />
        )}
      </StatStrip>

      <Alert>
        {unsupported > 0 ? <TriangleAlert className="size-4" /> : <Info className="size-4" />}
        <AlertTitle>
          {m.sens_unsupported_alert_title({ n: unsupported, total: TOP_DRIVERS })}
        </AlertTitle>
        <AlertDescription>{m.sens_unsupported_alert_text()}</AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Panel
          className="lg:col-span-7"
          title={m.sens_tornado_title()}
          description={m.sens_tornado_description({ swing: formatNumber(data.swing * 100, 0) })}
          aside={<EstimateTag label={m.common_estimate()} />}
        >
          {base == null ? (
            <p className="text-muted-foreground text-sm">{m.sens_no_base()}</p>
          ) : (
            <TornadoChart bars={data.tornado} baseEurPerTonne={base} swing={data.swing} />
          )}
        </Panel>

        <Panel
          className="lg:col-span-5"
          title={m.sens_range_title()}
          description={m.sens_range_description({ n: formatNumber(data.n_samples) })}
          aside={<EstimateTag label={m.common_estimate()} />}
        >
          <div className="space-y-6">
            <RangeBar
              label={m.kpi_eur_per_tonne()}
              p10={eur.p10}
              p50={eur.p50}
              p90={eur.p90}
              format={(v) => `${formatNumber(v, 0)} €/t`}
            />
            <RangeBar
              label={m.kpi_annual_cost()}
              p10={cost.p10}
              p50={cost.p50}
              p90={cost.p90}
              format={formatEur}
            />
            <RangeBar
              label={m.kpi_tonnes()}
              p10={tonnes.p10}
              p50={tonnes.p50}
              p90={tonnes.p90}
              format={(v) => formatTonnes(v)}
            />
          </div>
        </Panel>
      </div>

      <Collapsible className="rounded-xl bg-card ring-1 ring-foreground/10">
        <CollapsibleTrigger className="group flex min-h-12 w-full items-center justify-between gap-3 px-5 py-3 text-left font-medium text-sm">
          {m.sens_method_title()}
          <ChevronDown
            className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 px-5 pb-5 text-sm leading-relaxed">
          <p className="text-muted-foreground">{data.method}</p>
          <dl className="grid grid-cols-3 gap-4 border-t pt-3 tabular-nums">
            <div>
              <dt className="text-muted-foreground text-xs">{m.sens_swing()}</dt>
              <dd>± {formatNumber(data.swing * 100, 0)}%</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">{m.sens_samples()}</dt>
              <dd>{formatNumber(data.n_samples)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">{m.sens_seed()}</dt>
              <dd>{data.seed}</dd>
            </div>
          </dl>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
