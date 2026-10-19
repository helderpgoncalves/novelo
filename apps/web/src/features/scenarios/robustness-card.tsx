import { useQuery } from '@tanstack/react-query';
import { CircleCheck, CircleHelp } from 'lucide-react';
import { useState } from 'react';
import type { RobustnessOut, ScenarioOut } from '@/client';
import { compareScenarioRobustnessOptions } from '@/client/@tanstack/react-query.gen';
import { EstimateTag, Panel } from '@/components/panel';
import { ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatEur, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';

type Criterion = RobustnessOut['criterion'];
const CRITERIA: Criterion[] = ['eur_per_tonne', 'annual_cost_eur', 'tonnes'];

const criterionLabel: Record<Criterion, () => string> = {
  eur_per_tonne: () => m.kpi_eur_per_tonne(),
  annual_cost_eur: () => m.kpi_annual_cost(),
  tonnes: () => m.kpi_tonnes(),
};

const criterionFormat: Record<Criterion, (v: number) => string> = {
  eur_per_tonne: (v) => `${formatNumber(v, 0)} €/t`,
  annual_cost_eur: formatEur,
  tonnes: (v) => formatTonnes(v),
};

/** Em quantas amostras de pressupostos o cenário A continua melhor do que o B. */
export function RobustnessCard({ a, b }: { a: ScenarioOut; b: ScenarioOut }) {
  const [criterion, setCriterion] = useState<Criterion>('eur_per_tonne');
  const query = useQuery(
    compareScenarioRobustnessOptions({
      query: { recommended_id: a.id, alternative_id: b.id, criterion },
    }),
  );

  return (
    <Panel
      title={m.rob_title()}
      description={m.rob_description()}
      aside={<EstimateTag label={m.common_estimate()} />}
    >
      <div className="space-y-1.5">
        <p id="rob-criterion" className="font-medium text-sm">
          {m.rob_criterion()}
        </p>
        <Select value={criterion} onValueChange={(v) => setCriterion(v as Criterion)}>
          <SelectTrigger className="h-10 w-full" aria-labelledby="rob-criterion">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CRITERIA.map((c) => (
              <SelectItem key={c} value={c}>
                {criterionLabel[c]()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isPending ? (
        <div className="space-y-3" aria-busy="true">
          <span className="sr-only">{m.common_loading()}</span>
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <RobustnessResult data={query.data} a={a} b={b} />
      )}
    </Panel>
  );
}

function RobustnessResult({ data, a, b }: { data: RobustnessOut; a: ScenarioOut; b: ScenarioOut }) {
  const share = data.share_recommended_better * 100;
  return (
    <div className="space-y-4" aria-live="polite">
      <div className="space-y-2">
        <p className="font-serif text-4xl tabular-nums">{formatPercent(share, 0)}</p>
        <p className="text-sm leading-relaxed">
          {m.rob_statement({
            share: formatPercent(share, 0),
            a: a.label,
            b: b.label,
            criterion: criterionLabel[data.criterion]().toLowerCase(),
          })}
        </p>
      </div>
      <Progress value={share} aria-label={m.rob_progress()} />
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={
            data.holds
              ? 'gap-1.5 border-primary bg-primary/10 text-primary'
              : 'gap-1.5 border-areia/70'
          }
        >
          {data.holds ? <CircleCheck className="size-3.5" /> : <CircleHelp className="size-3.5" />}
          {data.holds ? m.rob_holds() : m.rob_not_holds()}
        </Badge>
        <span className="text-muted-foreground text-xs">
          {m.rob_threshold({ value: formatPercent(data.min_share * 100, 0) })}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 text-sm tabular-nums">
        <dt className="text-muted-foreground">{m.rob_median_advantage()}</dt>
        <dd className="text-right font-medium">
          {data.median_advantage > 0 ? '+' : ''}
          {criterionFormat[data.criterion](data.median_advantage)}
        </dd>
        <dt className="text-muted-foreground">{m.rob_samples()}</dt>
        <dd className="text-right">
          {formatNumber(data.n_samples)} · ± {formatNumber(data.swing * 100, 0)}%
        </dd>
      </dl>
    </div>
  );
}
