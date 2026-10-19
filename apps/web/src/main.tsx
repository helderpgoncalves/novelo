import { registerSW } from 'virtual:pwa-register';
import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { ThemeProvider } from 'next-themes';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SESSION_EXPIRED_EVENT } from '@/lib/api-config';
import { queryClient } from '@/lib/query-client';
import { routeTree } from './routeTree.gen';
import './styles.css';

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// Sessão terminada (refresh falhou): limpa a cache e volta à entrada, guardando onde estavas.
window.addEventListener(SESSION_EXPIRED_EVENT, () => {
  queryClient.clear();
  const { pathname, search } = window.location;
  if (!pathname.startsWith('/entrar')) {
    void router.navigate({ to: '/entrar', search: { next: `${pathname}${search}` } });
  }
});

// PWA: atualiza sozinha em segundo plano.
registerSW({ immediate: true });

const root = document.getElementById('root');
if (!root) throw new Error('#root não existe');

createRoot(root).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={150}>
          <RouterProvider router={router} />
        </TooltipProvider>
        <Toaster position="bottom-right" />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
