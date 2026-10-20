import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { listUsersOptions } from '@/client/@tanstack/react-query.gen';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { PageTabs } from '@/components/page-tabs';
import { AccountsSection } from '@/features/users/accounts-section';
import { AuditPanel } from '@/features/users/audit-panel';
import { InvitationsSection } from '@/features/users/invitations-section';
import { ForbiddenError } from '@/lib/errors';
import { m } from '@/paraglide/messages';

// Três separadores. Os valores antigos (`pending`, `guests`, `poster`) continuam a abrir o sítio certo.
const TABS = ['accounts', 'invitations', 'audit'] as const;
const LEGACY = { pending: 'accounts', guests: 'invitations', poster: 'invitations' } as const;

const searchSchema = z
  .object({
    tab: z.enum([...TABS, ...Object.keys(LEGACY)] as [string, ...string[]]).catch('accounts'),
    view: z.enum(['pending']).optional().catch(undefined),
  })
  .transform(({ tab, view }) => ({
    tab: (tab in LEGACY ? LEGACY[tab as keyof typeof LEGACY] : tab) as (typeof TABS)[number],
    view: tab === 'pending' ? ('pending' as const) : view,
  }));

export const Route = createFileRoute('/_app/users')({
  staticData: { skeleton: 'table' },
  // Só administradores: a API também o impõe (403); aqui mostra-se o ecrã 403 com o URL intacto.
  beforeLoad: ({ context: { user } }) => {
    if (user.role !== 'admin') throw new ForbiddenError('admin');
  },
  validateSearch: searchSchema,
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(listUsersOptions()),
  head: () => ({ meta: [{ title: m.title_users() }] }),
  component: Users,
});

function Users() {
  const { user } = Route.useRouteContext();
  const { tab, view } = Route.useSearch();
  const navigate = Route.useNavigate();
  // Pedidos novos aparecem sozinhos: a lista atualiza ao fim de 1 min (e depois de cada ação).
  const { data, isFetching } = useSuspenseQuery({ ...listUsersOptions(), refetchInterval: 60_000 });
  const pending = data.filter((u) => u.approval_status === 'pending').length;
  const impersonating = user.impersonation?.active === true;

  return (
    <Page>
      <PageHeader
        eyebrow={m.users_eyebrow()}
        title={m.users_title()}
        description={m.users_description()}
      />
      <PageTabs
        label={m.users_tabs_label()}
        value={tab}
        onValueChange={(next) => void navigate({ search: { tab: next }, replace: true })}
        tabs={[
          {
            id: 'accounts',
            label: m.users_tab_accounts(),
            count: data.length,
            status: pending > 0 ? 'attention' : undefined,
            statusLabel: pending > 0 ? m.users_tab_pending_status({ count: pending }) : undefined,
            content: (
              <AccountsSection
                users={data}
                currentUserId={user.id}
                impersonating={impersonating}
                refreshing={isFetching}
                view={view === 'pending' ? 'pending' : 'all'}
                onViewChange={(next) =>
                  void navigate({
                    search: { tab: 'accounts', view: next === 'pending' ? 'pending' : undefined },
                    replace: true,
                  })
                }
              />
            ),
          },
          { id: 'invitations', label: m.users_tab_invitations(), content: <InvitationsSection /> },
          { id: 'audit', label: m.users_tab_audit(), content: <AuditPanel users={data} /> },
        ]}
      />
    </Page>
  );
}
