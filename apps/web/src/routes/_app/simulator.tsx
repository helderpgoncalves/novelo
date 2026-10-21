import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import type { ScenarioOut } from '@/client';
import {
  getPlanningParametersOptions,
  getScenarioOptions,
  getTextileBaselineOptions,
  listZonesOptions,
} from '@/client/@tanstack/react-query.gen';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { type FormSeed, ScenarioForm } from '@/features/simulator/scenario-form';
import { m } from '@/paraglide/messages';

const uuid = z.string().uuid().optional().catch(undefined);

export const Route = createFileRoute('/_app/simulator')({
  // Estado partilhável: `from` pré-preenche com um cenário, `r` mostra um resultado, o resto é o formulário.
  validateSearch: z.object({
    from: uuid,
    r: uuid,
    goal: z.enum(['max_tonnes', 'min_cost']).optional().catch(undefined),
    budget: z.number().positive().max(10_000_000).optional().catch(undefined),
    target: z.number().min(1).max(100).optional().catch(undefined),
    name: z.string().max(80).optional().catch(undefined),
    net: z.enum(['sites', 'parish']).optional().catch(undefined),
    radius: z
      .union([z.literal(200), z.literal(300), z.literal(500)])
      .optional()
      .catch(undefined),
    point: z.enum(['existing', 'street']).optional().catch(undefined),
    ondemand: z.boolean().optional().catch(undefined),
  }),
  loaderDeps: ({ search }) => ({ from: search.from }),
  loader: ({ context: { queryClient }, deps }) =>
    Promise.all([
      queryClient.ensureQueryData(getPlanningParametersOptions()),
      queryClient.ensureQueryData(listZonesOptions()),
      queryClient.ensureQueryData(getTextileBaselineOptions()),
      deps.from
        ? queryClient.ensureQueryData(getScenarioOptions({ path: { scenario_id: deps.from } }))
        : Promise.resolve(null),
    ]),
  staticData: { skeleton: 'form' },
  head: () => ({ meta: [{ title: m.title_simulator() }] }),
  component: Simulator,
});

function seedFrom(scenario: ScenarioOut | null | undefined, defaults: FormSeed): FormSeed {
  if (!scenario) return defaults;
  const potential = scenario.result.kpis.potential_t;
  return {
    label: m.sim_label_copy({ label: scenario.label }),
    objective: scenario.objective,
    budget: scenario.budget_eur_year ?? defaults.budget,
    targetPct:
      scenario.target_tonnes != null && potential > 0
        ? Math.round((scenario.target_tonnes / potential) * 100)
        : defaults.targetPct,
    params: scenario.params,
    constraints: scenario.constraints,
    parentId: scenario.id,
    siting: scenario.result.siting ? 'sites' : 'parish',
    radiusM: scenario.result.siting?.radius_m ?? defaults.radiusM,
    onDemand: scenario.result.siting?.on_demand ?? defaults.onDemand,
    siteMode: scenario.result.siting
      ? scenario.result.siting.site_mode === 'street'
        ? 'street'
        : 'existing'
      : defaults.siteMode,
  };
}

function Simulator() {
  const search = Route.useSearch();
  const { data: parameters } = useSuspenseQuery(getPlanningParametersOptions());
  const { data: zones } = useSuspenseQuery(listZonesOptions());
  const { data: baseline } = useSuspenseQuery(getTextileBaselineOptions());
  const [, , , base] = Route.useLoaderData();

  // Valores por omissão dos dados reais: a meta parte da captura de 2025 mais 10 pontos percentuais.
  const defaults: FormSeed = {
    label: m.sim_label_default(),
    objective: 'max_tonnes',
    budget: 60000,
    targetPct: Math.min(100, Math.max(1, Math.round(baseline.capture_of_demand_pct) + 10)),
    params: parameters.values,
    constraints: {},
    siting: 'sites',
    radiusM: 300,
    siteMode: 'existing',
    onDemand: true,
  };
  const fromBase = seedFrom(base, defaults);
  const seed: FormSeed = {
    ...fromBase,
    objective: search.goal ?? fromBase.objective,
    budget: search.budget ?? fromBase.budget,
    targetPct: search.target ?? fromBase.targetPct,
    label: search.name ?? fromBase.label,
    siting: search.net ?? fromBase.siting,
    radiusM: search.radius ?? fromBase.radiusM,
    siteMode: search.point ?? fromBase.siteMode,
    onDemand: search.ondemand ?? fromBase.onDemand,
  };

  return (
    <Page className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow={m.sim_eyebrow()}
        title={m.sim_title()}
        description={<span className="hidden sm:inline">{m.simx_description()}</span>}
      />
      {/* A chave recria o formulário quando se muda de cenário de origem */}
      <ScenarioForm
        key={search.from ?? 'new'}
        parameters={parameters}
        zones={zones}
        seed={seed}
        baselineTonnes={baseline.total_t}
        resultId={search.r}
      />
    </Page>
  );
}
