import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  ParametersOut,
  PlanningParams,
  ScenarioObjective,
  ScenarioRequest,
  ZoneOut,
} from '@/client';
import { createScenarioMutation } from '@/client/@tanstack/react-query.gen';
import { ModeDot } from '@/components/mode-badge';
import { NumberField } from '@/components/number-field';
import { EstimateTag, Panel } from '@/components/panel';
import { StepSection } from '@/components/step-section';
import { StickyActions } from '@/components/sticky-actions';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { getParam, PARAM_GROUPS, validateParams } from '@/features/assumptions/param-fields';
import { ParametersForm } from '@/features/assumptions/parameters-form';
import { FormAlert } from '@/features/auth/form-alert';
import { getErrorMessage } from '@/lib/errors';
import { formatEur, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { MODES, modeHint, modeLabel, objectiveHint, objectiveLabel } from '@/lib/scenario';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { type Constraints, ConstraintsEditor } from './constraints-editor';

const OBJECTIVES: ScenarioObjective[] = ['max_tonnes', 'min_cost'];

export interface FormSeed {
  label: string;
  objective: ScenarioObjective;
  budget: number;
  targetPct: number;
  params: PlanningParams;
  constraints: Constraints;
  parentId?: string;
}

interface ScenarioFormProps {
  parameters: ParametersOut;
  zones: ZoneOut[];
  seed: FormSeed;
}

export function ScenarioForm({ parameters, zones, seed }: ScenarioFormProps) {
  const navigate = useNavigate();
  const [label, setLabel] = useState(seed.label);
  const [objective, setObjective] = useState<ScenarioObjective>(seed.objective);
  const [budget, setBudget] = useState(seed.budget);
  const [targetPct, setTargetPct] = useState(seed.targetPct);
  const [params, setParams] = useState(seed.params);
  const [constraints, setConstraints] = useState<Constraints>(seed.constraints);
  const [submitted, setSubmitted] = useState(false);

  const potential = useMemo(
    () => (zones.reduce((sum, z) => sum + z.population, 0) * params.kg_per_inhab_month * 12) / 1000,
    [zones, params.kg_per_inhab_month],
  );
  const targetTonnes = (targetPct / 100) * potential;
  const paramErrors = validateParams(params);
  const labelError = label.trim() ? undefined : m.sim_label_required();
  const budgetError =
    objective === 'max_tonnes' && !(budget > 0) ? m.validation_number_positive() : undefined;
  const hasErrors =
    Object.keys(paramErrors).length > 0 || Boolean(labelError) || Boolean(budgetError);

  const changedParams = PARAM_GROUPS.flatMap((g) => g.fields).filter(
    (f) => getParam(params, f.path) !== getParam(parameters.values, f.path),
  ).length;
  const restrictedZones = Object.keys(constraints).length;

  const create = useMutation({
    ...createScenarioMutation(),
    onSuccess: (scenario) =>
      navigate({ to: '/scenarios/$scenarioId', params: { scenarioId: scenario.id } }),
  });

  const submit = () => {
    setSubmitted(true);
    if (hasErrors) return;
    const body: ScenarioRequest = {
      label: label.trim(),
      objective,
      budget_eur_year: objective === 'max_tonnes' ? budget : null,
      target_tonnes: objective === 'min_cost' ? Math.round(targetTonnes * 1000) / 1000 : null,
      params,
      constraints,
      parent_id: seed.parentId ?? null,
    };
    create.mutate({ body });
  };

  const runButton = (
    <Button type="submit" className="h-11 w-full font-semibold" disabled={create.isPending}>
      {create.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
      {create.isPending ? m.sim_running() : m.sim_run()}
    </Button>
  );

  return (
    <form
      className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
    >
      <div className="min-w-0 space-y-10 sm:space-y-12 lg:col-span-8 xl:col-span-9">
        <FormAlert message={create.isError ? getErrorMessage(create.error) : null} />

        <StepSection
          step={1}
          title={m.sim_step_objective()}
          description={m.sim_step_objective_text()}
        >
          <Panel className="space-y-6">
            <div className="max-w-md space-y-1.5">
              <Label htmlFor="label">{m.sim_label()}</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={80}
                className="h-10"
                aria-invalid={submitted && labelError ? true : undefined}
              />
              {submitted && labelError && <p className="text-destructive text-xs">{labelError}</p>}
            </div>

            <fieldset className="space-y-3">
              <legend className="mb-1 font-medium text-sm">{m.sim_objective()}</legend>
              <RadioGroup
                value={objective}
                onValueChange={(v) => setObjective(v as ScenarioObjective)}
                className="grid grid-cols-1 gap-2 md:grid-cols-2"
              >
                {OBJECTIVES.map((o) => (
                  <Label
                    key={o}
                    htmlFor={`objective-${o}`}
                    className={cn(
                      'flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal transition-colors',
                      objective === o ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                    )}
                  >
                    <RadioGroupItem id={`objective-${o}`} value={o} className="mt-0.5" />
                    <span className="space-y-0.5">
                      <span className="block font-medium text-sm">{objectiveLabel[o]()}</span>
                      <span className="block text-muted-foreground text-xs leading-relaxed">
                        {objectiveHint[o]()}
                      </span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </fieldset>

            {objective === 'max_tonnes' ? (
              <div className="max-w-xl space-y-3">
                <NumberField
                  label={m.sim_budget()}
                  value={budget}
                  onChange={setBudget}
                  unit="€/ano"
                  step={1000}
                  min={0}
                  error={submitted ? budgetError : undefined}
                  hint={m.sim_budget_hint({ value: formatEur(budget || 0) })}
                />
                <Slider
                  value={[Math.min(Number.isFinite(budget) ? budget : 0, 200000)]}
                  min={0}
                  max={200000}
                  step={1000}
                  onValueChange={([v]) => setBudget(v ?? 0)}
                  aria-label={m.sim_budget()}
                />
              </div>
            ) : (
              <div className="max-w-xl space-y-3">
                <NumberField
                  label={m.sim_target()}
                  value={targetPct}
                  onChange={setTargetPct}
                  unit="%"
                  step={1}
                  min={1}
                  max={100}
                  hint={m.sim_target_hint({
                    tonnes: formatTonnes(targetTonnes, 0),
                    potential: formatTonnes(potential, 0),
                  })}
                />
                <Slider
                  value={[Math.min(Number.isFinite(targetPct) ? targetPct : 0, 100)]}
                  min={1}
                  max={100}
                  step={1}
                  onValueChange={([v]) => setTargetPct(v ?? 1)}
                  aria-label={m.sim_target()}
                />
              </div>
            )}
          </Panel>
        </StepSection>

        <StepSection step={2} title={m.sim_step_modes()} description={m.sim_step_modes_text()}>
          <ModesOverview params={params} zones={zones} />
        </StepSection>

        <StepSection
          step={3}
          title={m.sim_constraints_title()}
          description={m.sim_step_constraints_text()}
        >
          <Panel>
            <ConstraintsEditor zones={zones} value={constraints} onChange={setConstraints} />
          </Panel>
        </StepSection>

        <StepSection
          step={4}
          title={m.sim_assumptions_title()}
          description={m.sim_assumptions_description()}
        >
          <ParametersForm
            value={params}
            onChange={setParams}
            meta={parameters.meta}
            errors={submitted ? paramErrors : {}}
            defaultOpen={['general', 'street']}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10"
            onClick={() => setParams(parameters.values)}
          >
            {m.sim_assumptions_reset()}
          </Button>
        </StepSection>
      </div>

      <aside className="lg:col-span-4 lg:self-start xl:col-span-3 lg:sticky lg:top-4">
        <Panel title={m.sim_summary_title()} aside={<EstimateTag label={m.common_estimate()} />}>
          <dl className="space-y-3 text-sm">
            <SummaryRow label={m.sim_objective()} value={objectiveLabel[objective]()} />
            {objective === 'max_tonnes' ? (
              <SummaryRow
                label={m.sim_budget()}
                value={Number.isFinite(budget) ? formatEur(budget) : m.common_dash()}
              />
            ) : (
              <SummaryRow
                label={m.sim_target()}
                value={`${formatTonnes(targetTonnes, 0)} (${formatNumber(targetPct)}%)`}
              />
            )}
            <SummaryRow label={m.sim_summary_potential()} value={formatTonnes(potential, 0)} />
            <SummaryRow
              label={m.sim_summary_constraints()}
              value={
                restrictedZones === 0
                  ? m.sim_summary_none()
                  : m.sim_summary_zones({ n: restrictedZones })
              }
            />
            <SummaryRow
              label={m.sim_summary_assumptions()}
              value={
                changedParams === 0
                  ? m.sim_summary_defaults()
                  : m.sim_summary_changed({ n: changedParams })
              }
            />
          </dl>
          {submitted && hasErrors && (
            <p role="alert" className="text-destructive text-xs">
              {m.sim_summary_errors()}
            </p>
          )}
          <div className="hidden space-y-2 lg:block">
            {runButton}
            {create.isPending && (
              <p className="text-center text-muted-foreground text-xs">{m.sim_running_hint()}</p>
            )}
          </div>
        </Panel>
      </aside>

      <StickyActions className="col-span-full lg:hidden">
        {runButton}
        {create.isPending && (
          <p className="mt-2 text-center text-muted-foreground text-xs">{m.sim_running_hint()}</p>
        )}
      </StickyActions>
    </form>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="whitespace-nowrap text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** Os três modos de recolha com os números-chave dos pressupostos atuais e, nos existentes, onde há contentores. */
function ModesOverview({ params, zones }: { params: PlanningParams; zones: ZoneOut[] }) {
  const withContainers = zones
    .filter((z) => (z.existing_containers ?? 0) > 0)
    .sort((a, b) => (b.existing_containers ?? 0) - (a.existing_containers ?? 0));
  const totalContainers = withContainers.reduce((sum, z) => sum + (z.existing_containers ?? 0), 0);

  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {MODES.map((mode) => {
        const p = params.modes[mode];
        if (!p) return null;
        return (
          <li
            key={mode}
            className="min-w-0 space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5"
          >
            <p className="flex items-center gap-2 font-medium">
              <ModeDot mode={mode} /> {modeLabel[mode]()}
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">{modeHint[mode]()}</p>
            <dl className="space-y-1 text-sm tabular-nums">
              <SummaryRow
                label={m.param_capture_rate()}
                value={formatPercent(p.capture_rate * 100, 1)}
              />
              {mode !== 'on_demand' && (
                <SummaryRow
                  label={m.sim_mode_density()}
                  value={m.sim_mode_people({ n: formatNumber(p.people_per_point) })}
                />
              )}
              <SummaryRow
                label={m.param_capex_per_point()}
                value={formatEur(p.capex_per_point_eur)}
              />
            </dl>
            {mode === 'existing' && (
              <Collapsible className="border-t pt-3">
                <p className="font-medium text-sm">
                  {totalContainers > 0
                    ? m.sim_existing_total({
                        n: formatNumber(totalContainers),
                        zones: withContainers.length,
                      })
                    : m.sim_existing_none()}
                </p>
                {totalContainers > 0 && (
                  <>
                    <CollapsibleTrigger className="group flex min-h-10 items-center gap-1.5 text-muted-foreground text-xs">
                      {m.sim_existing_by_zone()}
                      <ChevronDown
                        className="size-3.5 transition-transform group-data-[state=open]:rotate-180"
                        aria-hidden="true"
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ul className="max-h-48 space-y-1 overflow-y-auto pr-1 text-sm">
                        {withContainers.map((z) => (
                          <li key={z.code} className="flex justify-between gap-3">
                            <span className="min-w-0 truncate">{z.name}</span>
                            <span className="tabular-nums">
                              {formatNumber(z.existing_containers ?? 0)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </>
                )}
              </Collapsible>
            )}
          </li>
        );
      })}
    </ul>
  );
}
