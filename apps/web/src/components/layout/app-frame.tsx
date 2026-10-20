import { Outlet, useMatches } from '@tanstack/react-router';
import { type ReactNode, Suspense, useEffect, useRef, useState } from 'react';
import type { MeOut } from '@/client';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { TabBar } from '@/components/layout/tab-bar';
import { Topbar } from '@/components/layout/topbar';
import { OfflineBanner } from '@/components/offline-banner';
import { PullToRefresh } from '@/components/pull-to-refresh';
import { RouteSkeleton } from '@/components/skeletons';
import { VerifyEmailBanner } from '@/features/auth/verify-email-banner';
import { ImpersonationBanner } from '@/features/impersonation/impersonation-banner';
import { OnboardingTour } from '@/features/onboarding/onboarding-tour';
import { StarterChecklist } from '@/features/onboarding/starter-checklist';
import { EmailAlertsBanner } from '@/features/users/email-alerts-banner';
import { useKeyboardOpen } from '@/hooks/use-keyboard-open';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

/** Casca da app autenticada: barra lateral, topo, separadores e o conteúdo (`children` ou a rota filha). */
export function AppFrame({ user, children }: { user: MeOut; children?: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
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
    <div
      data-app-frame
      className="flex h-dvh flex-col overflow-hidden bg-background pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]"
    >
      <a
        href="#content"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-[calc(env(safe-area-inset-top)+0.5rem)] focus:left-[calc(env(safe-area-inset-left)+0.5rem)]"
      >
        {m.common_skip_to_content()}
      </a>
      <ImpersonationBanner viewedName={user.name ?? user.email} />
      <div className="flex min-h-0 flex-1">
        <AppSidebar role={user.role} mobileOpen={menuOpen} onMobileOpenChange={setMenuOpen} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar user={user} showMenuButton={fullBleed} onMenuClick={() => setMenuOpen(true)} />
          <OfflineBanner />
          <VerifyEmailBanner user={user} />
          <EmailAlertsBanner user={user} />
          <PullToRefresh scrollRef={mainRef} disabled={fullBleed} />
          <main
            id="content"
            ref={mainRef}
            className={cn(
              'flex-1',
              fullBleed
                ? 'flex min-h-0 flex-col overflow-hidden'
                : 'overflow-y-auto overscroll-y-contain',
            )}
          >
            {fullBleed ? (
              <Suspense fallback={null}>{children ?? <Outlet />}</Suspense>
            ) : (
              <div className="mx-auto w-full max-w-[96rem] px-4 pt-5 pb-8 sm:p-6 lg:px-10 lg:py-8 2xl:px-14">
                <Suspense fallback={<RouteSkeleton />}>{children ?? <Outlet />}</Suspense>
              </div>
            )}
          </main>
          {showTabBar && <TabBar onMore={() => setMenuOpen(true)} />}
          <StarterChecklist user={user} />
          <OnboardingTour user={user} />
        </div>
      </div>
    </div>
  );
}
