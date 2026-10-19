import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { getAiSettingsOptions } from '@/client/@tanstack/react-query.gen';
import { AI_TABS, AiAdminPage } from '@/features/ai-admin/ai-admin-page';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/admin/ai')({
  staticData: { skeleton: 'dashboard' },
  // Só administradores: a API também o impõe (403).
  beforeLoad: ({ context: { user } }) => {
    if (user.role !== 'admin') throw redirect({ to: '/' });
  },
  validateSearch: z.object({
    tab: z.enum(AI_TABS).catch('overview'),
    days: z.coerce
      .number()
      .pipe(z.union([z.literal(7), z.literal(30), z.literal(90)]))
      .catch(30),
  }),
  // Aquece a configuração; os erros aparecem no próprio painel, com tentar de novo.
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(getAiSettingsOptions());
  },
  head: () => ({ meta: [{ title: m.aiadm_title() }] }),
  component: AiAdmin,
});

function AiAdmin() {
  const { tab, days } = Route.useSearch();
  return <AiAdminPage tab={tab} days={days} />;
}
