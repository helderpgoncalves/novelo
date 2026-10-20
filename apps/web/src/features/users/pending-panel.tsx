import { CheckCheck, UserCheck, UserX } from 'lucide-react';
import type { UserAdminOut } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { EmptyState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { originLabel } from './badges';
import { byOldestFirst } from './logic';
import { useAccountDialogs } from './use-account-dialogs';

interface Props {
  /** Todas as contas (a lista filtra as pendentes): os diálogos precisam do conjunto completo. */
  users: UserAdminOut[];
  currentUserId: string;
  impersonating: boolean;
  refreshing?: boolean;
}

/** Pedidos de acesso à espera de decisão, do mais antigo para o mais recente. */
export function PendingPanel({ users, currentUserId, impersonating, refreshing }: Props) {
  const dialogs = useAccountDialogs({ users, selfId: currentUserId, impersonating });
  const pending = users.filter((u) => u.approval_status === 'pending').sort(byOldestFirst);

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
          <p className="break-words font-medium">{u.name ?? u.email}</p>
          <p className="[overflow-wrap:anywhere] font-normal text-muted-foreground text-xs">
            {u.name && `${u.email} · `}
            {u.email_verified ? m.users_email_confirmed() : m.users_email_unconfirmed()}
          </p>
        </div>
      ),
    },
    {
      id: 'origin',
      header: m.users_table_origin(),
      value: (u) => u.joined_via,
      exportValue: (u) => originLabel(u.joined_via),
      filter: { format: (v) => originLabel(v as UserAdminOut['joined_via']) },
      cell: (u) => <Badge variant="secondary">{originLabel(u.joined_via)}</Badge>,
    },
    {
      id: 'requested',
      type: 'datetime',
      header: m.pending_col_requested(),
      className: 'text-muted-foreground',
      value: (u) => u.created_at,
      searchable: false,
      cell: (u) => formatDateTime(u.created_at),
    },
    {
      id: 'actions',
      header: m.users_table_actions(),
      label: m.users_table_actions(),
      hideable: false,
      exportable: false,
      align: 'right',
      full: true,
      cell: (u) => (
        <div className="flex flex-wrap gap-2 md:justify-end">
          <Button
            size="sm"
            className="h-10 flex-1 font-semibold md:h-8 md:flex-none"
            onClick={() => dialogs.show('approve', [u])}
          >
            <UserCheck aria-hidden="true" />
            {m.users_approve()}
            <span className="sr-only"> {u.name ?? u.email}</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-10 flex-1 md:h-8 md:flex-none"
            onClick={() => dialogs.show('reject', [u])}
          >
            <UserX aria-hidden="true" />
            {m.users_reject()}
            <span className="sr-only"> {u.name ?? u.email}</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <p className="max-w-3xl text-muted-foreground text-sm leading-relaxed">{m.pending_intro()}</p>
      <DataTable
        id="users-pending"
        exportName="pedidos-pendentes"
        columns={columns}
        rows={pending}
        getRowId={(u) => u.id}
        caption={m.users_tab_pending()}
        searchLabel={m.users_search()}
        refreshing={refreshing}
        controls="auto"
        initialSort={{ id: 'requested', desc: false }}
        empty={<EmptyState title={m.pending_empty_title()} description={m.pending_empty_text()} />}
        bulkActions={[
          {
            id: 'approve',
            label: m.users_approve(),
            icon: <CheckCheck />,
            onSelect: (rows) => dialogs.show('approve', rows),
          },
        ]}
      />
      {dialogs.element}
    </div>
  );
}
