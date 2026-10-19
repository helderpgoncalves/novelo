import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import type { AlertStatus } from '@/client';
import { getDataQualityOptions } from '@/client/@tanstack/react-query.gen';
import { FilterChips } from '@/components/filter-chips';
import { Page, SectionTitle } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { AlertCard } from '@/features/quality/alert-card';
import { SourcesTable } from '@/features/quality/sources-table';
import { formatNumber } from '@/lib/format';
import { alertStatusLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/data-quality')({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(getDataQualityOptions()),
  head: () => ({ meta: [{ title: m.title_data_quality() }] }),
  component: DataQuality,
});

function DataQuality() {
  const { data } = useSuspenseQuery(getDataQualityOptions());
  const [status, setStatus] = useState<AlertStatus | null>('open');
  const alerts = data.alerts.filter((a) => !status || a.status === status);
  const resolved = data.alerts.length - data.open_alerts;

  return (
    <Page>
      <PageHeader
        eyebrow={m.quality_eyebrow()}
        title={m.quality_title()}
        description={m.quality_description()}
      />
      <StatStrip className="lg:grid-cols-3">
        <StatCell
          label={m.quality_stat_sources()}
          value={formatNumber(data.sources.length)}
          hint={m.quality_stat_sources_hint()}
        />
        <StatCell
          label={m.quality_stat_open()}
          value={formatNumber(data.open_alerts)}
          hint={m.quality_stat_open_hint()}
          tone="primary"
        />
        <StatCell
          label={m.quality_stat_resolved()}
          value={formatNumber(resolved)}
          hint={m.quality_stat_resolved_hint()}
        />
      </StatStrip>
      <section className="space-y-4">
        <SectionTitle>{m.quality_sources_title()}</SectionTitle>
        <SourcesTable sources={data.sources} />
      </section>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>{m.quality_alerts_title()}</SectionTitle>
          <FilterChips<AlertStatus>
            legend={m.quality_filter_status()}
            value={status}
            onChange={setStatus}
            options={[
              { value: null, label: m.common_all() },
              ...(['open', 'resolved', 'wont_fix'] as const).map((s) => ({
                value: s,
                label: alertStatusLabel[s](),
              })),
            ]}
          />
        </div>
        <ul className="grid gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border md:grid-cols-2">
          {alerts.map((a) => (
            <AlertCard key={a.id} alert={a} />
          ))}
        </ul>
      </section>
    </Page>
  );
}
