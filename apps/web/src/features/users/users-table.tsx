import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { UserAdminOut } from '@/client';
import { listUsersQueryKey, updateUserMutation } from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/i18n';
import { m } from '@/paraglide/messages';

const roleLabel = (role: UserAdminOut['role']) =>
  role === 'admin'
    ? m.account_role_admin()
    : role === 'guest'
      ? m.account_role_guest()
      : m.account_role_operator();

export function UsersTable({
  users,
  currentUserId,
}: {
  users: UserAdminOut[];
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const update = useMutation({
    ...updateUserMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listUsersQueryKey() });
      toast.success(m.users_updated());
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
      cell: (u) => (
        <div className="min-w-0">
          <p className="break-words font-medium">{u.name ?? u.email}</p>
          <p className="break-words font-normal text-muted-foreground text-xs">
            {u.name && `${u.email} · `}
            {u.email_verified ? m.users_email_confirmed() : m.users_email_unconfirmed()}
            {u.google_linked && ` · ${m.users_google()}`}
          </p>
        </div>
      ),
    },
    {
      id: 'role',
      header: m.users_table_role(),
      value: (u) => u.role,
      filter: { format: (v) => roleLabel(v as UserAdminOut['role']) },
      cell: (u) => (
        <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{roleLabel(u.role)}</Badge>
      ),
    },
    {
      id: 'status',
      header: m.users_table_status(),
      value: (u) => (u.is_active ? 'active' : 'inactive'),
      filter: {
        format: (v) => (v === 'active' ? m.users_status_active() : m.users_status_inactive()),
      },
      cell: (u) => (
        <Badge variant={u.is_active ? 'outline' : 'destructive'}>
          {u.is_active ? m.users_status_active() : m.users_status_inactive()}
        </Badge>
      ),
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
      id: 'actions',
      header: m.users_table_actions(),
      label: m.users_table_actions(),
      hideable: false,
      align: 'right',
      full: true,
      cell: (u) => {
        const self = u.id === currentUserId;
        return (
          <div className="flex flex-wrap gap-2 md:justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={self || update.isPending}
              onClick={() =>
                update.mutate({
                  path: { user_id: u.id },
                  body: { role: u.role === 'admin' ? 'operator' : 'admin' },
                })
              }
            >
              {u.role === 'admin' ? m.users_make_operator() : m.users_make_admin()}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={self || update.isPending}
              onClick={() =>
                update.mutate({ path: { user_id: u.id }, body: { is_active: !u.is_active } })
              }
            >
              {u.is_active ? m.users_deactivate() : m.users_reactivate()}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      id="users"
      exportName="utilizadores"
      columns={columns}
      rows={users}
      getRowId={(u) => u.id}
      caption={m.users_title()}
      searchLabel={m.users_search()}
    />
  );
}
