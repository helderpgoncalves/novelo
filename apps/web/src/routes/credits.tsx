import { createFileRoute } from '@tanstack/react-router';
import { NoPending } from '@/components/app-loading';
import { CreditsPage } from '@/features/credits/credits-page';
import { m } from '@/paraglide/messages';

// Pública e indexável. O URL localizado (/pt/creditos, /en/credits) vem do `urlPatterns` do Paraglide.
export const Route = createFileRoute('/credits')({
  pendingComponent: NoPending,
  head: () => ({
    meta: [
      { title: m.title_credits() },
      { name: 'description', content: m.seo_credits_description() },
    ],
  }),
  component: CreditsPage,
});
