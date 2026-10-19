import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import {
  getObservedFlowsOptions,
  getTextileBaselineOptions,
  getWasteCompositionOptions,
} from '@/client/@tanstack/react-query.gen';
import { Page, SectionTitle } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { CaptureBar } from '@/features/baseline/capture-bar';
import { EntityTable } from '@/features/baseline/entity-table';
import { FlowsSankey } from '@/features/baseline/flows-sankey';
import { buildInsights } from '@/features/baseline/insights';
import { WasteCompositionChart } from '@/features/baseline/waste-composition';
import { formatKg, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/')({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(getTextileBaselineOptions()),
      queryClient.ensureQueryData(getObservedFlowsOptions()),
      queryClient.ensureQueryData(getWasteCompositionOptions()),
    ]),
  head: () => ({ meta: [{ title: m.title_baseline() }] }),
  component: Baseline,
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

function Baseline() {
  const { data: b } = useSuspenseQuery(getTextileBaselineOptions());
  const { data: flows } = useSuspenseQuery(getObservedFlowsOptions());
  const { data: waste } = useSuspenseQuery(getWasteCompositionOptions());
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
        <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <CaptureBar baseline={b} />
        </div>
      </Section>

      <Section
        title={m.section_flows_title()}
        description={m.section_flows_description({ year: b.year })}
      >
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <FlowsSankey flows={flows} />
        </div>
        <EntityTable entities={b.entities} />
      </Section>

      <Section title={m.section_insights_title()}>
        <ul className="grid gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border sm:grid-cols-2">
          {insights.map((i) => (
            <li key={i.title} className="space-y-1.5 bg-card p-5">
              <p className="font-medium">{i.title}</p>
              <p className="text-muted-foreground text-sm leading-relaxed">{i.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title={m.section_waste_title()}
        description={m.section_waste_description({ kg: formatNumber(waste.kg_per_inhab_year_pt) })}
      >
        <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <WasteCompositionChart waste={waste} />
        </div>
      </Section>
    </Page>
  );
}
