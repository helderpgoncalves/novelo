import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import {
  getScenarioFlowsOptions,
  getScenarioOptions,
  listZonesOptions,
} from '@/client/@tanstack/react-query.gen';
import { Page, Section } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { PageTabs } from '@/components/page-tabs';
import { Panel } from '@/components/panel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FlowsSankey } from '@/features/baseline/flows-sankey';
import { AllocationsTable } from '@/features/scenarios/allocations-table';
import { CollectionPlanSection } from '@/features/scenarios/collection-plan-section';
import { CoveragePanel } from '@/features/scenarios/coverage-panel';
import { ModeSummaryCards } from '@/features/scenarios/mode-summary';
import { ParameterSummary } from '@/features/scenarios/parameter-summary';
import { RoutesTable } from '@/features/scenarios/routes-table';
import { ScenarioActions } from '@/features/scenarios/scenario-actions';
import { ScenarioAnchor } from '@/features/scenarios/scenario-anchor';
import {
  ScenarioKpis,
  ScenarioReusable,
  ScenarioSecondaryKpis,
} from '@/features/scenarios/scenario-kpis';
import { ScenarioMap } from '@/features/scenarios/scenario-map';
import { SitesTable } from '@/features/scenarios/sites-table';
import { SitingOverview } from '@/features/scenarios/siting-overview';
import { UncertaintyPanel } from '@/features/scenarios/uncertainty-panel';
import { WhatIfPanel } from '@/features/whatif/whatif-panel';
import { formatEur, formatTonnes } from '@/lib/format';
import { objectiveLabel } from '@/lib/scenario';
import { m } from '@/paraglide/messages';

const TABS = ['summary', 'network', 'coverage', 'uncertainty', 'whatif'] as const;
type TabId = (typeof TABS)[number];

export const Route = createFileRoute('/_app/scenarios/$scenarioId')({
  validateSearch: z.object({ tab: z.enum(TABS).optional().catch(undefined) }),
  loader: ({ context: { queryClient }, params }) =>
    Promise.all([
      queryClient.ensureQueryData(getScenarioOptions({ path: { scenario_id: params.scenarioId } })),
      queryClient.ensureQueryData(
        getScenarioFlowsOptions({ path: { scenario_id: params.scenarioId } }),
      ),
      queryClient.ensureQueryData(listZonesOptions()),
    ]),
  staticData: { skeleton: 'detail' },
  head: () => ({ meta: [{ title: m.title_scenario() }] }),
  component: ScenarioPage,
});

const tabLabel: Record<TabId, () => string> = {
  summary: () => m.scn_tab_summary(),
  network: () => m.scn_tab_network(),
  coverage: () => m.scn_tab_coverage(),
  uncertainty: () => m.scn_tab_uncertainty(),
  whatif: () => m.scn_tab_whatif(),
};

function ScenarioPage() {
  const { scenarioId } = Route.useParams();
  const { tab = 'summary' } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
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

      {/* Por cima dos separadores só o essencial: os quatro números e a frase-âncora. O resto vive no separador. */}
      <div className="space-y-4">
        <ScenarioKpis kpis={result.kpis} bySites={Boolean(result.siting)} />
        <ScenarioAnchor scenario={scenario} />
      </div>

      <PageTabs
        // Em telemóvel, menos folga lateral em cada separador; os que não cabem rolam dentro da barra (com esbatido).
        className="max-sm:[&_[role=tab]]:px-2!"
        label={m.rw_tabs_label()}
        value={tab}
        onValueChange={(next) =>
          navigate({
            search: { tab: next === 'summary' ? undefined : (next as TabId) },
            replace: true,
          })
        }
        tabs={[
          {
            id: 'summary',
            label: tabLabel.summary(),
            contentClassName: 'space-y-8',
            content: (
              <>
                <ScenarioSecondaryKpis kpis={result.kpis} routes={result.routes.length} />
                <ScenarioReusable kpis={result.kpis} />
                <Section
                  title={m.scenario_modes_title()}
                  description={m.scenario_modes_description()}
                >
                  <ModeSummaryCards modes={result.modes} totalTonnes={result.kpis.tonnes_year} />
                </Section>
                <Section title={m.plan_title()} description={m.plan_description()}>
                  <CollectionPlanSection
                    plan={result.collection_plan}
                    kpis={result.kpis}
                    scenarioId={scenario.id}
                    heading={false}
                  />
                </Section>
                <Section
                  title={m.scenario_flows_title()}
                  description={m.scenario_flows_description()}
                >
                  <Panel>
                    <FlowsSankey flows={flows} />
                  </Panel>
                </Section>
                <Collapsible className="rounded-xl bg-card ring-1 ring-foreground/10">
                  <CollapsibleTrigger className="group flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3 text-left outline-offset-[-2px] sm:px-5">
                    <span className="min-w-0 flex-1 space-y-0.5">
                      <span className="block font-medium text-sm">{m.scenario_params_title()}</span>
                      <span className="block text-pretty text-muted-foreground text-xs">
                        {m.scenario_params_description()}
                      </span>
                    </span>
                    <ChevronDown
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                      aria-hidden="true"
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-5 sm:px-5">
                    <ParameterSummary params={scenario.params} />
                  </CollapsibleContent>
                </Collapsible>
              </>
            ),
          },
          {
            id: 'network',
            label: tabLabel.network(),
            contentClassName: 'space-y-8',
            content: (
              <>
                {result.siting && (
                  <SitingOverview siting={result.siting} sites={result.sites ?? []} />
                )}
                <Section
                  title={m.scenario_map_title()}
                  description={
                    result.siting ? m.site_map_description() : m.scenario_map_description()
                  }
                  actions={
                    <Label className="flex min-h-10 items-center gap-2 font-normal text-sm">
                      <Switch checked={showRoutes} onCheckedChange={setShowRoutes} />
                      {m.scenario_show_routes()}
                    </Label>
                  }
                >
                  <ScenarioMap
                    zones={zones}
                    result={result}
                    showRoutes={showRoutes}
                    className="h-[28rem] overflow-hidden rounded-xl ring-1 ring-foreground/10 lg:h-[36rem]"
                  />
                </Section>
                {result.siting && (
                  <Section title={m.site_title()} description={m.site_description()}>
                    <SitesTable sites={result.sites ?? []} />
                  </Section>
                )}
                <Section
                  title={m.scenario_routes_title()}
                  description={m.scenario_routes_description()}
                >
                  <RoutesTable routes={result.routes} />
                </Section>
                <Section title={m.scenario_alloc_title()}>
                  <AllocationsTable allocations={result.allocations} />
                </Section>
              </>
            ),
          },
          {
            id: 'coverage',
            label: tabLabel.coverage(),
            content: <CoveragePanel scenarioId={scenario.id} />,
          },
          {
            id: 'uncertainty',
            label: tabLabel.uncertainty(),
            content: <UncertaintyPanel scenario={scenario} />,
          },
          {
            id: 'whatif',
            label: tabLabel.whatif(),
            content: (
              <Section title={m.whatif_title()} description={m.whatif_description()}>
                <WhatIfPanel scenario={scenario} />
              </Section>
            ),
          },
        ]}
      />
    </Page>
  );
}
