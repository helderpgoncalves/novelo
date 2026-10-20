import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { FrontierPoint } from '@/client';
import {
  getObservedFlowsOptions,
  getOverviewOptions,
  getTextileBaselineOptions,
  getWasteCompositionOptions,
  listZonesOptions,
} from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { Page, Panel, Section } from '@/components/page';
import { PageTabs } from '@/components/page-tabs';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { EntityTable } from '@/features/baseline/entity-table';
import { FlowsSankey } from '@/features/baseline/flows-sankey';
import { WasteCompositionChart } from '@/features/baseline/waste-composition';
import { formatEur, formatKg, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { Shortcuts } from './actions';
import { Cascade } from './cascade';
import { benchmarkSubject } from './copy';
import {
  daysUntil,
  frontierStats,
  pickBenchmark,
  pickEprMilestone,
  pickSelf,
  rankParishes,
} from './derive';
import { DataSources, Highlights, ParishesTable } from './evidence';
import { FrontierChart } from './frontier-chart';
import { GapChart } from './gap-chart';
import { Hero } from './hero';
import { MotionProvider } from './motion';
import { ParishMap } from './parish-map';
import { RegulatoryClock } from './regulatory-clock';
import { EstimateTag, SourceLine, StorySection } from './story-section';

export const HOME_TABS = ['entities', 'flows', 'waste', 'parishes'] as const;
export type HomeTab = (typeof HOME_TABS)[number];

export function HomePage({
  tab,
  onTabChange,
}: {
  tab: HomeTab;
  onTabChange: (tab: HomeTab) => void;
}) {
  const { data: overview } = useSuspenseQuery(getOverviewOptions());
  const { data: baseline } = useSuspenseQuery(getTextileBaselineOptions());
  const { data: flows } = useSuspenseQuery(getObservedFlowsOptions());
  const { data: waste } = useSuspenseQuery(getWasteCompositionOptions());
  const { data: zones } = useSuspenseQuery(listZonesOptions());

  const { gap, references, timeline, parishes, scenario_frontier: frontier } = overview;
  const bench = pickBenchmark(references);
  const self = pickSelf(references);
  const epr = pickEprMilestone(timeline);
  const stats = frontierStats(frontier);
  const ranking = rankParishes(parishes);
  const daysToEpr = epr ? Math.max(0, daysUntil(epr.date)) : null;

  return (
    <MotionProvider>
      <Page className="space-y-8 sm:space-y-10">
        <Hero overview={overview} />

        <StatStrip>
          <StatCell
            label={m.stat_collected()}
            value={formatTonnes(gap.collected_t)}
            hint={m.stat_collected_hint({ count: baseline.entities.length, year: gap.year })}
          />
          <StatCell
            label={m.stat_vs_potential()}
            value={formatPercent(gap.capture_pct)}
            tag={m.common_estimate()}
            tone="primary"
            hint={m.stat_vs_potential_hint({ tonnes: formatTonnes(gap.potential_t, 0) })}
          />
          <StatCell
            label={m.stat_per_inhabitant()}
            value={formatKg(gap.kg_per_inhab_month)}
            hint={m.stat_per_inhabitant_hint()}
          />
          <StatCell
            label={m.stat_to_capture()}
            value={formatTonnes(gap.missing_t, 0)}
            tag={m.common_estimate()}
            tone="primary"
            hint={m.stat_to_capture_hint()}
          />
        </StatStrip>

        <StorySection
          step={2}
          id="problema"
          label={m.home_s2_label()}
          title={
            bench && self
              ? m.home_s2_title({
                  subject: benchmarkSubject(bench),
                  times: formatNumber(bench.kg_per_inhab_year / self.kg_per_inhab_year, 1),
                })
              : m.home_s2_title_fallback()
          }
          description={m.home_s2_description()}
        >
          <div className="space-y-3">
            <GapChart references={references} />
            <SourceLine>{m.home_s2_source()}</SourceLine>
          </div>
        </StorySection>

        <StorySection
          step={3}
          id="lacuna"
          label={m.home_s3_label()}
          title={m.home_s3_title({ n: formatNumber(Math.round(gap.capture_pct)) })}
          description={m.home_s3_description({
            tonnes: formatTonnes(gap.missing_t, 0),
          })}
          aside={<EstimateTag />}
        >
          <div className="space-y-3">
            <Cascade gap={gap} />
            <SourceLine>
              {m.home_s3_source({ rate: formatNumber(gap.potential_kg_per_inhab_month, 1) })}
            </SourceLine>
          </div>
        </StorySection>

        <StorySection
          step={4}
          id="relogio"
          label={m.home_s4_label()}
          title={m.home_s4_title({ days: daysToEpr ?? 0 })}
          description={m.home_s4_description()}
        >
          <div className="space-y-3">
            <RegulatoryClock timeline={timeline} />
            <SourceLine>{m.home_s4_source()}</SourceLine>
          </div>
        </StorySection>

        <StorySection
          step={5}
          id="territorio"
          label={m.home_s5_label()}
          title={m.home_s5_title({
            count: ranking.topCount,
            pct: formatNumber(ranking.topSharePct, 0),
          })}
          description={m.home_s5_description()}
          layout="stack"
        >
          <div className="space-y-3">
            <ParishMap parishes={parishes} zones={zones} />
            <SourceLine>
              {m.home_s5_source({ rate: formatNumber(gap.potential_kg_per_inhab_month, 1) })}
            </SourceLine>
          </div>
        </StorySection>

        <StorySection
          step={6}
          id="decisao"
          label={m.home_s6_label()}
          title={
            stats
              ? m.home_s6_title({
                  pareto: stats.pareto.length,
                  total: stats.total,
                })
              : m.home_s6_title_empty()
          }
          description={
            stats
              ? m.home_s6_description({
                  minT: formatNumber(stats.minTonnes, 0),
                  maxT: formatNumber(stats.maxTonnes, 0),
                  minEur: formatNumber(stats.minEur, 0),
                  maxEur: formatNumber(stats.maxEur, 0),
                })
              : m.home_s6_description_empty()
          }
          aside={<EstimateTag />}
          layout="stack"
        >
          {stats ? (
            <div className="space-y-3">
              <FrontierChart points={frontier} collectedT={gap.collected_t} />
              <FrontierTable points={frontier} />
              <SourceLine>{m.home_s6_source()}</SourceLine>
            </div>
          ) : (
            <EmptyState
              title={m.home_s6_empty_title()}
              description={m.home_s6_empty_description()}
              action={
                <Button asChild>
                  <Link to="/simulator">{m.home_s6_empty_cta()}</Link>
                </Button>
              }
            />
          )}
        </StorySection>

        <StorySection
          step={7}
          id="provas"
          label={m.home_s7_label()}
          title={m.home_s7_title()}
          description={m.home_s7_description()}
          layout="stack"
        >
          <div className="space-y-8">
            <Highlights highlights={overview.highlights} />
            <Section
              title={m.home_sources_title()}
              description={m.home_sources_description()}
              className="[&_h2]:text-xl"
            >
              <DataSources sources={overview.data_sources} />
            </Section>
            <PageTabs
              label={m.rw_tabs_label()}
              value={tab}
              onValueChange={onTabChange}
              tabs={[
                {
                  id: 'entities',
                  label: m.rw_baseline_tab_entities(),
                  count: baseline.entities.length,
                  content: <EntityTable entities={baseline.entities} />,
                },
                {
                  id: 'flows',
                  label: m.section_flows_title(),
                  content: (
                    <Panel className="p-3 sm:p-4">
                      <FlowsSankey flows={flows} className="lg:h-[26rem]" />
                    </Panel>
                  ),
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
                {
                  id: 'parishes',
                  label: m.home_tab_parishes(),
                  count: parishes.length,
                  content: <ParishesTable parishes={parishes} />,
                },
              ]}
            />
          </div>
        </StorySection>

        <StorySection
          id="agir"
          label={m.home_end_label()}
          title={m.home_end_title()}
          description={m.home_end_description()}
          layout="stack"
        >
          <Shortcuts />
        </StorySection>
      </Page>
    </MotionProvider>
  );
}

function FrontierTable({ points }: { points: FrontierPoint[] }) {
  const [open, setOpen] = useState(false);
  const rows = points.filter((p) => p.status === 'feasible');
  const columns: Column<FrontierPoint>[] = [
    {
      id: 'label',
      header: m.home_col_scenario(),
      primary: true,
      value: (p) => p.label,
      cell: (p) => (
        <Link
          to="/scenarios/$scenarioId"
          params={{ scenarioId: p.id }}
          className="font-medium underline-offset-4 hover:underline"
        >
          {p.label}
        </Link>
      ),
    },
    {
      id: 'efficient',
      header: m.home_col_efficient(),
      badge: true,
      value: (p) => (p.is_pareto ? 'yes' : 'no'),
      filter: { format: (v) => (v === 'yes' ? m.home_yes() : m.home_no()) },
      cell: (p) => (p.is_pareto ? m.home_yes() : m.home_no()),
    },
    {
      id: 'tonnes',
      header: m.home_col_tonnes(),
      align: 'right',
      value: (p) => p.tonnes_year,
      cell: (p) => formatTonnes(p.tonnes_year),
    },
    {
      id: 'eur_t',
      header: m.home_col_eur_t(),
      align: 'right',
      value: (p) => p.eur_per_tonne,
      cell: (p) => (p.eur_per_tonne === null ? '—' : `${formatNumber(p.eur_per_tonne, 0)} €/t`),
    },
    {
      id: 'cost',
      header: m.home_col_cost(),
      align: 'right',
      value: (p) => p.annual_cost_eur,
      cell: (p) => formatEur(p.annual_cost_eur),
    },
  ];
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="h-10 gap-1.5 px-2">
          <ChevronDown
            className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
          {m.home_s6_table({ count: rows.length })}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <DataTable
          id="home-frontier"
          columns={columns}
          rows={rows}
          getRowId={(p) => p.id}
          caption={m.home_col_scenario()}
          initialSort={{ id: 'eur_t', desc: false }}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
