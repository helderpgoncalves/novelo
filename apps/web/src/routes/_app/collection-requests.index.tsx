import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import type { CollectionRequestState } from '@/client';
import { listCollectionRequestsOptions } from '@/client/@tanstack/react-query.gen';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { PageTabs } from '@/components/page-tabs';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { RequestsTable } from '@/features/collection-requests/requests-table';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';

const REQUEST_TABS = ['pedidos', 'excecoes'] as const;
type RequestTab = (typeof REQUEST_TABS)[number];

export const Route = createFileRoute('/_app/collection-requests/')({
  staticData: { skeleton: 'table' },
  validateSearch: z.object({ tab: z.enum(REQUEST_TABS).optional().catch(undefined) }),
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(listCollectionRequestsOptions()),
  head: () => ({ meta: [{ title: m.title_collection_requests() }] }),
  component: CollectionRequests,
});

function CollectionRequests() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const active: RequestTab = tab ?? 'pedidos';
  const { data: requests } = useSuspenseQuery(listCollectionRequestsOptions());
  const inQueue = requests.filter(
    (r) => r.state === ('exception' satisfies CollectionRequestState),
  ).length;
  const scheduled = requests.filter((r) => r.state === 'scheduled').length;
  const closed = requests.filter((r) =>
    ['collected', 'expired', 'rejected', 'cancelled'].includes(r.state),
  ).length;

  return (
    <Page>
      <PageHeader
        eyebrow={m.collection_requests_eyebrow()}
        title={m.title_collection_requests()}
        description={m.collection_requests_description()}
      />
      <StatStrip>
        <StatCell
          label={m.collection_requests_stat_queue()}
          value={formatNumber(inQueue)}
          tone={inQueue > 0 ? 'primary' : 'default'}
        />
        <StatCell label={m.collection_requests_stat_scheduled()} value={formatNumber(scheduled)} />
        <StatCell label={m.collection_requests_stat_closed()} value={formatNumber(closed)} />
      </StatStrip>
      <PageTabs<RequestTab>
        label={m.collection_requests_tabs_label()}
        value={active}
        onValueChange={(next) =>
          void navigate({ search: { tab: next === 'pedidos' ? undefined : next }, replace: true })
        }
        tabs={[
          {
            id: 'pedidos',
            label: m.collection_requests_tab_requests(),
            content: <RequestsTable id="collection-requests-all" />,
          },
          {
            id: 'excecoes',
            label: m.collection_requests_tab_queue(),
            count: inQueue,
            status: inQueue > 0 ? 'attention' : undefined,
            statusLabel:
              inQueue > 0 ? m.collection_requests_queue_attention({ count: inQueue }) : undefined,
            content: <RequestsTable queueOnly id="collection-requests-queue" />,
          },
        ]}
      />
    </Page>
  );
}
