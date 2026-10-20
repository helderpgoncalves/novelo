import { createFileRoute } from '@tanstack/react-router';
import { NoPending } from '@/components/app-loading';
import { PRIVACY } from '@/features/legal/content';
import { LegalPage } from '@/features/legal/legal-page';
import { getLocale } from '@/lib/i18n';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/privacy')({
  pendingComponent: NoPending,
  head: () => ({ meta: [{ title: m.title_privacy_policy() }] }),
  component: () => <LegalPage doc={PRIVACY[getLocale()]} other="terms" />,
});
