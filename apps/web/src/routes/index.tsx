import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { z } from 'zod';
import {
  getCaopParishesGeojsonOptions,
  getOverviewOptions,
} from '@/client/@tanstack/react-query.gen';
import { HomePending } from '@/components/app-loading';
import { HOME_TABS, LAYER_IDS } from '@/features/home/tabs';
import { getLocale, switchLocale } from '@/lib/i18n';
import { ogImage, SITE_URL } from '@/lib/seo';
import { resolvePublicSessionUser } from '@/lib/session';
import { m } from '@/paraglide/messages';

// A landing e a home da app são pacotes à parte: quem não tem sessão nunca descarrega a app (nem o echarts), e quem
// tem sessão não descarrega a landing.
const LandingPage = lazy(() =>
  import('@/features/landing/landing-page').then((mod) => ({ default: mod.LandingPage })),
);
const AuthedHome = lazy(() => import('@/features/home/authed-home'));

// "/" é a página inicial pública para quem não tem sessão (é o "Application home page" da Google: sem login, com
// Privacidade e Termos à vista) e a página inicial da app para quem tem. Por isso não vive dentro de `_app`.
export const Route = createFileRoute('/')({
  staticData: { skeleton: 'home' },
  // Estado partilhável da sala de decisão: separador da evidência, camada do mapa, freguesia aberta e orçamento escolhido.
  validateSearch: z.object({
    tab: z.enum(HOME_TABS).optional().catch(undefined),
    layer: z.enum(LAYER_IDS).optional().catch(undefined),
    parish: z
      .string()
      .regex(/^\w{4,8}$/)
      .optional()
      .catch(undefined),
    budget: z.number().positive().max(10_000_000).optional().catch(undefined),
  }),
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await resolvePublicSessionUser(queryClient);
    // A preferência de idioma da conta manda: ao entrar noutro dispositivo, a interface segue-a.
    if (user && user.locale !== getLocale()) switchLocale(user.locale);
    return { user };
  },
  // Só o resumo bloqueia o primeiro desenho; os contornos CAOP das freguesias pedem-se já mas o mapa espera por ela com o seu esqueleto.
  loader: ({ context: { queryClient, user } }) => {
    if (!user) return undefined;
    void queryClient.prefetchQuery(getCaopParishesGeojsonOptions());
    return queryClient.ensureQueryData(getOverviewOptions());
  },
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
  pendingComponent: HomePending,
  pendingMs: 0,
  pendingMinMs: 0,
  component: Home,
});

function Home() {
  const { user } = Route.useRouteContext();
  const { tab = 'entities', layer = 'gap', parish, budget } = Route.useSearch();
  const navigate = Route.useNavigate();
  if (!user)
    return (
      <Suspense fallback={null}>
        <LandingPage />
      </Suspense>
    );
  return (
    <Suspense fallback={<HomePending />}>
      <AuthedHome
        user={user}
        search={{ tab, layer, parish: parish ?? null, budget: budget ?? null }}
        onSearch={(patch) =>
          void navigate({
            search: (prev) => ({
              ...prev,
              ...patch,
              parish: 'parish' in patch ? (patch.parish ?? undefined) : prev.parish,
            }),
            replace: true,
            resetScroll: false,
          })
        }
      />
    </Suspense>
  );
}
