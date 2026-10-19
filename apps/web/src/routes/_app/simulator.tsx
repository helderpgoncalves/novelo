import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import type { ScenarioOut } from '@/client';
import {
  getPlanningParametersOptions,
  getScenarioOptions,
  listZonesOptions,
} from '@/client/@tanstack/react-query.gen';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { type FormSeed, ScenarioForm } from '@/features/simulator/scenario-form';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/simulator')({
  // `from` pré-preenche o formulário com um cenário existente (ajustar e voltar a correr).
  validateSearch: z.object({ from: z.string().uuid().optional().catch(undefined) }),
  loaderDeps: ({ search }) => ({ from: search.from }),
  loader: ({ context: { queryClient }, deps }) =>
    Promise.all([
      queryClient.ensureQueryData(getPlanningParametersOptions()),
      queryClient.ensureQueryData(listZonesOptions()),
      deps.from
        ? queryClient.ensureQueryData(getScenarioOptions({ path: { scenario_id: deps.from } }))
        : Promise.resolve(null),
    ]),
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
  };
}

function Simulator() {
  const { from } = Route.useSearch();
  const { data: parameters } = useSuspenseQuery(getPlanningParametersOptions());
  const { data: zones } = useSuspenseQuery(listZonesOptions());
  const [, , base] = Route.useLoaderData();

  const defaults: FormSeed = {
    label: m.sim_label_default(),
    objective: 'max_tonnes',
    budget: 40000,
    targetPct: 40,
    params: parameters.values,
    constraints: {},
  };
  const seed = seedFrom(base, defaults);

  return (
    <Page>
      <PageHeader
        eyebrow={m.sim_eyebrow()}
        title={m.sim_title()}
        description={m.sim_description()}
      />
      {/* A chave recria o formulário quando se muda de cenário de origem */}
      <ScenarioForm key={from ?? 'new'} parameters={parameters} zones={zones} seed={seed} />
    </Page>
  );
}
