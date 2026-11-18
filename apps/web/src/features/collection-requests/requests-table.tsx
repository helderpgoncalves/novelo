import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CalendarCheck2, CalendarX2, MapPinCheckInside, PackageCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { CollectionRequestOut } from '@/client';
import {
  cancelCollectionRequestMutation,
  listCollectionRequestsOptions,
  recordRequestOutcomeMutation,
} from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable, type RowAction } from '@/components/data-table';
import { DispatchDialog } from '@/features/collection-requests/dispatch-dialog';
import {
  exceptionReasonLabel,
  RequestStateBadge,
  requestPlaceLabel,
  requestStateLabel,
  requestSubjectLabel,
} from '@/features/collection-requests/request-parts';
import { getErrorCode } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';

type DispatchAction = 'schedule' | 'reject';

/** A mesa do pedido de recolha: todos os pedidos (ou só a fila de exceções) com as ações do gestor.
 * Os quatro estados do ecrã (a carregar, vazio, erro, sucesso) vivem no DataTable. */
export function RequestsTable({ queueOnly = false, id }: { queueOnly?: boolean; id: string }) {
  const query = useQuery(listCollectionRequestsOptions());
  const rows = useMemo(() => {
    const all = query.data ?? [];
    return queueOnly ? all.filter((r) => r.state === 'exception') : all;
  }, [query.data, queueOnly]);
  const queryClient = useQueryClient();
  const [dispatching, setDispatching] = useState<{
    id: string;
    action: DispatchAction;
    date: string;
  } | null>(null);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: listCollectionRequestsOptions().queryKey });

  const outcome = useMutation({
    ...recordRequestOutcomeMutation(),
    onSuccess: (_data, variables) => {
      invalidate();
      toast(
        variables.body.outcome === 'collected'
          ? m.collection_requests_toast_collected()
          : m.collection_requests_toast_missed(),
      );
    },
    onError: (error) =>
      toast(`${m.collection_requests_toast_outcome_failed()} ${getErrorCode(error) ?? ''}`),
  });
  const cancel = useMutation({
    ...cancelCollectionRequestMutation(),
    onSuccess: () => {
      invalidate();
      toast(m.collection_requests_toast_cancelled());
    },
    onError: (error) =>
      toast(`${m.collection_requests_toast_cancel_failed()} ${getErrorCode(error) ?? ''}`),
  });

  const columns = useMemo<Column<CollectionRequestOut>[]>(
    () => [
      {
        id: 'date',
        header: m.collection_requests_col_date(),
        cell: (row) => <span className="font-medium tabular-nums">{row.requested_date}</span>,
        value: (row) => row.requested_date,
        sortable: true,
        type: 'date',
      },
      {
        id: 'place',
        header: m.collection_requests_col_place(),
        cell: (row) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{requestPlaceLabel(row)}</span>
            {row.urgent && (
              <span className="text-destructive text-xs font-medium">
                {m.collection_requests_urgent()}
              </span>
            )}
          </span>
        ),
        value: (row) => requestPlaceLabel(row),
        searchable: true,
        primary: true,
      },
      {
        id: 'subject',
        header: m.collection_requests_col_subject(),
        cell: (row) => <span className="text-sm">{requestSubjectLabel(row.subject_kind)}</span>,
        value: (row) => requestSubjectLabel(row.subject_kind),
        filter: true,
      },
      {
        id: 'bags',
        header: m.collection_requests_col_bags(),
        cell: (row) => (
          <span className="tabular-nums">
            {formatNumber(row.bag_count)}
            {row.bag_count > 20 && (
              <span className="text-muted-foreground"> · {m.collection_requests_special()}</span>
            )}
          </span>
        ),
        value: (row) => row.bag_count,
        type: 'number',
        sortable: true,
        filter: 'range',
      },
      {
        id: 'state',
        header: m.collection_requests_col_state(),
        cell: (row) => (
          <span className="flex min-w-0 flex-col items-start gap-1">
            <RequestStateBadge state={row.state} />
            {row.state === 'exception' && row.exception_reason && (
              <span className="text-muted-foreground text-xs">
                {exceptionReasonLabel(row.exception_reason)}
              </span>
            )}
            {row.missed_count > 0 && row.state !== 'expired' && (
              <span className="text-muted-foreground text-xs">
                {m.collection_requests_missed_count({ count: row.missed_count })}
              </span>
            )}
          </span>
        ),
        value: (row) => requestStateLabel(row.state),
        filter: true,
        badge: true,
      },
      {
        id: 'requester',
        header: m.collection_requests_col_requester(),
        cell: (row) => (
          <span className="text-muted-foreground text-sm">{row.requester_email ?? '—'}</span>
        ),
        value: (row) => row.requester_email ?? '',
        searchable: true,
        defaultHidden: true,
      },
    ],
    [],
  );

  const rowActions = (row: CollectionRequestOut): RowAction<CollectionRequestOut>[] => {
    const actions: RowAction<CollectionRequestOut>[] = [];
    if (row.state === 'exception') {
      actions.push(
        {
          id: 'schedule',
          label: m.collection_requests_action_schedule(),
          icon: <CalendarCheck2 />,
          onSelect: (r) => setDispatching({ id: r.id, action: 'schedule', date: r.requested_date }),
        },
        {
          id: 'reject',
          label: m.collection_requests_action_reject(),
          icon: <CalendarX2 />,
          onSelect: (r) => setDispatching({ id: r.id, action: 'reject', date: r.requested_date }),
        },
      );
    }
    if (row.state === 'scheduled') {
      actions.push(
        {
          id: 'collected',
          label: m.collection_requests_action_collected(),
          icon: <PackageCheck />,
          onSelect: (r) =>
            outcome.mutate({ path: { request_id: r.id }, body: { outcome: 'collected' } }),
        },
        {
          id: 'missed',
          label: m.collection_requests_action_missed(),
          icon: <MapPinCheckInside />,
          onSelect: (r) =>
            outcome.mutate({ path: { request_id: r.id }, body: { outcome: 'missed' } }),
        },
      );
    }
    if (row.state === 'scheduled' || row.state === 'exception') {
      actions.push({
        id: 'cancel',
        label: m.collection_requests_action_cancel(),
        icon: <Ban />,
        destructive: true,
        onSelect: (r) => cancel.mutate({ path: { request_id: r.id } }),
      });
    }
    return actions;
  };

  const dispatched = dispatching;
  return (
    <>
      <DataTable
        id={id}
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        rowActions={rowActions}
        loading={query.isPending}
        refreshing={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        empty={queueOnly ? m.collection_requests_empty_queue() : m.collection_requests_empty()}
      />
      {dispatched && (
        <DispatchDialog
          requestId={dispatched.id}
          action={dispatched.action}
          currentDate={dispatched.date}
          open
          onOpenChange={(open) => {
            if (!open) setDispatching(null);
          }}
        />
      )}
    </>
  );
}
