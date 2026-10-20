import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { getMeOptions } from '@/client/@tanstack/react-query.gen';
import { NoPending } from '@/components/app-loading';
import { LanguageSwitcher } from '@/components/language-switcher';
import { LegalLinks } from '@/components/public-shell';
import { ThemeToggle } from '@/components/theme-toggle';
import { AuthPanel } from '@/features/auth/auth-panel';
import { MobileCorner } from '@/features/auth/mobile-corner';
import { hasSessionHint } from '@/lib/session-hint';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_auth')({
  // Quem já tem sessão não precisa de ver o ecrã de entrada.
  beforeLoad: async ({ context: { queryClient } }) => {
    // Sem pista local de sessão não há nada a verificar: o ecrã de entrada aparece de imediato.
    if (!hasSessionHint()) return;
    const user = await queryClient
      .fetchQuery({ ...getMeOptions(), staleTime: 30_000, retry: false })
      .catch(() => null);
    if (user)
      throw redirect({ to: user.approval_status === 'approved' ? '/' : '/pending-approval' });
  },
  // Entrada e registo não se indexam: nada de útil para pesquisa e não são a página pública.
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] }),
  pendingComponent: NoPending,
  pendingMs: 0,
  pendingMinMs: 0,
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div
      data-lp-fonts=""
      className="relative flex min-h-dvh flex-col lg:grid lg:grid-cols-[54fr_minmax(480px,46fr)]"
    >
      <MobileCorner />
      {/* O formulário vem primeiro no DOM (teclado e leitores de ecrã); a imagem decorativa fica à esquerda por `order`.
          Em telemóvel não há logótipo nem imagem: o ecrã é só o formulário. */}
      <main className="relative lg:order-2 flex flex-1 flex-col pt-6 pr-[max(1.5rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(3rem,env(safe-area-inset-right))] sm:pl-[max(3rem,env(safe-area-inset-left))] lg:pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8">
          <Outlet />
        </div>
        {/* Sem caixa nem véu: o contraste do rodapé sobre a Penha vem de um contorno de texto na cor do fundo. */}
        <div className="relative flex flex-col items-center gap-1 [text-shadow:0_0_3px_var(--background),0_0_8px_var(--background),0_0_14px_var(--background)] lg:[text-shadow:none]">
          <LegalLinks className="text-xs [&_ul]:justify-center" />
          <p className="text-center text-muted-foreground text-xs">{m.auth_footer()}</p>
        </div>
      </main>
      <AuthPanel className="lg:order-1" />
    </div>
  );
}
