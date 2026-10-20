import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Ban, MailPlus, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { InvitationOut } from '@/client';
import {
  listInvitationsOptions,
  resendInvitationMutation,
  revokeInvitationMutation,
} from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { EmptyState } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { invalidateAdminQueries } from './cache';
import { InviteDialog } from './invite-dialog';
import { canResend, canRevoke, undelivered } from './logic';
import { roleLabel } from './role-picker';

const PAGE = 200;

const statusLabel = (s: InvitationOut['status']): string =>
  s === 'pending'
    ? m.invite_status_pending()
    : s === 'accepted'
      ? m.invite_status_accepted()
      : s === 'expired'
        ? m.invite_status_expired()
        : m.invite_status_revoked();

function StatusBadge({ status }: { status: InvitationOut['status'] }) {
  return (
    <Badge
      variant={status === 'accepted' ? 'default' : status === 'pending' ? 'secondary' : 'outline'}
      className={status === 'revoked' ? 'line-through' : undefined}
    >
      {statusLabel(status)}
    </Badge>
  );
}

/** Convites enviados: criar, reenviar (novo link) e revogar, com aviso quando o email não saiu. */
export function InvitationsPanel() {
  const queryClient = useQueryClient();
  const [inviting, setInviting] = useState(false);
  const [revoking, setRevoking] = useState<InvitationOut | null>(null);
  const list = useQuery(listInvitationsOptions({ query: { limit: PAGE } }));
  const rows = list.data?.items ?? [];
  const problems = undelivered(rows);

  const resend = useMutation({
    ...resendInvitationMutation(),
    onSuccess: async (inv) => {
      await invalidateAdminQueries(queryClient);
      if (inv.email_delivered) toast.success(m.invite_resent({ email: inv.email }));
      else toast.warning(m.invite_not_delivered_toast());
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const revoke = useMutation({
    ...revokeInvitationMutation(),
    onSuccess: async () => {
      await invalidateAdminQueries(queryClient);
      toast.success(m.invite_revoked());
      setRevoking(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const columns: Column<InvitationOut>[] = [
    {
      id: 'email',
      header: m.invite_col_email(),
      primary: true,
      label: m.invite_col_email(),
      value: (i) => `${i.name ?? ''} ${i.email}`,
      exportValue: (i) => i.email,
      cell: (i) => (
        <div className="min-w-0">
          <p className="break-words font-medium">{i.name ?? i.email}</p>
          {i.name && (
            <p className="break-words font-normal text-muted-foreground text-xs">{i.email}</p>
          )}
        </div>
      ),
    },
    {
      id: 'role',
      header: m.invite_col_role(),
      value: (i) => i.role,
      filter: { format: (v) => roleLabel(v as InvitationOut['role']) },
      cell: (i) => (
        <Badge variant={i.role === 'admin' ? 'default' : 'secondary'}>{roleLabel(i.role)}</Badge>
      ),
    },
    {
      id: 'status',
      header: m.invite_col_status(),
      badge: true,
      value: (i) => i.status,
      exportValue: (i) => statusLabel(i.status),
      filter: { format: (v) => statusLabel(v as InvitationOut['status']) },
      cell: (i) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={i.status} />
          {i.status === 'pending' && !i.email_delivered && (
            <Badge variant="outline" className="border-destructive/50 text-destructive">
              <AlertTriangle aria-hidden="true" />
              {m.invite_not_delivered()}
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: 'by',
      header: m.invite_col_by(),
      value: (i) => i.invited_by_name ?? '',
      className: 'text-muted-foreground',
      filter: { format: (v) => v || m.common_dash() },
      cell: (i) => i.invited_by_name ?? m.common_dash(),
    },
    {
      id: 'sent',
      type: 'datetime',
      header: m.invite_col_sent(),
      className: 'text-muted-foreground',
      value: (i) => i.last_sent_at,
      searchable: false,
      cell: (i) => (
        <span>
          {i.last_sent_at ? formatDateTime(i.last_sent_at) : m.common_never()}
          <span className="block text-xs">{m.invite_sends({ count: i.send_count })}</span>
        </span>
      ),
    },
    {
      id: 'expires',
      type: 'datetime',
      header: m.invite_col_expires(),
      className: 'text-muted-foreground',
      value: (i) => i.expires_at,
      searchable: false,
      cell: (i) => formatDateTime(i.expires_at),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-muted-foreground text-sm leading-relaxed">
          {m.invite_description()}
        </p>
        <Button className="h-10 w-full font-semibold sm:w-auto" onClick={() => setInviting(true)}>
          <MailPlus aria-hidden="true" />
          {m.invite_button()}
        </Button>
      </div>
      {problems.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>{m.invite_warn_title({ count: problems.length })}</AlertTitle>
          <AlertDescription>{m.invite_warn_text()}</AlertDescription>
        </Alert>
      )}
      <DataTable
        id="invitations"
        exportName="convites"
        columns={columns}
        rows={rows}
        getRowId={(i) => i.id}
        caption={m.users_tab_invitations()}
        searchLabel={m.users_search()}
        loading={list.isPending}
        refreshing={list.isFetching && !list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        initialSort={{ id: 'sent', desc: true }}
        empty={<EmptyState title={m.invite_empty_title()} description={m.invite_empty_text()} />}
        rowActions={(i) => {
          const actions = [];
          if (canResend(i)) {
            actions.push({
              id: 'resend',
              label: m.invite_action_resend(),
              icon: <RotateCw />,
              onSelect: () => resend.mutate({ path: { invitation_id: i.id } }),
            });
          }
          if (canRevoke(i)) {
            actions.push({
              id: 'revoke',
              label: m.invite_action_revoke(),
              icon: <Ban />,
              destructive: true,
              onSelect: () => setRevoking(i),
            });
          }
          return actions;
        }}
      />
      {list.data && list.data.total > rows.length && (
        <p className="text-muted-foreground text-xs">
          {m.invite_truncated({ shown: rows.length, total: list.data.total })}
        </p>
      )}
      <InviteDialog open={inviting} onOpenChange={setInviting} />
      <AlertDialog open={revoking !== null} onOpenChange={(o) => !o && setRevoking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words">
              {m.invite_revoke_title({ email: revoking?.email ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>{m.invite_revoke_text()}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10">{m.common_cancel()}</AlertDialogCancel>
            <Button
              variant="destructive"
              className="h-10 font-semibold"
              loading={revoke.isPending}
              onClick={() => revoking && revoke.mutate({ path: { invitation_id: revoking.id } })}
            >
              {m.invite_action_revoke()}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
