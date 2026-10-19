import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import {
  getObservedFlowsOptions,
  getTextileBaselineOptions,
  getWasteCompositionOptions,
} from '@/client/@tanstack/react-query.gen';
import { Page, Panel, Section } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { PageTabs } from '@/components/page-tabs';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { CaptureBar } from '@/features/baseline/capture-bar';
import { EntityTable } from '@/features/baseline/entity-table';
import { FlowsSankey } from '@/features/baseline/flows-sankey';
import { buildInsights } from '@/features/baseline/insights';
import { WasteCompositionChart } from '@/features/baseline/waste-composition';
import { formatKg, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';

const TABS = ['entities', 'waste'] as const;

export const Route = createFileRoute('/_app/')({
  staticData: { skeleton: 'dashboard' },
  validateSearch: z.object({ tab: z.enum(TABS).optional().catch(undefined) }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(getTextileBaselineOptions()),
      queryClient.ensureQueryData(getObservedFlowsOptions()),
      queryClient.ensureQueryData(getWasteCompositionOptions()),
    ]),
  head: () => ({ meta: [{ title: m.title_baseline() }] }),
  component: Baseline,
});

function Baseline() {
  const { data: b } = useSuspenseQuery(getTextileBaselineOptions());
  const { data: flows } = useSuspenseQuery(getObservedFlowsOptions());
  const { data: waste } = useSuspenseQuery(getWasteCompositionOptions());
  const { tab = 'entities' } = Route.useSearch();
  const navigate = Route.useNavigate();
  const insights = buildInsights(b);

  return (
    <Page>
      <PageHeader
        eyebrow={m.baseline_eyebrow({ year: b.year })}
        title={m.baseline_title()}
        description={m.baseline_description({ population: formatNumber(b.population) })}
      />

      <StatStrip>
        <StatCell
          label={m.stat_collected()}
          value={formatTonnes(b.total_t)}
          hint={m.stat_collected_hint({ count: b.entities.length, year: b.year })}
        />
        <StatCell
          label={m.stat_vs_potential()}
          value={formatPercent(b.capture_of_demand_pct)}
          tag={m.common_estimate()}
          tone="primary"
          hint={m.stat_vs_potential_hint({ tonnes: formatTonnes(b.estimated_demand_t, 0) })}
        />
        <StatCell
          label={m.stat_per_inhabitant()}
          value={formatKg(b.kg_per_inhab_month)}
          hint={m.stat_per_inhabitant_hint()}
        />
        <StatCell
          label={m.stat_to_capture()}
          value={formatTonnes(b.gap_t, 0)}
          tag={m.common_estimate()}
          tone="primary"
          hint={m.stat_to_capture_hint()}
        />
      </StatStrip>

      <Section title={m.section_gap_title()} description={m.section_gap_description()}>
        <Panel>
          <CaptureBar baseline={b} />
        </Panel>
      </Section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-6">
        <Section
          title={m.section_flows_title()}
          description={m.section_flows_description({ year: b.year })}
          className="min-w-0 lg:col-span-8"
        >
          <Panel className="p-3 sm:p-4">
            <FlowsSankey flows={flows} className="lg:h-[26rem]" />
          </Panel>
        </Section>
        <Section title={m.section_insights_title()} className="lg:col-span-4">
          <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            {insights.map((i) => (
              <li key={i.title} className="space-y-1 p-4">
                <p className="font-medium text-sm">{i.title}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">{i.body}</p>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <PageTabs
        label={m.rw_tabs_label()}
        value={tab}
        onValueChange={(next) => void navigate({ search: { tab: next }, replace: true })}
        tabs={[
          {
            id: 'entities',
            label: m.rw_baseline_tab_entities(),
            count: b.entities.length,
            content: <EntityTable entities={b.entities} />,
          },
          {
            id: 'waste',
            label: m.rw_baseline_tab_waste(),
            content: (
              <Section
                title={m.section_waste_title()}
                description={m.section_waste_description({
                  kg: formatNumber(waste.kg_per_inhab_year_pt),
                })}
              >
                <Panel>
                  <WasteCompositionChart waste={waste} />
                </Panel>
              </Section>
            ),
          },
        ]}
      />
    </Page>
  );
}
