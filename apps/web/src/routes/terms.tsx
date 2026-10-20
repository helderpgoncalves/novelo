import { createFileRoute } from '@tanstack/react-router';
import { TERMS } from '@/features/legal/content';
import { LegalPage } from '@/features/legal/legal-page';
import { getLocale } from '@/lib/i18n';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/terms')({
  head: () => ({ meta: [{ title: m.title_terms() }] }),
  component: () => <LegalPage doc={TERMS[getLocale()]} other="privacy" />,
});
