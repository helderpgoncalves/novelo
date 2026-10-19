import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { AlertTriangle } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import {
  getScenarioFlowsOptions,
  getScenarioOptions,
  listZonesOptions,
} from '@/client/@tanstack/react-query.gen';
import { Page, SectionTitle } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FlowsSankey } from '@/features/baseline/flows-sankey';
import { AllocationsTable } from '@/features/scenarios/allocations-table';
import { ModeSummaryCards } from '@/features/scenarios/mode-summary';
import { ParameterSummary } from '@/features/scenarios/parameter-summary';
import { RoutesTable } from '@/features/scenarios/routes-table';
import { ScenarioActions } from '@/features/scenarios/scenario-actions';
import { ScenarioKpis } from '@/features/scenarios/scenario-kpis';
import { ScenarioMap } from '@/features/scenarios/scenario-map';
import { WhatIfPanel } from '@/features/whatif/whatif-panel';
import { formatEur, formatTonnes } from '@/lib/format';
import { objectiveLabel } from '@/lib/scenario';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/scenarios/$scenarioId')({
  loader: ({ context: { queryClient }, params }) =>
    Promise.all([
      queryClient.ensureQueryData(getScenarioOptions({ path: { scenario_id: params.scenarioId } })),
      queryClient.ensureQueryData(
        getScenarioFlowsOptions({ path: { scenario_id: params.scenarioId } }),
      ),
      queryClient.ensureQueryData(listZonesOptions()),
    ]),
  head: () => ({ meta: [{ title: m.title_scenario() }] }),
  component: ScenarioPage,
});

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <SectionTitle>{title}</SectionTitle>
        {description && (
          <p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function ScenarioPage() {
  const { scenarioId } = Route.useParams();
  const { data: scenario } = useSuspenseQuery(
    getScenarioOptions({ path: { scenario_id: scenarioId } }),
  );
  const { data: flows } = useSuspenseQuery(
    getScenarioFlowsOptions({ path: { scenario_id: scenarioId } }),
  );
  const { data: zones } = useSuspenseQuery(listZonesOptions());
  const [showRoutes, setShowRoutes] = useState(true);
  const { result } = scenario;
  const budgetOrTarget =
    scenario.objective === 'max_tonnes' && scenario.budget_eur_year != null
      ? m.scenario_subtitle_budget({ value: formatEur(scenario.budget_eur_year) })
      : m.scenario_subtitle_target({ value: formatTonnes(scenario.target_tonnes ?? 0, 0) });

  return (
    <Page>
      <PageHeader
        eyebrow={`${objectiveLabel[scenario.objective]()} · ${budgetOrTarget}`}
        title={scenario.label}
        description={m.scenario_description()}
        actions={<ScenarioActions scenario={scenario} />}
      />

      {scenario.status === 'infeasible' && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>{m.scenario_infeasible_title()}</AlertTitle>
          <AlertDescription>{m.scenario_infeasible_text()}</AlertDescription>
        </Alert>
      )}

      <ScenarioKpis kpis={result.kpis} />

      <Section title={m.whatif_title()} description={m.whatif_description()}>
        <WhatIfPanel scenario={scenario} />
      </Section>

      <Section title={m.scenario_map_title()} description={m.scenario_map_description()}>
        <div className="flex justify-end">
          <Label className="flex items-center gap-2 font-normal text-sm">
            <Switch checked={showRoutes} onCheckedChange={setShowRoutes} />
            {m.scenario_show_routes()}
          </Label>
        </div>
        <ScenarioMap
          zones={zones}
          result={result}
          showRoutes={showRoutes}
          className="h-[32rem] overflow-hidden rounded-xl ring-1 ring-foreground/10"
        />
      </Section>

      <Section title={m.scenario_modes_title()} description={m.scenario_modes_description()}>
        <ModeSummaryCards modes={result.modes} totalTonnes={result.kpis.tonnes_year} />
      </Section>

      <Section title={m.scenario_flows_title()} description={m.scenario_flows_description()}>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <FlowsSankey flows={flows} />
        </div>
      </Section>

      <Section title={m.scenario_routes_title()} description={m.scenario_routes_description()}>
        <RoutesTable routes={result.routes} />
      </Section>

      <Section title={m.scenario_alloc_title()}>
        <AllocationsTable allocations={result.allocations} />
      </Section>

      <Section title={m.scenario_params_title()} description={m.scenario_params_description()}>
        <ParameterSummary params={scenario.params} />
      </Section>
    </Page>
  );
}
