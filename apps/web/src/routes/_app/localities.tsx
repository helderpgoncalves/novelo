import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { listLocalitiesOptions } from '@/client/@tanstack/react-query.gen';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { PageTabs } from '@/components/page-tabs';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { FrequencySummary } from '@/features/localities/frequency-summary';
import { LocalitiesTable } from '@/features/localities/localities-table';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/localities')({
  staticData: { skeleton: 'table' },
  validateSearch: z.object({ tab: z.enum(['list', 'frequency']).optional().catch(undefined) }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(listLocalitiesOptions()),
  head: () => ({ meta: [{ title: m.title_localities() }] }),
  component: Localities,
});

function Localities() {
  const { data } = useSuspenseQuery(listLocalitiesOptions());
  const { tab = 'list' } = Route.useSearch();
  const navigate = Route.useNavigate();
  const frequent = data.filter((l) => l.days_per_week >= 3).length;
  const sparse = data.filter((l) => l.days_per_week > 0 && l.days_per_week < 3).length;
  const none = data.filter((l) => l.days_per_week === 0).length;

  return (
    <Page>
      <PageHeader
        eyebrow={m.localities_eyebrow()}
        title={m.localities_title()}
        description={m.rw_localities_description()}
      />
      <StatStrip>
        <StatCell
          label={m.localities_stat_total()}
          value={formatNumber(data.length)}
          hint={m.localities_stat_total_hint()}
        />
        <StatCell
          label={m.localities_stat_frequent()}
          value={formatNumber(frequent)}
          hint={m.localities_stat_frequent_hint()}
          tone="primary"
        />
        <StatCell
          label={m.localities_stat_sparse()}
          value={formatNumber(sparse)}
          hint={m.localities_stat_sparse_hint()}
        />
        <StatCell
          label={m.localities_stat_none()}
          value={formatNumber(none)}
          hint={m.localities_stat_none_hint()}
        />
      </StatStrip>
      <PageTabs
        label={m.rw_tabs_label()}
        value={tab}
        onValueChange={(next) => void navigate({ search: { tab: next }, replace: true })}
        tabs={[
          {
            id: 'list',
            label: m.rw_localities_tab_list(),
            count: data.length,
            content: <LocalitiesTable localities={data} />,
          },
          {
            id: 'frequency',
            label: m.rw_localities_tab_frequency(),
            content: <FrequencySummary localities={data} />,
          },
        ]}
      />
    </Page>
  );
}
