import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { z } from 'zod';
import {
  getObservedFlowsOptions,
  getOverviewOptions,
  getTextileBaselineOptions,
  getWasteCompositionOptions,
  listZonesOptions,
} from '@/client/@tanstack/react-query.gen';
import { BootSplash } from '@/components/app-loading';
import { AppFrame } from '@/components/layout/app-frame';
import { HOME_TABS, HomePage } from '@/features/home/home-page';
import { getLocale, switchLocale } from '@/lib/i18n';
import { ogImage, SITE_URL } from '@/lib/seo';
import { resolveSessionUser } from '@/lib/session';
import { m } from '@/paraglide/messages';

// A landing é um pacote à parte (não pesa na app).
const LandingPage = lazy(() =>
  import('@/features/landing/landing-page').then((mod) => ({ default: mod.LandingPage })),
);

// "/" é a página inicial pública para quem não tem sessão (é o "Application home page" da Google: sem login, com
// Privacidade e Termos à vista) e a página inicial da app para quem tem. Por isso não vive dentro de `_app`.
export const Route = createFileRoute('/')({
  staticData: { skeleton: 'home' },
  validateSearch: z.object({ tab: z.enum(HOME_TABS).optional().catch(undefined) }),
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await resolveSessionUser(queryClient);
    // A preferência de idioma da conta manda: ao entrar noutro dispositivo, a interface segue-a.
    if (user && user.locale !== getLocale()) switchLocale(user.locale);
    return { user };
  },
  loader: ({ context: { queryClient, user } }) =>
    user
      ? Promise.all([
          queryClient.ensureQueryData(getOverviewOptions()),
          queryClient.ensureQueryData(getTextileBaselineOptions()),
          queryClient.ensureQueryData(getObservedFlowsOptions()),
          queryClient.ensureQueryData(getWasteCompositionOptions()),
          queryClient.ensureQueryData(listZonesOptions()),
        ])
      : undefined,
  head: ({ match }) => ({
    meta: match.context.user
      ? [{ title: m.home_title() }]
      : [
          { title: m.title_landing() },
          { name: 'description', content: m.landing_description() },
          { property: 'og:title', content: m.title_landing() },
          { property: 'og:description', content: m.landing_description() },
          { property: 'og:image', content: ogImage('landing') },
          { property: 'og:image:alt', content: m.seo_og_alt_landing() },
          { name: 'twitter:image', content: ogImage('landing') },
        ],
    links: match.context.user
      ? []
      : [{ rel: 'canonical', href: `${SITE_URL}/${getLocale() === 'en' ? 'en' : 'pt'}/` }],
  }),
  pendingComponent: BootSplash,
  pendingMs: 0,
  pendingMinMs: 0,
  component: Home,
});

function Home() {
  const { user } = Route.useRouteContext();
  const { tab = 'entities' } = Route.useSearch();
  const navigate = Route.useNavigate();
  if (!user)
    return (
      <Suspense fallback={<BootSplash />}>
        <LandingPage />
      </Suspense>
    );
  return (
    <AppFrame user={user}>
      <HomePage
        tab={tab}
        onTabChange={(next) => void navigate({ search: { tab: next }, replace: true })}
      />
    </AppFrame>
  );
}
