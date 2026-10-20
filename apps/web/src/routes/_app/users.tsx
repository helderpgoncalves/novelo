import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { listUsersOptions } from '@/client/@tanstack/react-query.gen';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { PageTabs } from '@/components/page-tabs';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { AuditPanel } from '@/features/users/audit-panel';
import { EventPoster } from '@/features/users/event-poster';
import { GuestsTable } from '@/features/users/guests-table';
import { InvitationsPanel } from '@/features/users/invitations-panel';
import { PendingPanel } from '@/features/users/pending-panel';
import { UsersTable } from '@/features/users/users-table';
import { ForbiddenError } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';

const TABS = ['accounts', 'pending', 'invitations', 'guests', 'poster', 'audit'] as const;

export const Route = createFileRoute('/_app/users')({
  staticData: { skeleton: 'table' },
  // Só administradores: a API também o impõe (403); aqui mostra-se o ecrã 403 com o URL intacto.
  beforeLoad: ({ context: { user } }) => {
    if (user.role !== 'admin') throw new ForbiddenError('admin');
  },
  validateSearch: z.object({ tab: z.enum(TABS).catch('accounts') }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(listUsersOptions()),
  head: () => ({ meta: [{ title: m.title_users() }] }),
  component: Users,
});

function Users() {
  const { user } = Route.useRouteContext();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  // Pedidos novos aparecem sozinhos: a lista atualiza ao fim de 1 min (e depois de cada ação).
  const { data, isFetching } = useSuspenseQuery({ ...listUsersOptions(), refetchInterval: 60_000 });
  const guests = data.filter((u) => u.role === 'guest').length;
  const pending = data.filter((u) => u.approval_status === 'pending').length;
  const impersonating = user.impersonation?.active === true;

  return (
    <Page>
      <PageHeader
        eyebrow={m.users_eyebrow()}
        title={m.users_title()}
        description={m.users_description()}
      />
      <StatStrip>
        <StatCell label={m.users_stat_accounts()} value={formatNumber(data.length)} />
        <StatCell
          label={m.users_stat_pending()}
          value={formatNumber(pending)}
          hint={m.users_stat_pending_hint()}
        />
        <StatCell
          label={m.users_stat_admins()}
          value={formatNumber(data.filter((u) => u.role === 'admin').length)}
        />
        <StatCell label={m.users_stat_guests()} value={formatNumber(guests)} />
      </StatStrip>
      <PageTabs
        label={m.users_tabs_label()}
        value={tab}
        onValueChange={(next) => void navigate({ search: { tab: next }, replace: true })}
        tabs={[
          {
            id: 'accounts',
            label: m.users_tab_accounts(),
            count: data.length,
            content: (
              <UsersTable
                users={data}
                currentUserId={user.id}
                impersonating={impersonating}
                refreshing={isFetching}
              />
            ),
          },
          {
            id: 'pending',
            label: m.users_tab_pending(),
            count: pending,
            status: pending > 0 ? 'attention' : undefined,
            statusLabel: pending > 0 ? m.users_tab_pending_status({ count: pending }) : undefined,
            content: (
              <PendingPanel
                users={data}
                currentUserId={user.id}
                impersonating={impersonating}
                refreshing={isFetching}
              />
            ),
          },
          { id: 'invitations', label: m.users_tab_invitations(), content: <InvitationsPanel /> },
          { id: 'guests', label: m.users_tab_guests(), count: guests, content: <GuestsTable /> },
          { id: 'poster', label: m.users_tab_poster(), content: <EventPoster /> },
          { id: 'audit', label: m.users_tab_audit(), content: <AuditPanel users={data} /> },
        ]}
      />
    </Page>
  );
}
