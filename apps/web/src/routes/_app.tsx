import { createFileRoute, redirect } from '@tanstack/react-router';
import { AppShellSkeleton } from '@/components/app-loading';
import { AppFrame } from '@/components/layout/app-frame';
import { getLocale, switchLocale } from '@/lib/i18n';
import { resolveSessionUser } from '@/lib/session';

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context: { queryClient }, location }) => {
    const user = await resolveSessionUser(queryClient);
    if (!user) throw redirect({ to: '/login', search: { next: location.href } });
    // Conta por aprovar (ou rejeitada): só o ecrã de espera. A API também o impõe (403 em todas as rotas).
    if (user.approval_status !== 'approved') throw redirect({ to: '/pending-approval' });
    // A preferência de idioma da conta manda: ao entrar noutro dispositivo, a interface segue-a.
    if (user.locale !== getLocale()) switchLocale(user.locale);
    return { user };
  },
  pendingComponent: AppShellSkeleton,
  pendingMs: 0,
  pendingMinMs: 0,
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  return <AppFrame user={user} />;
}
