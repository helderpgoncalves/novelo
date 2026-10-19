import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ScanLine } from 'lucide-react';
import { useState } from 'react';
import type { LotState } from '@/client';
import { listLotsOptions } from '@/client/@tanstack/react-query.gen';
import { FilterChips } from '@/components/data-table-toolbar';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

const STATES: LotState[] = ['collected', 'sorted', 'reserved', 'delivered'];

function Lots() {
  const { data } = useSuspenseQuery(listLotsOptions());
  const [state, setState] = useState<LotState | null>(null);
  const rows = data.filter((l) => !state || l.state === state);

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
        <div className="space-y-3">
          <FilterChips<LotState>
            legend={m.lots_filter_state()}
            value={state}
            onChange={setState}
            options={[
              { value: null, label: m.common_all() },
              ...STATES.map((s) => ({ value: s, label: lotStateLabel[s]() })),
            ]}
          />
          <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 px-4">{m.lots_col_code()}</TableHead>
                  <TableHead className="h-10">{m.lots_col_state()}</TableHead>
                  <TableHead className="h-10">{m.lots_col_parish()}</TableHead>
                  <TableHead className="h-10">{m.lots_col_fibre()}</TableHead>
                  <TableHead className="h-10 text-right">{m.lots_col_items()}</TableHead>
                  <TableHead className="h-10 text-right">{m.lots_col_weight()}</TableHead>
                  <TableHead className="h-10 pr-4">{m.lots_col_opened()}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l) => (
                  <TableRow key={l.code}>
                    <TableCell className="px-4 font-medium tabular-nums">
                      <Link to="/lots/$code" params={{ code: l.code }} className="hover:underline">
                        {l.code}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <LotStateBadge state={l.state} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.parish_name ?? m.common_dash()}
                    </TableCell>
                    <TableCell>{fibreLabel[l.dominant_fibre]()}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.items}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(l.weight_kg, 2)} kg
                    </TableCell>
                    <TableCell className="pr-4 text-muted-foreground tabular-nums">
                      {formatDateTime(l.opened_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
