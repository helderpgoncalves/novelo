import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouteError } from '@/components/route-error';
import { RouteSkeleton } from '@/components/skeletons';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SESSION_EXPIRED_EVENT } from '@/lib/api-config';
import { captureInstallPrompt, registerPwa } from '@/lib/pwa';
import { queryClient } from '@/lib/query-client';
import { ThemeProvider } from '@/lib/theme';
import { deLocalizeUrl, getLocale, localizeUrl } from '@/paraglide/runtime';
import { routeTree } from './routeTree.gen';
import './styles.css';

// URLs com prefixo de idioma (/pt/..., /en/...): sem prefixo, redireciona para o idioma preferido.
const current = window.location.href;
const localized = localizeUrl(current).href;
if (localized !== current) window.history.replaceState(null, '', localized);
document.documentElement.lang = getLocale();

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  scrollRestoration: true,
  // Carregamento de rotas: esqueleto da página (só aparece se demorar mais de 150 ms).
  defaultPendingComponent: RouteSkeleton,
  defaultErrorComponent: RouteError,
  defaultPendingMs: 150,
  defaultPendingMinMs: 300,
  // As rotas existem uma só vez; o prefixo do idioma é tirado à entrada e posto à saída.
  rewrite: {
    input: ({ url }) => deLocalizeUrl(url),
    output: ({ url }) => localizeUrl(url),
  },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
  // Cada rota pode indicar a forma do seu esqueleto de carregamento.
  interface StaticDataRouteOption {
    skeleton?: import('@/components/skeletons').SkeletonVariant;
    /** Ecrã inteiro: a página ocupa a área de conteúdo sem margens nem rolagem da página (ex.: /chat). */
    fullBleed?: boolean;
  }
}

// Sessão terminada (refresh falhou): limpa a cache e volta à entrada, guardando onde estavas.
window.addEventListener(SESSION_EXPIRED_EVENT, () => {
  queryClient.clear();
  const path = deLocalizeUrl(window.location.href);
  if (!path.pathname.startsWith('/login')) {
    void router.navigate({
      to: '/login',
      search: { next: `${path.pathname}${path.search}`, reason: 'expired' },
    });
  }
});

// PWA: aviso de versão nova e captura do pedido de instalação (dispara antes de o menu existir).
captureInstallPrompt();
registerPwa();

const root = document.getElementById('root');
if (!root) throw new Error('#root não existe');

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={150}>
          <RouterProvider router={router} />
        </TooltipProvider>
        <Toaster position="bottom-right" />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
