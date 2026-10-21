import { useSuspenseQuery } from '@tanstack/react-query';
import { lazy } from 'react';
import type { Overview } from '@/client';
import {
  getObservedFlowsOptions,
  getTextileBaselineOptions,
  getWasteCompositionOptions,
} from '@/client/@tanstack/react-query.gen';
import { AsyncBoundary } from '@/components/async-boundary';
import { Panel, Section } from '@/components/page';
import { PageTabs } from '@/components/page-tabs';
import { ChartSkeleton, DataTableSkeleton } from '@/components/skeletons';
import { EntityTable } from '@/features/baseline/entity-table';
import { WasteCompositionChart } from '@/features/baseline/waste-composition';
import { m } from '@/paraglide/messages';
import { DataSources, Highlights, ParishesTable } from './evidence';
import { num } from './safe';
import type { HomeTab } from './tabs';
import { SourceLine } from './tags';

// O gráfico de fluxos usa o echarts: só se descarrega quando o separador «Fluxos» é aberto.
const FlowsSankey = lazy(() =>
  import('@/features/baseline/flows-sankey').then((mod) => ({ default: mod.FlowsSankey })),
);

function Entities() {
  const { data } = useSuspenseQuery(getTextileBaselineOptions());
  return <EntityTable entities={data.entities} />;
}

function Flows() {
  const { data } = useSuspenseQuery(getObservedFlowsOptions());
  return (
    <Panel className="p-3 sm:p-4">
      <FlowsSankey flows={data} className="lg:h-[26rem]" />
    </Panel>
  );
}

function Waste() {
  const { data } = useSuspenseQuery(getWasteCompositionOptions());
  return (
    <Section
      title={m.section_waste_title()}
      description={m.section_waste_description({ kg: num(data.kg_per_inhab_year_pt) })}
    >
      <Panel>
        <WasteCompositionChart waste={data} />
      </Panel>
    </Section>
  );
}

interface EvidenceTabsProps {
  overview: Overview;
  tab: HomeTab;
  onTabChange: (tab: HomeTab) => void;
}

/** A evidência por baixo da dobra: manchetes com fonte, origem dos dados e quatro tabelas/gráficos, cada um com o seu pedido. */
export function EvidenceTabs({ overview, tab, onTabChange }: EvidenceTabsProps) {
  return (
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
            content: (
              <AsyncBoundary fallback={<DataTableSkeleton rows={4} columns={5} />}>
                <Entities />
              </AsyncBoundary>
            ),
          },
          {
            id: 'flows',
            label: m.section_flows_title(),
            content: (
              <AsyncBoundary fallback={<ChartSkeleton className="h-[26rem]" />}>
                <Flows />
              </AsyncBoundary>
            ),
          },
          {
            id: 'waste',
            label: m.rw_baseline_tab_waste(),
            content: (
              <AsyncBoundary fallback={<ChartSkeleton />}>
                <Waste />
              </AsyncBoundary>
            ),
          },
          {
            id: 'parishes',
            label: m.home_tab_parishes(),
            count: overview.parishes.length,
            content: (
              <div className="space-y-3">
                <ParishesTable parishes={overview.parishes} />
                <SourceLine>
                  {m.home_s5_source({
                    rate: num(overview.gap.missing_kg_per_inhab_month, 3),
                  })}
                </SourceLine>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
