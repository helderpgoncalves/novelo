import { createFileRoute, Outlet, redirect, useMatches } from '@tanstack/react-router';
import { Suspense, useEffect, useState } from 'react';
import type { UserOut } from '@/client';
import { getMeOptions, getMeQueryKey } from '@/client/@tanstack/react-query.gen';
import { AppShellSkeleton } from '@/components/app-loading';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { TabBar } from '@/components/layout/tab-bar';
import { Topbar } from '@/components/layout/topbar';
import { OfflineBanner } from '@/components/offline-banner';
import { RouteSkeleton } from '@/components/skeletons';
import { VerifyEmailBanner } from '@/features/auth/verify-email-banner';
import { OnboardingTour } from '@/features/onboarding/onboarding-tour';
import { useKeyboardOpen } from '@/hooks/use-keyboard-open';
import { classifyError, isTransient } from '@/lib/errors';
import { getLocale, switchLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context: { queryClient }, location }) => {
    let user: UserOut | null;
    try {
      user = await queryClient.fetchQuery({ ...getMeOptions(), staleTime: 30_000, retry: false });
    } catch (error) {
      const kind = classifyError(error);
      // Só uma recusa de autenticação leva ao login; qualquer outra falha mostra o ecrã de erro.
      if (kind === 'session' || kind === 'forbidden') user = null;
      else if (isTransient(kind)) {
        // Sem rede ou com a API a reiniciar a sessão não acabou: segue com a que está em cache, se houver.
        user = queryClient.getQueryData<UserOut>(getMeQueryKey()) ?? null;
        if (!user) throw error;
      } else throw error;
    }
    if (!user) throw redirect({ to: '/login', search: { next: location.href } });
    // A preferência de idioma da conta manda: ao entrar noutro dispositivo, a interface segue-a.
    if (user.locale !== getLocale()) switchLocale(user.locale);
    return { user };
  },
  pendingComponent: AppShellSkeleton,
  pendingMs: 0,
  pendingMinMs: 0,
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const fullBleed = useMatches({ select: (ms) => ms.some((x) => x.staticData?.fullBleed) });

  const keyboardOpen = useKeyboardOpen();
  // Sem barra de separadores no copiloto (o compositor manda) nem com o teclado aberto.
  const showTabBar = !fullBleed && !keyboardOpen;

  // Os avisos (toasts) sobem acima da barra: ver `--tabbar-h` em styles.css.
  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute('data-tabbar', showTabBar);
    return () => root.removeAttribute('data-tabbar');
  }, [showTabBar]);

  return (
    // Laterais: em paisagem o entalhe fica de um lado e a app não pode ficar por baixo dele.
    <div className="flex h-dvh overflow-hidden bg-background pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <a
        href="#content"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-[calc(env(safe-area-inset-top)+0.5rem)] focus:left-[calc(env(safe-area-inset-left)+0.5rem)]"
      >
        {m.common_skip_to_content()}
      </a>
      <AppSidebar role={user.role} mobileOpen={menuOpen} onMobileOpenChange={setMenuOpen} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar user={user} showMenuButton={fullBleed} onMenuClick={() => setMenuOpen(true)} />
        <OfflineBanner />
        <VerifyEmailBanner user={user} />
        <main
          id="content"
          className={cn(
            'flex-1',
            fullBleed ? 'flex min-h-0 flex-col overflow-hidden' : 'overflow-y-auto',
          )}
        >
          {fullBleed ? (
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          ) : (
            <div className="mx-auto w-full max-w-[96rem] px-4 pt-5 pb-8 sm:p-6 lg:px-10 lg:py-8 2xl:px-14">
              <Suspense fallback={<RouteSkeleton />}>
                <Outlet />
              </Suspense>
            </div>
          )}
        </main>
        {showTabBar && <TabBar onMore={() => setMenuOpen(true)} />}
        <OnboardingTour user={user} />
      </div>
    </div>
  );
}
