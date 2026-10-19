import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ChevronDown, CircleCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type { BenchmarkOut, ScenarioObjective } from '@/client';
import {
  createBenchmarkScenarioMutation,
  listBenchmarksOptions,
  listScenariosQueryKey,
} from '@/client/@tanstack/react-query.gen';
import { NumberField } from '@/components/number-field';
import { Section } from '@/components/page';
import { EstimateTag, Panel } from '@/components/panel';
import { CardSkeleton } from '@/components/skeletons';
import { EmptyState, ErrorState } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FormAlert } from '@/features/auth/form-alert';
import { getErrorMessage } from '@/lib/errors';
import { formatEur, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { modeLabel, objectiveLabel } from '@/lib/scenario';
import { m } from '@/paraglide/messages';

const DEFAULT_BUDGET = 40000;

/** Secção "Cenários de referência": metas externas confrontadas com o que o modelo consegue alcançar. */
export function BenchmarkSection() {
  const query = useQuery(listBenchmarksOptions());
  return (
    <Section title={m.bench_title()} description={m.bench_description()}>
      {query.isPending ? (
        <div aria-busy="true">
          <span className="sr-only">{m.common_loading()}</span>
          <CardSkeleton />
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState title={m.bench_empty_title()} description={m.bench_empty_text()} />
      ) : (
        <div className="space-y-6">
          {query.data.map((b) => (
            <BenchmarkCard key={b.key} benchmark={b} />
          ))}
        </div>
      )}
    </Section>
  );
}

function ScaleBar({ b }: { b: BenchmarkOut }) {
  const observedT = (b.observed_kg_per_inhab_year * b.population) / 1000;
  const max = Math.max(b.target_tonnes, b.max_capturable_t, observedT) * 1.08;
  const pct = (v: number) => `${Math.min((v / max) * 100, 100)}%`;
  return (
    <div className="space-y-3">
      <div
        role="img"
        aria-label={m.bench_scale_aria({
          observed: formatTonnes(observedT, 0),
          ceiling: formatTonnes(b.max_capturable_t, 0),
          target: formatTonnes(b.target_tonnes, 0),
        })}
        className="relative mt-6 h-4 rounded-full bg-muted"
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-primary/30"
          style={{ width: pct(b.max_capturable_t) }}
        />
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: pct(observedT) }}
        />
        <span
          className="absolute -top-1.5 -bottom-1.5 w-0.5 bg-foreground"
          style={{ left: pct(b.target_tonnes) }}
        >
          <span className="-translate-x-1/2 absolute -top-5 left-1/2 whitespace-nowrap font-semibold text-[10px] uppercase tracking-wider">
            {m.bench_target_marker()}
          </span>
        </span>
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground text-xs">
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-primary" aria-hidden="true" />
          {m.bench_legend_observed({ value: formatTonnes(observedT, 0) })}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-primary/30" aria-hidden="true" />
          {m.bench_legend_ceiling({ value: formatTonnes(b.max_capturable_t, 0) })}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-foreground" aria-hidden="true" />
          {m.bench_legend_target({ value: formatTonnes(b.target_tonnes, 0) })}
        </li>
      </ul>
    </div>
  );
}

function BenchmarkCard({ benchmark: b }: { benchmark: BenchmarkOut }) {
  const [open, setOpen] = useState(false);
  const gap = b.max_capturable_t - b.target_tonnes;

  return (
    <Panel className="grid grid-cols-1 gap-6 space-y-0 lg:grid-cols-12 lg:gap-10">
      <div className="space-y-4 lg:col-span-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-2xl">{b.label}</h3>
            {!b.verified && (
              <Badge variant="outline" className="border-areia/70 text-foreground/80">
                {m.bench_unverified()}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {m.bench_params({
              kg: formatNumber(b.kg_per_inhab_year, 2),
              people: formatNumber(b.people_per_point),
              mode: modeLabel[b.density_mode]().toLowerCase(),
              current: formatNumber(b.current_people_per_point),
            })}
          </p>
        </div>
        <BenchmarkCreate benchmark={b} />
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="group flex min-h-10 items-center gap-1.5 font-medium text-sm">
            {m.bench_source_title()}
            <ChevronDown
              className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
              aria-hidden="true"
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="text-muted-foreground text-sm leading-relaxed">{b.source}</p>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="min-w-0 space-y-5 lg:col-span-7">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border ring-1 ring-border sm:grid-cols-4">
          <Metric label={m.bench_target()} value={formatTonnes(b.target_tonnes, 0)} />
          <Metric label={m.bench_ceiling()} value={formatTonnes(b.max_capturable_t, 0)} />
          <Metric
            label={m.bench_capture()}
            value={formatPercent(b.implied_capture_pct)}
            hint={m.bench_capture_hint({ observed: formatPercent(b.observed_capture_pct) })}
          />
          <Metric
            label={b.reachable ? m.bench_margin() : m.bench_shortfall()}
            value={formatTonnes(Math.abs(gap), 0)}
            tone={b.reachable ? 'good' : 'bad'}
          />
        </dl>
        <ScaleBar b={b} />
        <p className="flex items-start gap-2 text-sm leading-relaxed" aria-live="polite">
          {b.reachable ? (
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          ) : (
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          )}
          <span>
            {b.reachable
              ? m.bench_reachable_text({ margin: formatTonnes(gap, 0) })
              : m.bench_unreachable_text({
                  shortfall: formatTonnes(-gap, 0),
                  capture: formatPercent(b.implied_capture_pct),
                })}{' '}
            <EstimateTag label={m.common_estimate()} />
          </span>
        </p>
      </div>
    </Panel>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'good' | 'bad';
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-card p-3 sm:p-4">
      <dt className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
        {label}
      </dt>
      <dd
        className={`font-serif text-2xl tabular-nums leading-none ${tone === 'bad' ? 'text-destructive' : tone === 'good' ? 'text-primary' : ''}`}
      >
        {value}
      </dd>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

function BenchmarkCreate({ benchmark: b }: { benchmark: BenchmarkOut }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [objective, setObjective] = useState<ScenarioObjective>(
    b.reachable ? 'min_cost' : 'max_tonnes',
  );
  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const create = useMutation({
    ...createBenchmarkScenarioMutation(),
    onSuccess: async (scenario) => {
      await queryClient.invalidateQueries({ queryKey: listScenariosQueryKey() });
      setOpen(false);
      navigate({ to: '/scenarios/$scenarioId', params: { scenarioId: scenario.id } });
    },
  });
  const needsBudget = objective === 'max_tonnes';
  const budgetError = needsBudget && !(budget > 0) ? m.validation_number_positive() : undefined;

  return (
    <>
      <Button className="h-11 w-full font-semibold sm:w-auto" onClick={() => setOpen(true)}>
        {m.bench_create()}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form
            className="space-y-5"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (budgetError) return;
              create.mutate({
                path: { key: b.key },
                body: { objective, budget_eur_year: needsBudget ? budget : null },
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>{m.bench_dialog_title({ label: b.label })}</DialogTitle>
              <DialogDescription>
                {m.bench_dialog_description({ target: formatTonnes(b.target_tonnes, 0) })}
              </DialogDescription>
            </DialogHeader>

            {!b.reachable && (
              <Alert>
                <TriangleAlert className="size-4" />
                <AlertTitle>{m.bench_dialog_unreachable_title()}</AlertTitle>
                <AlertDescription>
                  {m.bench_dialog_unreachable_text({
                    target: formatTonnes(b.target_tonnes, 0),
                    ceiling: formatTonnes(b.max_capturable_t, 0),
                  })}
                </AlertDescription>
              </Alert>
            )}

            <FormAlert message={create.isError ? getErrorMessage(create.error) : null} />

            <fieldset className="space-y-2">
              <legend className="mb-1 font-medium text-sm">{m.sim_objective()}</legend>
              <RadioGroup
                value={objective}
                onValueChange={(v) => setObjective(v as ScenarioObjective)}
                className="gap-2"
              >
                {(['min_cost', 'max_tonnes'] as const).map((o) => {
                  const disabled = o === 'min_cost' && !b.reachable;
                  return (
                    <Label
                      key={o}
                      htmlFor={`bench-objective-${o}`}
                      className={`flex min-h-12 items-start gap-3 rounded-lg border p-3 font-normal ${disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'} ${objective === o ? 'border-primary bg-primary/5' : ''}`}
                    >
                      <RadioGroupItem
                        id={`bench-objective-${o}`}
                        value={o}
                        disabled={disabled}
                        className="mt-0.5"
                      />
                      <span className="space-y-0.5">
                        <span className="block font-medium text-sm">{objectiveLabel[o]()}</span>
                        <span className="block text-muted-foreground text-xs leading-relaxed">
                          {o === 'min_cost'
                            ? m.bench_objective_min_cost()
                            : m.bench_objective_max_tonnes()}
                        </span>
                      </span>
                    </Label>
                  );
                })}
              </RadioGroup>
            </fieldset>

            {needsBudget && (
              <NumberField
                label={m.sim_budget()}
                value={budget}
                onChange={setBudget}
                unit="€/ano"
                step={1000}
                min={0}
                error={budgetError}
                hint={m.sim_budget_hint({ value: formatEur(budget || 0) })}
              />
            )}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => setOpen(false)}
              >
                {m.common_cancel()}
              </Button>
              <Button
                type="submit"
                className="h-11 font-semibold"
                disabled={create.isPending}
                loading={create.isPending}
              >
                {create.isPending ? m.sim_running() : m.bench_dialog_submit()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
