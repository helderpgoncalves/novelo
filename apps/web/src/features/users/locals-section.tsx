import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useMemo } from 'react';
import type { LocalAccountAdminOut } from '@/client';
import { listLocalAccountsOptions } from '@/client/@tanstack/react-query.gen';
import type { Column } from '@/components/data-table';
import { DataTable } from '@/components/data-table';
import { ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/i18n';
import { m } from '@/paraglide/messages';

const kindLabel = (kind: LocalAccountAdminOut['kind']): string =>
  kind === 'b2b' ? m.locals_kind_b2b() : m.locals_kind_assistido();

/** Contas de local (papel `local`): quem entra em cada sítio, o certificado opt-in e o aviso ativo.
 * Criar é convidar (papel «local» com o local e a natureza do sítio); gerir a conta é na aba Contas. */
export function LocalsSection() {
  const list = useQuery(listLocalAccountsOptions());
  const rows = useMemo(() => list.data ?? [], [list.data]);

  const columns = useMemo<Column<LocalAccountAdminOut>[]>(
    () => [
      {
        id: 'locality',
        header: m.locals_col_locality(),
        cell: (row) => <span className="font-medium">{row.locality_name ?? '—'}</span>,
        value: (row) => row.locality_name ?? '',
        searchable: true,
        sortable: true,
        primary: true,
      },
      {
        id: 'kind',
        header: m.locals_col_kind(),
        cell: (row) => (
          <Badge variant={row.kind === 'b2b' ? 'secondary' : 'outline'}>
            {kindLabel(row.kind)}
          </Badge>
        ),
        value: (row) => kindLabel(row.kind),
        filter: true,
        badge: true,
      },
      {
        id: 'account',
        header: m.locals_col_account(),
        cell: (row) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{row.user_name ?? row.user_email}</span>
            <span className="text-muted-foreground truncate text-xs">{row.user_email}</span>
          </span>
        ),
        value: (row) => `${row.user_name ?? ''} ${row.user_email}`,
        searchable: true,
      },
      {
        id: 'certificate',
        header: m.locals_col_certificate(),
        cell: (row) =>
          row.certificate_opt_in ? (
            <Badge>{m.locals_certificate_on()}</Badge>
          ) : (
            <Badge variant="outline">{m.locals_certificate_off()}</Badge>
          ),
        value: (row) =>
          row.certificate_opt_in ? m.locals_certificate_on() : m.locals_certificate_off(),
        filter: true,
        badge: true,
      },
      {
        id: 'notice',
        header: m.locals_col_notice(),
        cell: (row) =>
          row.notice ? (
            <span className="inline-flex items-center gap-1.5">
              <Bell className="size-3.5 text-primary" aria-hidden />
              <Badge>{m.locals_notice_active()}</Badge>
              <span className="text-muted-foreground text-xs">
                {row.notice.bag_count != null && `${row.notice.bag_count} · `}
                {formatDateTime(row.notice.created_at)}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{m.locals_notice_none()}</span>
          ),
        value: (row) => (row.notice ? m.locals_notice_active() : m.locals_notice_none()),
        filter: true,
        sortable: false,
        full: true,
      },
      {
        id: 'created_at',
        header: m.users_table_created(),
        cell: (row) => (
          <span className="text-muted-foreground">{formatDateTime(row.created_at)}</span>
        ),
        value: (row) => row.created_at,
        type: 'datetime',
        sortable: true,
        desktopOnly: true,
      },
    ],
    [],
  );

  if (list.isError) {
    return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  }
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-xl">{m.locals_title()}</h2>
        <p className="max-w-3xl text-muted-foreground text-sm leading-relaxed">
          {m.locals_description()}
        </p>
      </div>
      <DataTable
        id="users.locals"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        loading={list.isPending}
        refreshing={list.isFetching}
        empty={m.locals_empty()}
        exportName="contas-de-local"
      />
    </div>
  );
}
