import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { listUsersOptions } from '@/client/@tanstack/react-query.gen';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { UsersTable } from '@/features/users/users-table';
import { ForbiddenError } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/users')({
  staticData: { skeleton: 'table' },
  // Só administradores: a API também o impõe (403); aqui mostra-se o ecrã 403 com o URL intacto.
  beforeLoad: ({ context: { user } }) => {
    if (user.role !== 'admin') throw new ForbiddenError('admin');
  },
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(listUsersOptions()),
  head: () => ({ meta: [{ title: m.title_users() }] }),
  component: Users,
});

function Users() {
  const { user } = Route.useRouteContext();
  const { data } = useSuspenseQuery(listUsersOptions());

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
        <StatCell
          label={m.users_stat_active()}
          value={formatNumber(data.filter((u) => u.is_active).length)}
        />
        <StatCell
          label={m.users_stat_unverified()}
          value={formatNumber(data.filter((u) => !u.email_verified).length)}
          hint={m.users_stat_unverified_hint()}
        />
      </StatStrip>
      <UsersTable users={data} currentUserId={user.id} />
    </Page>
  );
}
