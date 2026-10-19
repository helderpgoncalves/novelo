import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Loader2, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  ParametersOut,
  PlanningParams,
  ScenarioObjective,
  ScenarioRequest,
  ZoneOut,
} from '@/client';
import { createScenarioMutation } from '@/client/@tanstack/react-query.gen';
import { NumberField } from '@/components/number-field';
import { SectionTitle } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { validateParams } from '@/features/assumptions/param-fields';
import { ParametersForm } from '@/features/assumptions/parameters-form';
import { FormAlert } from '@/features/auth/form-alert';
import { getErrorMessage } from '@/lib/errors';
import { formatEur, formatTonnes } from '@/lib/format';
import { objectiveHint, objectiveLabel } from '@/lib/scenario';
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

  return (
    <form
      className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
    >
      <div className="space-y-6 self-start rounded-xl bg-card p-5 ring-1 ring-foreground/10 lg:sticky lg:top-4">
        <FormAlert message={create.isError ? getErrorMessage(create.error) : null} />
        <div className="space-y-1.5">
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
            className="gap-2"
          >
            {OBJECTIVES.map((o) => (
              <Label
                key={o}
                htmlFor={`objective-${o}`}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal transition-colors',
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
          <div className="space-y-3">
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
          <div className="space-y-3">
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

        <Button type="submit" className="h-11 w-full font-semibold" disabled={create.isPending}>
          {create.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {create.isPending ? m.sim_running() : m.sim_run()}
        </Button>
        {create.isPending && (
          <p className="text-center text-muted-foreground text-xs">{m.sim_running_hint()}</p>
        )}
      </div>

      <div className="min-w-0 space-y-8">
        <section className="space-y-3">
          <div className="space-y-1">
            <SectionTitle>{m.sim_assumptions_title()}</SectionTitle>
            <p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">
              {m.sim_assumptions_description()}
            </p>
          </div>
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
            onClick={() => setParams(parameters.values)}
          >
            {m.sim_assumptions_reset()}
          </Button>
        </section>
        <section className="space-y-3">
          <SectionTitle>{m.sim_constraints_title()}</SectionTitle>
          <ConstraintsEditor zones={zones} value={constraints} onChange={setConstraints} />
        </section>
      </div>
    </form>
  );
}
