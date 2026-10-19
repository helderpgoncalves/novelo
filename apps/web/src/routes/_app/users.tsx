import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { listUsersOptions } from '@/client/@tanstack/react-query.gen';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { UsersTable } from '@/features/users/users-table';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/users')({
  // Só administradores: a API também o impõe (403), isto evita um ecrã de erro.
  beforeLoad: ({ context: { user } }) => {
    if (user.role !== 'admin') throw redirect({ to: '/' });
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
        eyebrow="Administração"
        title="Utilizadores"
        description="Quem tem acesso ao Novelo e com que perfil. Desativar uma conta termina logo as suas sessões."
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
          label="Por confirmar"
          value={formatNumber(data.filter((u) => !u.email_verified).length)}
          hint="email ainda não confirmado"
        />
      </StatStrip>
      <UsersTable users={data} currentUserId={user.id} />
    </Page>
  );
}
