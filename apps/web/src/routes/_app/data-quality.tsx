import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { getDataQualityOptions } from '@/client/@tanstack/react-query.gen';
import { Page, Section } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { PageTabs } from '@/components/page-tabs';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { ErrorState, PageSkeleton } from '@/components/states';
import { AlertsPanel } from '@/features/quality/alerts-panel';
import { SourcesTable } from '@/features/quality/sources-table';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/data-quality')({
  staticData: { skeleton: 'table' },
  validateSearch: z.object({
    tab: z.enum(['alerts', 'sources']).optional().catch(undefined),
    /** Origem dos alertas: rede de têxteis ou contentores municipais. */
    origin: z.enum(['textile', 'municipal']).optional().catch(undefined),
  }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(getDataQualityOptions()),
  head: () => ({ meta: [{ title: m.title_data_quality() }] }),
  component: DataQuality,
});

function DataQuality() {
  const { tab = 'alerts', origin } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data, isPending, error, refetch } = useQuery(getDataQualityOptions());

  if (isPending) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const count = (s: string) => data.alerts.filter((a) => a.status === s).length;

  return (
    <Page>
      <PageHeader
        eyebrow={m.quality_eyebrow()}
        title={m.quality_title()}
        description={m.quality_description()}
      />
      <StatStrip>
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
          value={formatNumber(count('resolved'))}
          hint={m.quality_stat_resolved_hint()}
        />
        <StatCell
          label={m.quality_stat_wont_fix()}
          value={formatNumber(count('wont_fix'))}
          hint={m.quality_stat_wont_fix_hint()}
        />
      </StatStrip>
      <PageTabs
        label={m.rw_tabs_label()}
        value={tab}
        onValueChange={(next) =>
          void navigate({
            search: (prev) => ({ ...prev, tab: next === 'sources' ? 'sources' : undefined }),
            replace: true,
          })
        }
        tabs={[
          {
            id: 'alerts',
            label: m.quality_tab_alerts(),
            count: data.alerts.length,
            status: data.open_alerts > 0 ? 'attention' : undefined,
            statusLabel: `${formatNumber(data.open_alerts)} ${m.quality_stat_open()}`,
            content: (
              <Section
                title={m.quality_alerts_title()}
                description={m.quality_alerts_description()}
              >
                <AlertsPanel
                  alerts={data.alerts}
                  origin={origin}
                  onOriginChange={(next) =>
                    void navigate({ search: (prev) => ({ ...prev, origin: next }), replace: true })
                  }
                />
              </Section>
            ),
          },
          {
            id: 'sources',
            label: m.quality_tab_sources(),
            count: data.sources.length,
            content: (
              <Section
                title={m.quality_sources_title()}
                description={m.quality_sources_description()}
              >
                <SourcesTable sources={data.sources} />
              </Section>
            ),
          },
        ]}
      />
    </Page>
  );
}
