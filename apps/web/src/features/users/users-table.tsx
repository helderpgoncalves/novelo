import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, KeyRound, Power, PowerOff, Send, Trash2, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { type UserAdminOut, updateUser } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import {
  type AccountState,
  accountState,
  originLabel,
  RoleBadge,
  StateBadge,
  stateLabel,
} from './badges';
import { invalidateAdminQueries } from './cache';
import { ApprovalEmailCell } from './delivery-badge';
import { canRetryEmail, DELIVERY_META } from './email-logic';
import { updateBlocker } from './logic';
import { roleLabel } from './role-picker';
import { useAccountDialogs } from './use-account-dialogs';
import { useResendUserEmail } from './use-resend-user-email';

interface Props {
  users: UserAdminOut[];
  currentUserId: string;
  impersonating: boolean;
  refreshing?: boolean;
}

/** Todas as contas, com as ações de administração em cada linha e em massa. */
export function UsersTable({ users, currentUserId, impersonating, refreshing }: Props) {
  const queryClient = useQueryClient();
  const dialogs = useAccountDialogs({ users, selfId: currentUserId, impersonating });
  const resendEmail = useResendUserEmail();
  const reactivate = useMutation({
    mutationFn: async (targets: UserAdminOut[]) => {
      const results = await Promise.allSettled(
        targets.map((u) =>
          updateUser({ path: { user_id: u.id }, body: { is_active: true }, throwOnError: true }),
        ),
      );
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length === results.length && failed[0])
        throw (failed[0] as PromiseRejectedResult).reason;
      return { ok: results.length - failed.length, failed: failed.length };
    },
    onSuccess: async ({ ok, failed }) => {
      await invalidateAdminQueries(queryClient);
      if (failed > 0) toast.warning(m.users_bulk_partial({ ok, failed }));
      else toast.success(ok === 1 ? m.users_updated() : m.users_bulk_done({ ok }));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const columns: Column<UserAdminOut>[] = [
    {
      id: 'user',
      header: m.users_table_user(),
      primary: true,
      label: m.users_table_user(),
      value: (u) => `${u.name ?? ''} ${u.email}`,
      exportValue: (u) => u.email,
      cell: (u) => (
        <div className="min-w-0">
          <p className="break-words font-medium">
            {u.name ?? u.email}
            {u.id === currentUserId && (
              <Badge variant="outline" className="ml-2 align-middle">
                {m.users_you()}
              </Badge>
            )}
          </p>
          <p className="[overflow-wrap:anywhere] font-normal text-muted-foreground text-xs">
            {u.name && `${u.email} · `}
            {u.email_verified ? m.users_email_confirmed() : m.users_email_unconfirmed()}
            {u.google_linked && ` · ${m.users_google()}`}
          </p>
          {u.approval_status === 'rejected' && u.rejected_reason && (
            <p className="[overflow-wrap:anywhere] font-normal text-muted-foreground text-xs">
              {m.users_rejected_reason({ reason: u.rejected_reason })}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'role',
      header: m.users_table_role(),
      value: (u) => u.role,
      filter: { format: (v) => roleLabel(v as UserAdminOut['role']) },
      cell: (u) => <RoleBadge role={u.role} />,
    },
    {
      // Aprovação e atividade num só estado: o que pede atenção (por aprovar, rejeitada) sobrepõe-se.
      id: 'status',
      header: m.users_table_status(),
      badge: true,
      value: (u) => accountState(u),
      exportValue: (u) => stateLabel(accountState(u)),
      filter: { format: (v) => stateLabel(v as AccountState) },
      cell: (u) => <StateBadge state={accountState(u)} />,
    },
    {
      id: 'origin',
      header: m.users_table_origin(),
      value: (u) => u.joined_via,
      exportValue: (u) => originLabel(u.joined_via),
      filter: { format: (v) => originLabel(v as UserAdminOut['joined_via']) },
      cell: (u) => <span className="text-muted-foreground">{originLabel(u.joined_via)}</span>,
    },
    {
      // O email que avisa a pessoa do pedido ou da decisão: escondido por omissão, à vista nos pedidos por aprovar.
      id: 'notice',
      header: m.users_approval_email_col(),
      label: m.users_approval_email_col(),
      defaultHidden: true,
      value: (u) => u.approval_email?.status ?? 'none',
      exportValue: (u) => DELIVERY_META[u.approval_email?.status ?? 'none'].label(),
      filter: { format: (v) => DELIVERY_META[v as keyof typeof DELIVERY_META].label() },
      cell: (u) => <ApprovalEmailCell email={u.approval_email} />,
    },
    {
      id: 'login',
      type: 'datetime',
      header: m.users_table_last_login(),
      className: 'text-muted-foreground',
      value: (u) => u.last_login_at,
      searchable: false,
      cell: (u) => (u.last_login_at ? formatDateTime(u.last_login_at) : m.common_never()),
    },
    {
      id: 'created',
      type: 'datetime',
      header: m.users_table_created(),
      className: 'text-muted-foreground',
      defaultHidden: true,
      value: (u) => u.created_at,
      searchable: false,
      cell: (u) => formatDateTime(u.created_at),
    },
  ];

  const bulkTargets = (rows: UserAdminOut[]) =>
    rows.filter((u) => updateBlocker(u, users, currentUserId) === null);

  return (
    <>
      <DataTable
        id="users"
        exportName="utilizadores"
        columns={columns}
        rows={users}
        getRowId={(u) => u.id}
        caption={m.users_title()}
        searchLabel={m.users_search()}
        refreshing={refreshing}
        initialSort={{ id: 'created', desc: true }}
        rowActions={(u) => {
          const actions = [];
          if (u.approval_status !== 'approved') {
            actions.push({
              id: 'approve',
              label: m.users_action_approve(),
              icon: <UserCheck />,
              onSelect: () => dialogs.show('approve', [u]),
            });
          }
          if (u.approval_status === 'pending') {
            actions.push({
              id: 'reject',
              label: m.users_action_reject(),
              icon: <UserX />,
              onSelect: () => dialogs.show('reject', [u]),
            });
          }
          if (u.approval_email && canRetryEmail(u.approval_email.status)) {
            actions.push({
              id: 'resend-email',
              label: m.email_resend_one(),
              icon: <Send />,
              onSelect: () => resendEmail.mutate({ path: { user_id: u.id } }),
            });
          }
          actions.push({
            id: 'role',
            label: m.users_action_change_role(),
            icon: <KeyRound />,
            onSelect: () => dialogs.show('role', [u]),
          });
          actions.push(
            u.is_active
              ? {
                  id: 'deactivate',
                  label: m.users_deactivate(),
                  icon: <PowerOff />,
                  onSelect: () => dialogs.show('deactivate', [u]),
                }
              : {
                  id: 'reactivate',
                  label: m.users_reactivate(),
                  icon: <Power />,
                  onSelect: () => reactivate.mutate([u]),
                },
          );
          actions.push({
            id: 'impersonate',
            label: m.users_action_impersonate(),
            icon: <Eye />,
            onSelect: () => dialogs.show('impersonate', [u]),
          });
          actions.push({
            id: 'delete',
            label: m.users_action_delete(),
            icon: <Trash2 />,
            destructive: true,
            onSelect: () => dialogs.show('delete', [u]),
          });
          return actions;
        }}
        bulkActions={[
          {
            id: 'reactivate',
            label: m.users_bulk_reactivate(),
            icon: <Power />,
            disabled: (rows) => bulkTargets(rows.filter((r) => !r.is_active)).length === 0,
            onSelect: (rows) => reactivate.mutate(bulkTargets(rows.filter((r) => !r.is_active))),
          },
          {
            id: 'deactivate',
            label: m.users_bulk_deactivate(),
            icon: <PowerOff />,
            destructive: true,
            disabled: (rows) => bulkTargets(rows.filter((r) => r.is_active)).length === 0,
            onSelect: (rows) =>
              dialogs.show(
                'deactivate',
                rows.filter((r) => r.is_active),
              ),
          },
        ]}
      />
      {dialogs.element}
    </>
  );
}
