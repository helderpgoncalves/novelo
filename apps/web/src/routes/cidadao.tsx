import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import type { MeOut } from '@/client';
import { AppShellSkeleton } from '@/components/app-loading';
import { CidadaoPage } from '@/features/cidadao/cidadao-page';
import { getLocale, switchLocale } from '@/lib/i18n';
import { resolvePublicSessionUser } from '@/lib/session';

// A área do cidadão («Carteira») vive FORA da app de equipa (`_app`), como a do local: telemóvel primeiro.
// Sem sessão é a porta de entrada do doador (email + 13 anos); quem tem conta de equipa vê só o público.

const TABS = ['inicio', 'sacos', 'saldo', 'historico'] as const;

export const Route = createFileRoute('/cidadao')({
  validateSearch: z.object({ tab: z.enum(TABS).optional().catch(undefined) }),
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await resolvePublicSessionUser(queryClient);
    // A conta de equipa tem a sua app: a área do cidadão não é para ela (redireciona como o `/local`).
    if (user?.role === 'local') throw redirect({ to: '/local' });
    if (user && user.role !== 'donor') throw redirect({ to: '/' });
    if (user && user.approval_status !== 'approved') throw redirect({ to: '/pending-approval' });
    if (user && user.locale !== getLocale()) switchLocale(user.locale);
    return { user };
  },
  // Área pessoal: nunca se indexa (a página pública é /onde-quando).
  head: () => ({
    meta: [{ title: 'Carteira · Novelo' }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  pendingComponent: AppShellSkeleton,
  pendingMs: 0,
  pendingMinMs: 0,
  component: CidadaoView,
});

function CidadaoView() {
  const { user } = Route.useRouteContext();
  const { tab } = Route.useSearch();
  return <CidadaoPage user={user satisfies MeOut | null} tab={tab ?? 'inicio'} />;
}
