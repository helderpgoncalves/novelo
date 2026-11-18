import { createFileRoute, redirect } from '@tanstack/react-router';
import {
  getActiveLocalNoticeOptions,
  getLocalAccountOptions,
  getLocalReportOptions,
  listLocalLotsOptions,
} from '@/client/@tanstack/react-query.gen';
import { AppShellSkeleton } from '@/components/app-loading';
import { LocalAreaPage } from '@/features/local-area/local-area-page';
import { getLocale, switchLocale } from '@/lib/i18n';
import { resolveSessionUser } from '@/lib/session';

// A área do local vive FORA da app de equipa (`_app`): ecrã próprio, «Duas portas», telemóvel primeiro.
// O portão é o papel `local`; a equipa apoia por impersonação, nunca por entrar aqui.
export const Route = createFileRoute('/local')({
  beforeLoad: async ({ context: { queryClient }, location }) => {
    const user = await resolveSessionUser(queryClient);
    if (!user) throw redirect({ to: '/login', search: { next: location.href } });
    if (user.approval_status !== 'approved') throw redirect({ to: '/pending-approval' });
    if (user.role !== 'local') throw redirect({ to: '/' });
    if (user.locale !== getLocale()) switchLocale(user.locale);
  },
  // Os dados da área entram pelo loader (AGENTS: `ensureQueryData` nos loaders); o certificado
  // público é opcional por conta (404 sem opt-in) e fica na componente, com os seus estados.
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(getLocalAccountOptions()),
      queryClient.ensureQueryData(getActiveLocalNoticeOptions()),
      queryClient.ensureQueryData(getLocalReportOptions()),
      queryClient.ensureQueryData(listLocalLotsOptions()),
    ]),
  // A app autenticada nunca se indexa (também o impõe o X-Robots-Tag do nginx).
  head: () => ({
    meta: [{ title: 'Conta de local · Novelo' }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  pendingComponent: AppShellSkeleton,
  pendingMs: 0,
  pendingMinMs: 0,
  component: LocalAreaPage,
});
