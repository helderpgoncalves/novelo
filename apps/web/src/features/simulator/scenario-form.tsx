import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ChevronDown } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  type CollectionMode,
  createScenario,
  type ParametersOut,
  type PlanningParams,
  type ScenarioObjective,
  type ScenarioOut,
  type ScenarioRequest,
  type ZoneOut,
} from '@/client';
import {
  getScenarioOptions,
  getScenarioQueryKey,
  listScenariosQueryKey,
} from '@/client/@tanstack/react-query.gen';
import { ModeDot } from '@/components/mode-badge';
import { ErrorState } from '@/components/states';
import { StickyActions } from '@/components/sticky-actions';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { getParam, PARAM_GROUPS, validateParams } from '@/features/assumptions/param-fields';
import { ParametersForm } from '@/features/assumptions/parameters-form';
import { FormAlert } from '@/features/auth/form-alert';
import { getErrorMessage } from '@/lib/errors';
import { formatEur, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { MODES, modeHint, modeLabel, objectiveHint, objectiveLabel } from '@/lib/scenario';
import { m } from '@/paraglide/messages';
import { type Constraints, ConstraintsEditor } from './constraints-editor';
import { FormSection } from './form-section';
import { HelpHint } from './help-hint';
import { NumericControl } from './numeric-control';
import { ProgressSteps, type StepId } from './progress-steps';
import { type RunStatus, useElapsedSeconds } from './run-status';
import { Segmented } from './segmented';
import { type RunControl, SummaryBar, type SummaryData, SummaryPanel } from './summary';

const ScenarioResult = lazy(() =>
  import('./scenario-result').then((mod) => ({ default: mod.ScenarioResult })),
);

const OBJECTIVES: ScenarioObjective[] = ['max_tonnes', 'min_cost'];
const BUDGET_MAX = 200_000;
const RADII = [200, 300, 500] as const;
type Siting = NonNullable<ScenarioRequest['siting']>;
const SITE_MODES: Extract<CollectionMode, 'existing' | 'street'>[] = ['street', 'existing'];
const snapRadius = (r: number): number =>
  RADII.reduce((best, x) => (Math.abs(x - r) < Math.abs(best - r) ? x : best), 300 as number);
type SectionId = 'goal' | 'assumptions' | 'options';

export interface FormSeed {
  label: string;
  objective: ScenarioObjective;
  budget: number;
  targetPct: number;
  params: PlanningParams;
  constraints: Constraints;
  parentId?: string;
  /** Rede a desenhar: locais reais da rede municipal ou freguesias. */
  siting: Siting;
  radiusM: number;
  siteMode: Extract<CollectionMode, 'existing' | 'street'>;
  /** Completar a rede com recolha a pedido nas freguesias onde compensa. */
  onDemand: boolean;
}

interface ScenarioFormProps {
  parameters: ParametersOut;
  zones: ZoneOut[];
  seed: FormSeed;
  /** Toneladas recolhidas em 2025 (dados da Vitrus), referência para a meta. */
  baselineTonnes: number;
  /** Cenário cujo resultado está na URL (`r`). */
  resultId?: string;
}

/** Ordena as chaves para comparar objetos vindos do servidor e do formulário. */
const stable = (value: unknown): string =>
  JSON.stringify(value, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );

function matchesRequest(s: ScenarioOut, r: ScenarioRequest): boolean {
  const siting = s.result.siting;
  const sameNetwork =
    (siting ? 'sites' : 'parish') === (r.siting ?? 'parish') &&
    (!siting ||
      (siting.radius_m === r.site_radius_m &&
        siting.site_mode === r.site_mode &&
        (siting.on_demand ?? true) === (r.site_on_demand ?? true)));
  return (
    sameNetwork &&
    s.objective === r.objective &&
    (s.budget_eur_year ?? null) === (r.budget_eur_year ?? null) &&
    Math.abs((s.target_tonnes ?? 0) - (r.target_tonnes ?? 0)) < 0.002 &&
    stable(s.params) === stable(r.params) &&
    stable(s.constraints) === stable(r.constraints)
  );
}

export function ScenarioForm({
  parameters,
  zones,
  seed,
  baselineTonnes,
  resultId,
}: ScenarioFormProps) {
  const navigate = useNavigate({ from: '/simulator' });
  const queryClient = useQueryClient();
  const [label, setLabel] = useState(seed.label);
  const [objective, setObjective] = useState<ScenarioObjective>(seed.objective);
  const [budget, setBudget] = useState(seed.budget);
  const [targetPct, setTargetPct] = useState(seed.targetPct);
  const [params, setParams] = useState(seed.params);
  const [constraints, setConstraints] = useState<Constraints>(seed.constraints);
  const [siting, setSiting] = useState<Siting>(seed.siting);
  const [radiusM, setRadiusM] = useState(snapRadius(seed.radiusM));
  const [siteMode, setSiteMode] = useState(seed.siteMode);
  const [onDemand, setOnDemand] = useState(seed.onDemand);
  const [submitted, setSubmitted] = useState(false);
  const [open, setOpen] = useState<Set<SectionId>>(new Set(['goal']));
  const resultRef = useRef<HTMLElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const scrollOnArrival = useRef(false);

  const population = useMemo(() => zones.reduce((sum, z) => sum + z.population, 0), [zones]);
  const potential = (population * params.kg_per_inhab_month * 12) / 1000;
  const targetTonnes = (targetPct / 100) * potential;
  const baselinePct = potential > 0 ? (baselineTonnes / potential) * 100 : 0;

  const paramErrors = validateParams(params);
  const paramErrorCount = Object.keys(paramErrors).length;
  const labelError = label.trim() ? undefined : m.sim_label_required();
  const budgetError =
    objective === 'max_tonnes' && !(budget > 0) ? m.validation_number_positive() : undefined;
  const targetError =
    objective === 'min_cost' && !(targetPct >= 1 && targetPct <= 100)
      ? m.validation_number_positive()
      : undefined;
  const hasErrors =
    paramErrorCount > 0 || Boolean(labelError) || Boolean(budgetError) || Boolean(targetError);

  const changedParams = PARAM_GROUPS.flatMap((g) => g.fields).filter(
    (f) => getParam(params, f.path) !== getParam(parameters.values, f.path),
  ).length;
  const restrictedZones = Object.keys(constraints).length;
  const containers = zones.reduce((sum, z) => sum + (z.existing_containers ?? 0), 0);
  const zonesWithContainers = zones.filter((z) => (z.existing_containers ?? 0) > 0).length;

  const request = useCallback(
    (): ScenarioRequest => ({
      label: label.trim(),
      objective,
      budget_eur_year: objective === 'max_tonnes' ? budget : null,
      target_tonnes: objective === 'min_cost' ? Math.round(targetTonnes * 1000) / 1000 : null,
      params,
      constraints,
      parent_id: seed.parentId ?? null,
      siting,
      site_radius_m: radiusM,
      site_mode: siteMode,
      site_on_demand: onDemand,
    }),
    [
      label,
      objective,
      budget,
      targetTonnes,
      params,
      constraints,
      seed.parentId,
      siting,
      radiusM,
      siteMode,
      onDemand,
    ],
  );

  // Estado partilhável: o objetivo e o valor ficam na URL (replace, sem encher o histórico).
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const id = window.setTimeout(() => {
      navigate({
        search: (prev) => ({
          ...prev,
          goal: objective,
          budget: Number.isFinite(budget) && budget > 0 ? budget : undefined,
          target: Number.isFinite(targetPct) ? targetPct : undefined,
          name: label.trim() && label.trim() !== m.sim_label_default() ? label.trim() : undefined,
          net: siting,
          radius: siting === 'sites' ? (radiusM as 200 | 300 | 500) : undefined,
          point: siting === 'sites' ? siteMode : undefined,
          ondemand: siting === 'sites' ? onDemand : undefined,
        }),
        replace: true,
      });
    }, 400);
    return () => window.clearTimeout(id);
  }, [objective, budget, targetPct, label, siting, radiusM, siteMode, onDemand, navigate]);

  const create = useMutation({
    mutationFn: async (body: ScenarioRequest) => {
      const controller = new AbortController();
      abortRef.current = controller;
      cancelledRef.current = false;
      const { data } = await createScenario({
        body,
        signal: controller.signal,
        throwOnError: true,
      });
      return data;
    },
    onSuccess: async (scenario) => {
      queryClient.setQueryData(
        getScenarioQueryKey({ path: { scenario_id: scenario.id } }),
        scenario,
      );
      await queryClient.invalidateQueries({ queryKey: listScenariosQueryKey() });
      scrollOnArrival.current = true;
      await navigate({ search: (prev) => ({ ...prev, r: scenario.id }), replace: true });
    },
    onError: () => {
      if (cancelledRef.current) {
        create.reset();
        toast(m.simx_cancelled());
      }
    },
  });
  const running = create.isPending;
  const elapsed = useElapsedSeconds(running);

  const resultQuery = useQuery({
    ...getScenarioOptions({ path: { scenario_id: resultId ?? '' } }),
    enabled: Boolean(resultId),
  });
  const scenario = resultId ? resultQuery.data : undefined;

  const status: RunStatus = running
    ? 'running'
    : scenario
      ? scenario.status === 'infeasible'
        ? 'infeasible'
        : matchesRequest(scenario, request())
          ? 'done'
          : 'stale'
      : submitted && hasErrors
        ? 'invalid'
        : 'draft';

  // Ao chegar um resultado novo, leva o utilizador até ele e põe lá o foco.
  const revealResult = useCallback(() => {
    const el = resultRef.current;
    if (!scrollOnArrival.current || !el) return;
    scrollOnArrival.current = false;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reage a um resultado novo
  useEffect(revealResult, [scenario, revealResult]);

  const toggleSection = (id: SectionId, next: boolean) =>
    setOpen((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  const jumpTo = useCallback((id: StepId) => {
    if (id === 'result') {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      resultRef.current?.focus({ preventScroll: true });
      return;
    }
    setOpen((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
  }, []);

  const submit = useCallback(() => {
    if (create.isPending) return;
    setSubmitted(true);
    if (hasErrors) {
      if (labelError || budgetError || targetError) jumpTo('goal');
      else jumpTo('assumptions');
      return;
    }
    create.mutate(request());
  }, [create, hasErrors, labelError, budgetError, targetError, request, jumpTo]);

  // Atalhos: Ctrl/⌘ + Enter calcula; Esc cancela um cálculo em curso.
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        submitRef.current();
      } else if (e.key === 'Escape' && create.isPending) {
        cancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancel, create.isPending]);

  const valueText =
    objective === 'max_tonnes'
      ? Number.isFinite(budget)
        ? m.simx_eur_year({ value: formatEur(budget) })
        : m.common_dash()
      : `${formatPercent(targetPct, 0)} · ${formatTonnes(targetTonnes, 0)}`;

  const problems = [
    labelError,
    budgetError,
    targetError,
    paramErrorCount > 0 ? `${m.sim_assumptions_title()}: ${paramErrorCount}` : undefined,
  ].filter((x): x is string => Boolean(x));

  const summary: SummaryData = {
    goalLabel: objectiveLabel[objective](),
    valueLabel: objective === 'max_tonnes' ? m.sim_budget() : m.sim_target(),
    valueText,
    potentialText: formatTonnes(potential, 0),
    locationsText:
      containers > 0
        ? m.simx_sum_locations_value({
            n: formatNumber(containers),
            zones: formatNumber(zonesWithContainers),
          })
        : m.sim_existing_none(),
    networkText:
      siting === 'sites'
        ? `${m.site_sum_sites({
            radius: String(radiusM),
            mode: siteModeLabel[siteMode]().toLowerCase(),
          })}${onDemand ? ` · ${m.site_sum_on_demand()}` : ''}`
        : m.site_sum_parish(),
    runNote:
      siting === 'sites'
        ? objective === 'max_tonnes'
          ? m.site_run_note()
          : m.site_run_note_target()
        : m.simx_run_note(),
    restrictionsText:
      restrictedZones === 0 ? m.sim_summary_none() : m.sim_summary_zones({ n: restrictedZones }),
    assumptionsText:
      changedParams === 0 ? m.sim_summary_defaults() : m.sim_summary_changed({ n: changedParams }),
    problems: submitted || status === 'invalid' ? problems : [],
  };

  const run: RunControl = {
    status,
    pending: running,
    elapsed,
    onCancel: cancel,
    bySites: siting === 'sites',
    result: scenario,
    onSeeResult: () => jumpTo('result'),
  };

  const goalSummary =
    objective === 'max_tonnes'
      ? m.simx_sum_goal_budget({
          goal: objectiveLabel[objective](),
          value: Number.isFinite(budget) ? m.simx_eur_year({ value: formatEur(budget) }) : '…',
        })
      : m.simx_sum_goal_target({
          goal: objectiveLabel[objective](),
          pct: formatPercent(targetPct, 0),
          tonnes: formatTonnes(targetTonnes, 0),
        });

  return (
    <>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
      >
        <div className="grid items-start gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="min-w-0 space-y-3 lg:col-span-7 xl:col-span-8">
            <div className="sticky top-0 z-10 -mx-4 bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
              <ProgressSteps
                goalInvalid={submitted && Boolean(labelError || budgetError || targetError)}
                assumptionsChanged={changedParams > 0}
                optionsChanged={restrictedZones > 0}
                status={status}
                onSelect={jumpTo}
              />
            </div>
            <FormAlert
              message={
                create.isError && !cancelledRef.current ? getErrorMessage(create.error) : null
              }
            />

            <FormSection
              id="sec-goal"
              title={m.sim_step_objective()}
              summary={goalSummary}
              open={open.has('goal')}
              onOpenChange={(v) => toggleSection('goal', v)}
              invalid={submitted && Boolean(labelError || budgetError || targetError)}
            >
              <div className="space-y-1.5">
                <Label htmlFor="label" className="text-sm">
                  {m.sim_label()}
                </Label>
                <Input
                  id="label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={80}
                  className="h-10"
                  aria-invalid={submitted && labelError ? true : undefined}
                />
                {submitted && labelError && (
                  <p role="alert" className="text-destructive text-xs">
                    {labelError}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{m.sim_objective()}</span>
                  <HelpHint label={m.sim_objective()}>
                    <ul className="space-y-2">
                      {OBJECTIVES.map((o) => (
                        <li key={o}>
                          <span className="font-medium">{objectiveLabel[o]()}.</span>{' '}
                          {objectiveHint[o]()}
                        </li>
                      ))}
                    </ul>
                  </HelpHint>
                </div>
                <Segmented
                  label={m.simx_goal_aria()}
                  value={objective}
                  onChange={setObjective}
                  options={OBJECTIVES.map((o) => ({ value: o, label: objectiveLabel[o]() }))}
                />
              </div>

              {objective === 'max_tonnes' ? (
                <NumericControl
                  label={m.sim_budget()}
                  help={m.simx_help_budget()}
                  value={budget}
                  onChange={setBudget}
                  unit="€/ano"
                  step={1000}
                  sliderMin={5000}
                  sliderMax={BUDGET_MAX}
                  min={0}
                  formatBound={formatEur}
                  error={submitted ? budgetError : undefined}
                  hint={
                    budget > 0 && population > 0
                      ? m.simx_budget_per_inhab({
                          value: `${formatNumber(budget / population, 2)} €`,
                        })
                      : undefined
                  }
                />
              ) : (
                <NumericControl
                  label={m.sim_target()}
                  help={m.simx_help_target({ kg: formatNumber(params.kg_per_inhab_month, 1) })}
                  value={targetPct}
                  onChange={setTargetPct}
                  unit="%"
                  step={1}
                  sliderMin={1}
                  sliderMax={100}
                  min={1}
                  max={100}
                  marker={{ value: baselinePct, label: m.simx_marker_2025() }}
                  formatBound={(v) => `${formatNumber(v)}%`}
                  error={submitted ? targetError : undefined}
                  hint={m.sim_target_hint({
                    tonnes: formatTonnes(targetTonnes, 0),
                    potential: formatTonnes(potential, 0),
                  })}
                />
              )}
              <p className="text-muted-foreground text-xs">
                {m.simx_reference_2025({
                  tonnes: formatTonnes(baselineTonnes, 1),
                  pct: formatPercent(baselinePct, 1),
                })}
              </p>

              <NetworkControl
                siting={siting}
                onSitingChange={setSiting}
                radiusM={radiusM}
                onRadiusChange={setRadiusM}
                siteMode={siteMode}
                onSiteModeChange={setSiteMode}
                onDemand={onDemand}
                onOnDemandChange={setOnDemand}
              />
            </FormSection>

            <FormSection
              id="sec-assumptions"
              title={m.simx_sec_assumptions()}
              summary={
                changedParams === 0
                  ? m.simx_sum_assumptions_default()
                  : m.simx_sum_assumptions_changed({ n: changedParams })
              }
              open={open.has('assumptions')}
              onOpenChange={(v) => toggleSection('assumptions', v)}
              invalid={submitted && paramErrorCount > 0}
            >
              <ModesOverview params={params} zones={zones} />
              <ParametersForm
                value={params}
                onChange={setParams}
                meta={parameters.meta}
                errors={submitted ? paramErrors : {}}
                defaultOpen={['general']}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10"
                disabled={changedParams === 0}
                onClick={() => setParams(parameters.values)}
              >
                {m.sim_assumptions_reset()}
              </Button>
            </FormSection>

            <FormSection
              id="sec-options"
              title={m.sim_constraints_title()}
              summary={
                restrictedZones === 0
                  ? m.simx_sum_options_none()
                  : m.simx_sum_options_some({ n: restrictedZones })
              }
              open={open.has('options')}
              onOpenChange={(v) => toggleSection('options', v)}
            >
              <ConstraintsEditor zones={zones} value={constraints} onChange={setConstraints} />
            </FormSection>
          </div>

          <aside className="hidden lg:sticky lg:top-4 lg:col-span-5 lg:block xl:col-span-4">
            <SummaryPanel data={summary} run={run} />
          </aside>
        </div>

        <StickyActions className="lg:hidden">
          <SummaryBar data={summary} run={run} />
        </StickyActions>
      </form>

      {resultId && (
        <>
          {resultQuery.isPending && (
            <section
              id="resultado"
              ref={resultRef}
              tabIndex={-1}
              aria-busy="true"
              aria-label={m.simx_res_loading()}
              className="space-y-4 outline-none"
            >
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </section>
          )}
          {resultQuery.isError && (
            <ErrorState error={resultQuery.error} onRetry={() => resultQuery.refetch()} />
          )}
          {scenario && (
            <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
              <ScenarioResult
                ref={resultRef}
                scenario={scenario}
                zones={zones}
                status={status}
                onMount={revealResult}
              />
            </Suspense>
          )}
        </>
      )}
    </>
  );
}

const siteModeLabel: Record<(typeof SITE_MODES)[number], () => string> = {
  existing: () => m.site_mode_existing(),
  street: () => m.site_mode_street(),
};

interface NetworkControlProps {
  siting: Siting;
  onSitingChange: (v: Siting) => void;
  radiusM: number;
  onRadiusChange: (v: number) => void;
  siteMode: (typeof SITE_MODES)[number];
  onSiteModeChange: (v: (typeof SITE_MODES)[number]) => void;
  onDemand: boolean;
  onOnDemandChange: (v: boolean) => void;
}

/** Rede a desenhar: locais reais da rede municipal (por omissão) ou freguesias, com raio a pé e tipo de ponto. */
function NetworkControl({
  siting,
  onSitingChange,
  radiusM,
  onRadiusChange,
  siteMode,
  onSiteModeChange,
  onDemand,
  onOnDemandChange,
}: NetworkControlProps) {
  return (
    <div className="space-y-4 border-t pt-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm">{m.site_net_label()}</span>
          <HelpHint label={m.site_net_label()}>
            <ul className="space-y-2">
              <li>{m.site_net_help_sites()}</li>
              <li>{m.site_net_help_parish()}</li>
              <li className="text-muted-foreground">{m.site_net_help_assumption()}</li>
            </ul>
          </HelpHint>
        </div>
        <Segmented
          label={m.site_net_aria()}
          value={siting}
          onChange={onSitingChange}
          options={[
            { value: 'sites', label: m.site_net_sites() },
            { value: 'parish', label: m.site_net_parish() },
          ]}
        />
      </div>

      {siting === 'sites' && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm">{m.site_radius_label()}</span>
              <HelpHint label={m.site_radius_label()}>{m.site_radius_help()}</HelpHint>
            </div>
            <Segmented
              label={m.site_radius_aria()}
              value={String(radiusM)}
              onChange={(v) => onRadiusChange(Number(v))}
              options={RADII.map((r) => ({
                value: String(r),
                label: m.site_radius_value({ n: String(r) }),
              }))}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm">{m.site_mode_label()}</span>
              <HelpHint label={m.site_mode_label()}>
                <ul className="space-y-2">
                  <li>{m.site_mode_help_existing()}</li>
                  <li>{m.site_mode_help_street()}</li>
                  <li className="text-muted-foreground">{m.site_net_help_assumption()}</li>
                </ul>
              </HelpHint>
            </div>
            <Segmented
              label={m.site_mode_aria()}
              value={siteMode}
              onChange={onSiteModeChange}
              options={SITE_MODES.map((o) => ({ value: o, label: siteModeLabel[o]() }))}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="site-on-demand" className="min-h-10 flex-1 items-center text-sm">
              {m.site_od_label()}
            </Label>
            <HelpHint label={m.site_od_label()}>{m.site_od_help()}</HelpHint>
            <Switch id="site-on-demand" checked={onDemand} onCheckedChange={onOnDemandChange} />
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {m.site_net_slow()} {m.site_note_estimate()}
          </p>
        </>
      )}
    </div>
  );
}

/** Os três modos de recolha: números-chave dos pressupostos atuais, em linhas compactas. */
function ModesOverview({ params, zones }: { params: PlanningParams; zones: ZoneOut[] }) {
  const withContainers = zones
    .filter((z) => (z.existing_containers ?? 0) > 0)
    .sort((a, b) => (b.existing_containers ?? 0) - (a.existing_containers ?? 0));
  const totalContainers = withContainers.reduce((sum, z) => sum + (z.existing_containers ?? 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-sm">{m.sim_step_modes()}</h3>
        <HelpHint label={m.sim_step_modes()}>{m.simx_help_modes()}</HelpHint>
      </div>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {MODES.map((mode) => {
          const p = params.modes[mode];
          if (!p) return null;
          return (
            <li key={mode} className="min-w-0 space-y-2 rounded-lg border p-3">
              <p className="flex items-center justify-between gap-2 font-medium text-sm">
                <span className="flex items-center gap-2">
                  <ModeDot mode={mode} /> {modeLabel[mode]()}
                </span>
                <HelpHint label={modeLabel[mode]()}>{modeHint[mode]()}</HelpHint>
              </p>
              <dl className="grid grid-cols-3 gap-2 text-xs tabular-nums md:grid-cols-1 md:gap-1">
                <Metric
                  label={m.simx_mode_capture()}
                  value={formatPercent(p.capture_rate * 100, 1)}
                />
                {mode !== 'on_demand' && (
                  <Metric
                    label={m.simx_mode_density()}
                    value={m.sim_mode_people({ n: formatNumber(p.people_per_point) })}
                  />
                )}
                <Metric label={m.simx_mode_capex()} value={formatEur(p.capex_per_point_eur)} />
              </dl>
              {mode === 'existing' && (
                <Collapsible className="border-t pt-2">
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
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 md:flex md:items-baseline md:justify-between md:gap-2">
      <dt className="truncate text-muted-foreground">{label}</dt>
      <dd className="font-medium text-sm">{value}</dd>
    </div>
  );
}
