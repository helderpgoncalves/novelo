import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { Suspense, useState } from 'react';
import { getMeOptions } from '@/client/@tanstack/react-query.gen';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { Topbar } from '@/components/layout/topbar';
import { PageSkeleton } from '@/components/states';
import { VerifyEmailBanner } from '@/features/auth/verify-email-banner';
import { getLocale, switchLocale } from '@/lib/i18n';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context: { queryClient }, location }) => {
    const user = await queryClient
      .fetchQuery({ ...getMeOptions(), staleTime: 30_000 })
      .catch(() => null);
    if (!user) throw redirect({ to: '/login', search: { next: location.href } });
    // A preferência de idioma da conta manda: ao entrar noutro dispositivo, a interface segue-a.
    if (user.locale !== getLocale()) switchLocale(user.locale);
    return { user };
  },
  pendingComponent: PageSkeleton,
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <a
        href="#content"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        {m.common_skip_to_content()}
      </a>
      <AppSidebar role={user.role} mobileOpen={menuOpen} onMobileOpenChange={setMenuOpen} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar user={user} onMenuClick={() => setMenuOpen(true)} />
        <VerifyEmailBanner user={user} />
        <main id="content" className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
