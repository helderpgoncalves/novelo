import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ScanLine } from 'lucide-react';
import type { Fibre, LotState, LotSummary } from '@/client';
import { listLotsOptions } from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { LotStateBadge } from '@/features/lots/lot-parts';
import { formatNumber } from '@/lib/format';
import { formatDateTime } from '@/lib/i18n';
import { fibreLabel, lotStateLabel } from '@/lib/lots';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/lots/')({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(listLotsOptions()),
  head: () => ({ meta: [{ title: m.title_lots() }] }),
  component: Lots,
});

function Lots() {
  const { data } = useSuspenseQuery(listLotsOptions());

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={m.lots_eyebrow()}
        title={m.lots_title()}
        description={m.lots_description()}
        actions={
          <Button asChild className="h-10 gap-2 font-semibold">
            <Link to="/triage">
              <ScanLine /> {m.lots_start_triage()}
            </Link>
          </Button>
        }
      />
      {data.length === 0 ? (
        <EmptyState
          title={m.lots_empty_title()}
          description={m.lots_empty_text()}
          action={
            <Button asChild>
              <Link to="/triage">{m.lots_start_triage()}</Link>
            </Button>
          }
        />
      ) : (
        <DataTable
          id="lots"
          columns={columns}
          rows={data}
          getKey={(l) => l.code}
          caption={m.lots_title()}
          searchLabel={m.lots_search()}
        />
      )}
    </div>
  );
}

const columns: Column<LotSummary>[] = [
  {
    id: 'code',
    header: m.lots_col_code(),
    primary: true,
    className: 'tabular-nums',
    value: (l) => l.code,
    cell: (l) => (
      <Link to="/lots/$code" params={{ code: l.code }} className="hover:underline">
        {l.code}
      </Link>
    ),
  },
  {
    id: 'state',
    header: m.lots_col_state(),
    badge: true,
    value: (l) => l.state,
    filter: { format: (v) => lotStateLabel[v as LotState]() },
    cell: (l) => <LotStateBadge state={l.state} />,
  },
  {
    id: 'parish',
    header: m.lots_col_parish(),
    className: 'text-muted-foreground',
    value: (l) => l.parish_name,
    filter: true,
    cell: (l) => l.parish_name ?? m.common_dash(),
  },
  {
    id: 'fibre',
    header: m.lots_col_fibre(),
    value: (l) => l.dominant_fibre,
    filter: { format: (v) => fibreLabel[v as Fibre]() },
    cell: (l) => fibreLabel[l.dominant_fibre](),
  },
  {
    id: 'items',
    header: m.lots_col_items(),
    align: 'right',
    value: (l) => l.items,
    searchable: false,
    cell: (l) => l.items,
  },
  {
    id: 'weight',
    header: m.lots_col_weight(),
    align: 'right',
    value: (l) => l.weight_kg,
    searchable: false,
    cell: (l) => `${formatNumber(l.weight_kg, 2)} kg`,
  },
  {
    id: 'opened',
    header: m.lots_col_opened(),
    className: 'text-muted-foreground',
    value: (l) => l.opened_at,
    searchable: false,
    cell: (l) => formatDateTime(l.opened_at),
  },
];
