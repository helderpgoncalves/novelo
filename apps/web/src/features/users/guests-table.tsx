import { useQuery } from '@tanstack/react-query';
import type { GuestOut } from '@/client';
import { listGuestsOptions } from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { EmptyState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { UserChip } from '@/components/user-chip';
import { formatNumber } from '@/lib/format';
import { formatDateTime } from '@/lib/i18n';
import { m } from '@/paraglide/messages';

const PAGE = 200;

/** Quem entrou pelo QR do evento: nome, quando, com que consentimento e quanto usou o copiloto. */
export function GuestsTable() {
  const guests = useQuery(listGuestsOptions({ query: { limit: PAGE } }));
  const rows = guests.data?.items ?? [];

  const columns: Column<GuestOut>[] = [
    {
      id: 'guest',
      header: m.users_table_user(),
      primary: true,
      label: m.users_table_user(),
      value: (g) => `${g.name ?? ''} ${g.email}`,
      exportValue: (g) => g.email,
      cell: (g) => (
        <UserChip
          person={g}
          status={g.is_active ? 'active' : 'inactive'}
          statusLabel={m.users_status_inactive()}
        />
      ),
    },
    {
      id: 'joined',
      type: 'datetime',
      header: m.guests_table_joined(),
      className: 'text-muted-foreground',
      value: (g) => g.joined_at,
      searchable: false,
      cell: (g) => formatDateTime(g.joined_at),
    },
    {
      id: 'login',
      type: 'datetime',
      header: m.users_table_last_login(),
      className: 'text-muted-foreground',
      value: (g) => g.last_login_at,
      searchable: false,
      cell: (g) => (g.last_login_at ? formatDateTime(g.last_login_at) : m.common_never()),
    },
    {
      id: 'actions',
      type: 'number',
      header: m.guests_table_activity(),
      align: 'right',
      value: (g) => g.actions_count,
      aggregate: 'sum',
      format: (v) => formatNumber(v),
      filter: 'range',
      searchable: false,
      cell: (g) => formatNumber(g.actions_count),
    },
    {
      id: 'consent',
      header: m.guests_table_consent(),
      value: (g) => g.consent_version ?? '',
      filter: { format: (v) => v || m.guests_no_consent() },
      cell: (g) =>
        g.consent_at ? (
          <span className="text-muted-foreground text-xs">
            {formatDateTime(g.consent_at)}
            {g.consent_version && ` · v${g.consent_version}`}
          </span>
        ) : (
          <Badge variant="outline">{m.guests_no_consent()}</Badge>
        ),
      exportValue: (g) => (g.consent_at ? `${g.consent_at} ${g.consent_version ?? ''}`.trim() : ''),
    },
    {
      id: 'status',
      header: m.users_table_status(),
      value: (g) => (g.is_active ? 'active' : 'inactive'),
      filter: {
        format: (v) => (v === 'active' ? m.users_status_active() : m.users_status_inactive()),
      },
      cell: (g) => (
        <Badge variant={g.is_active ? 'outline' : 'destructive'}>
          {g.is_active ? m.users_status_active() : m.users_status_inactive()}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-2">
      <DataTable
        id="guests"
        exportName="convidados"
        columns={columns}
        rows={rows}
        getRowId={(g) => g.id}
        caption={m.guests_title()}
        searchLabel={m.users_search()}
        initialSort={{ id: 'joined', desc: true }}
        loading={guests.isPending}
        refreshing={guests.isFetching && !guests.isPending}
        error={guests.error}
        onRetry={() => void guests.refetch()}
        empty={<EmptyState title={m.guests_empty_title()} description={m.guests_empty_text()} />}
      />
      {guests.data && guests.data.total > rows.length && (
        <p className="text-muted-foreground text-xs">
          {m.guests_truncated({ shown: rows.length, total: guests.data.total })}
        </p>
      )}
    </div>
  );
}
