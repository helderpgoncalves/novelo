import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { listCircuitsOptions } from '@/client/@tanstack/react-query.gen';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { PageTabs } from '@/components/page-tabs';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { EmptyState } from '@/components/states';
import { CircuitsTable } from '@/features/circuits/circuits-table';
import { TypologySummary } from '@/features/circuits/typology-summary';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/circuits')({
  staticData: { skeleton: 'table' },
  validateSearch: z.object({ tab: z.enum(['list', 'typology']).optional().catch(undefined) }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(listCircuitsOptions()),
  head: () => ({ meta: [{ title: m.title_circuits() }] }),
  component: Circuits,
});

function Circuits() {
  const { data } = useSuspenseQuery(listCircuitsOptions());
  const { tab = 'list' } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <Page>
      <PageHeader
        eyebrow={m.circuits_eyebrow()}
        title={m.circuits_title()}
        description={m.rw_circuits_description()}
      />
      <StatStrip>
        <StatCell
          label={m.circuits_stat_circuits()}
          value={formatNumber(data.total)}
          hint={m.circuits_stat_circuits_hint({ count: data.without_vehicle })}
        />
        <StatCell
          label={m.circuits_stat_vehicles()}
          value={formatNumber(data.vehicles)}
          hint={m.circuits_stat_vehicles_hint({ count: data.vehicles_never_assigned.length })}
        />
        <StatCell
          label={m.circuits_stat_localities()}
          value={formatNumber(data.localities)}
          hint={m.circuits_stat_localities_hint()}
        />
        <StatCell
          label={m.circuits_stat_notes()}
          value={formatNumber(data.circuits.filter((c) => c.note).length)}
          hint={m.circuits_stat_notes_hint()}
        />
      </StatStrip>
      {data.circuits.length === 0 ? (
        <EmptyState title={m.circuits_empty_title()} description={m.circuits_empty_text()} />
      ) : (
        <PageTabs
          label={m.rw_tabs_label()}
          value={tab}
          onValueChange={(next) => void navigate({ search: { tab: next }, replace: true })}
          tabs={[
            {
              id: 'list',
              label: m.rw_circuits_tab_list(),
              count: data.circuits.length,
              content: <CircuitsTable circuits={data.circuits} />,
            },
            {
              id: 'typology',
              label: m.rw_circuits_tab_typology(),
              content: <TypologySummary circuits={data.circuits} />,
            },
          ]}
        />
      )}
    </Page>
  );
}
