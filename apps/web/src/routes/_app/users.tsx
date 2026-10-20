import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { listUsersOptions } from '@/client/@tanstack/react-query.gen';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { PageTabs } from '@/components/page-tabs';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { EventPoster } from '@/features/users/event-poster';
import { GuestsTable } from '@/features/users/guests-table';
import { UsersTable } from '@/features/users/users-table';
import { ForbiddenError } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';

const TABS = ['accounts', 'guests', 'poster'] as const;

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
  const { data } = useSuspenseQuery(listUsersOptions());
  const guests = data.filter((u) => u.role === 'guest').length;

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
          label={m.users_stat_admins()}
          value={formatNumber(data.filter((u) => u.role === 'admin').length)}
        />
        <StatCell label={m.users_stat_guests()} value={formatNumber(guests)} />
        <StatCell
          label={m.users_stat_unverified()}
          value={formatNumber(data.filter((u) => !u.email_verified && u.role !== 'guest').length)}
          hint={m.users_stat_unverified_hint()}
        />
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
            content: <UsersTable users={data} currentUserId={user.id} />,
          },
          { id: 'guests', label: m.users_tab_guests(), count: guests, content: <GuestsTable /> },
          { id: 'poster', label: m.users_tab_poster(), content: <EventPoster /> },
        ]}
      />
    </Page>
  );
}
