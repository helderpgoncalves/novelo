import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { ActionOut } from '@/client';
import {
  listCopilotActionsInfiniteOptions,
  undoCopilotActionMutation,
} from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { EmptyState, ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime, getLocale } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { actionStatusLabel, riskLabel } from './action-card';
import { invalidateCopilot } from './cache';

function UndoButton({ action }: { action: ActionOut }) {
  const qc = useQueryClient();
  const undo = useMutation({
    ...undoCopilotActionMutation(),
    onSuccess: () => {
      toast.success(m.chat_action_undone());
      void invalidateCopilot(qc);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-10 gap-1.5 sm:h-8"
      loading={undo.isPending}
      onClick={() => undo.mutate({ path: { action_id: action.id } })}
    >
      {!undo.isPending && <Undo2 className="size-3.5" aria-hidden="true" />}
      {m.chat_action_undo()}
    </Button>
  );
}

/** Histórico de ações do copiloto: quem, o quê, quando e com que resultado, com Desfazer quando for reversível. */
export function ActionsTab({
  isAdmin,
  onOpenThread,
}: {
  isAdmin: boolean;
  onOpenThread: (id: string) => void;
}) {
  const [all, setAll] = useState(false);
  const actions = useInfiniteQuery({
    ...listCopilotActionsInfiniteOptions({
      query: { scope: all ? 'all' : 'mine', limit: 30, locale: getLocale() },
    }),
    // Um objeto vazio (não `null`): o cliente gerado trata `null` como um objeto de parâmetros.
    initialPageParam: {},
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const rows = actions.data?.pages.flatMap((p) => p.items) ?? [];

  const columns: Column<ActionOut>[] = [
    {
      id: 'summary',
      header: m.chat_col_action(),
      cell: (r) => (
        <span className="block max-w-xl space-y-0.5">
          <span className="block font-medium">{r.summary}</span>
          {r.impact && (
            <span className="line-clamp-2 block text-muted-foreground text-xs">{r.impact}</span>
          )}
        </span>
      ),
      value: (r) => `${r.summary} ${r.impact}`,
      primary: true,
      hideable: false,
    },
    {
      id: 'status',
      header: m.chat_col_status(),
      cell: (r) => <Badge variant="secondary">{actionStatusLabel[r.status]()}</Badge>,
      value: (r) => r.status,
      filter: { format: (v) => actionStatusLabel[v as ActionOut['status']]?.() ?? v },
      badge: true,
    },
    {
      id: 'risk',
      header: m.chat_col_risk(),
      cell: (r) => riskLabel[r.risk](),
      value: (r) => r.risk,
      filter: { format: (v) => riskLabel[v as ActionOut['risk']]?.() ?? v },
    },
    {
      id: 'user',
      header: m.chat_col_user(),
      cell: (r) => r.user_email ?? m.common_dash(),
      value: (r) => r.user_email,
      filter: true,
      defaultHidden: !all,
      desktopOnly: true,
    },
    {
      id: 'when',
      header: m.chat_col_when(),
      cell: (r) => formatDateTime(r.created_at),
      value: (r) => r.created_at,
    },
    {
      id: 'do',
      header: m.chat_col_open(),
      label: m.chat_col_open(),
      sortable: false,
      full: true,
      cell: (r) => (
        <span className="flex flex-wrap gap-2">
          {r.status === 'executed' && r.can_undo && !all && <UndoButton action={r} />}
          {r.thread_id && (
            <Button
              variant="ghost"
              size="sm"
              className="h-10 gap-1.5 sm:h-8"
              onClick={() => onOpenThread(r.thread_id as string)}
            >
              <MessageSquare className="size-3.5" aria-hidden="true" />
              {m.chat_open_conversation()}
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4" data-testid="copilot-actions">
      {isAdmin && (
        <div className="flex min-h-11 items-center gap-2 text-sm">
          <Switch id="actions-all" checked={all} onCheckedChange={setAll} />
          <label htmlFor="actions-all">{m.chat_actions_all()}</label>
        </div>
      )}
      {actions.isPending ? (
        <p role="status" className="py-10 text-center text-muted-foreground text-sm">
          {m.chat_loading_actions()}
        </p>
      ) : actions.error ? (
        <ErrorState error={actions.error} onRetry={() => void actions.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={m.chat_actions_empty()} description={m.chat_actions_empty_hint()} />
      ) : (
        <>
          <DataTable
            id={`copilot-actions-${all ? 'all' : 'mine'}`}
            columns={columns}
            rows={rows}
            getKey={(r) => r.id}
            controls="always"
            pageSize={15}
            initialSort={{ id: 'when', desc: true }}
          />
          {actions.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                className="h-11"
                loading={actions.isFetchingNextPage}
                onClick={() => void actions.fetchNextPage()}
              >
                {m.chat_load_more()}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
