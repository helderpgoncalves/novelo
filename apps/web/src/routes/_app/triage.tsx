import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { listLotsOptions, listZonesOptions } from '@/client/@tanstack/react-query.gen';
import { PageHeader } from '@/components/page-header';
import { TriageFlow } from '@/features/triage/triage-flow';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/triage')({
  validateSearch: z.object({ lot: z.string().max(16).optional().catch(undefined) }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(listZonesOptions()),
      queryClient.ensureQueryData(listLotsOptions({ query: { state: 'collected' } })),
    ]),
  head: () => ({ meta: [{ title: m.title_triage() }] }),
  component: Triage,
});

function Triage() {
  const { lot } = Route.useSearch();
  const { data: zones } = useSuspenseQuery(listZonesOptions());
  const { data: openLots } = useSuspenseQuery(listLotsOptions({ query: { state: 'collected' } }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={m.triage_eyebrow()}
        title={m.triage_title()}
        description={m.triage_description()}
      />
      <TriageFlow zones={zones} openLots={openLots} initialLot={lot} />
    </div>
  );
}
