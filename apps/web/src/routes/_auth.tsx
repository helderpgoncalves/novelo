import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { getMeOptions } from '@/client/@tanstack/react-query.gen';
import { BootSplash } from '@/components/app-loading';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { LegalLinks } from '@/components/public-shell';
import { ThemeToggle } from '@/components/theme-toggle';
import { AuthPanel, AuthStrip } from '@/features/auth/auth-panel';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_auth')({
  // Quem já tem sessão não precisa de ver o ecrã de entrada.
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient
      .fetchQuery({ ...getMeOptions(), staleTime: 30_000, retry: false })
      .catch(() => null);
    if (user)
      throw redirect({ to: user.approval_status === 'approved' ? '/' : '/pending-approval' });
  },
  // Entrada e registo não se indexam: nada de útil para pesquisa e não são a página pública.
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] }),
  pendingComponent: BootSplash,
  pendingMs: 0,
  pendingMinMs: 0,
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div
      data-lp-fonts=""
      className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[minmax(480px,46fr)_54fr]"
    >
      <AuthStrip />
      <main className="flex flex-1 flex-col pt-6 pr-[max(1.5rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(3rem,env(safe-area-inset-right))] sm:pl-[max(3rem,env(safe-area-inset-left))] lg:pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <BrandLogo className="h-8" />
          <div className="ml-auto flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8">
          <Outlet />
        </div>
        <div className="flex flex-col items-center gap-1">
          <LegalLinks className="text-xs [&_ul]:justify-center" />
          <p className="text-center text-muted-foreground text-xs">{m.auth_footer()}</p>
        </div>
      </main>
      <AuthPanel />
    </div>
  );
}
