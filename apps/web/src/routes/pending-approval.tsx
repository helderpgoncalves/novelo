import { createFileRoute, redirect } from '@tanstack/react-router';
import { BootSplash } from '@/components/app-loading';
import { PendingApprovalPage } from '@/features/approval/pending-approval-page';
import { resolveSessionUser } from '@/lib/session';
import { m } from '@/paraglide/messages';

// Fora do layout da app e do de entrada: quem espera aprovação não vê a navegação nem dados.
export const Route = createFileRoute('/pending-approval')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await resolveSessionUser(queryClient);
    if (!user) throw redirect({ to: '/login' });
    if (user.approval_status === 'approved') throw redirect({ to: '/' });
    return { user };
  },
  pendingComponent: BootSplash,
  pendingMs: 0,
  pendingMinMs: 0,
  head: () => ({
    meta: [{ title: m.title_pending_approval() }, { name: 'robots', content: 'noindex' }],
  }),
  component: PendingApproval,
});

function PendingApproval() {
  const { user } = Route.useRouteContext();
  return <PendingApprovalPage user={user} />;
}
