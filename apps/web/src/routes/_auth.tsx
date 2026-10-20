import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { getMeOptions } from '@/client/@tanstack/react-query.gen';
import { BootSplash } from '@/components/app-loading';
import { BrandLogo, BrandSymbol } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_auth')({
  // Quem já tem sessão não precisa de ver o ecrã de entrada.
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient
      .fetchQuery({ ...getMeOptions(), staleTime: 30_000, retry: false })
      .catch(() => null);
    if (user) throw redirect({ to: '/' });
  },
  pendingComponent: BootSplash,
  pendingMs: 0,
  pendingMinMs: 0,
  component: AuthLayout,
});

function AuthLayout() {
  const facts = [
    [m.auth_fact_parishes_value(), m.auth_fact_parishes_label()],
    [m.auth_fact_inhabitants_value(), m.auth_fact_inhabitants_label()],
    [m.auth_fact_deadline_value(), m.auth_fact_deadline_label()],
  ] as const;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-[#14211d] p-12 text-[#f4f1ea] lg:flex lg:flex-col lg:justify-between">
        <BrandSymbol
          tone="negative"
          className="-right-40 -bottom-40 pointer-events-none absolute size-[640px] opacity-30"
        />
        <BrandLogo tone="negative" className="h-9 self-start" />
        <div className="relative max-w-lg space-y-6">
          <p className="font-semibold text-[#7fb39c] text-[11px] uppercase tracking-[0.18em]">
            {m.auth_aside_eyebrow()}
          </p>
          <h2 className="text-balance text-5xl leading-[1.05]">{m.auth_aside_title()}</h2>
          <p className="max-w-md text-[#f4f1ea]/70 leading-relaxed">{m.auth_aside_text()}</p>
        </div>
        <dl className="relative grid grid-cols-3 gap-6 border-[#f4f1ea]/15 border-t pt-6">
          {facts.map(([value, label]) => (
            <div key={label}>
              <dd className="font-medium font-serif text-3xl tabular-nums">{value}</dd>
              <dt className="mt-1 text-[#f4f1ea]/60 text-xs">{label}</dt>
            </div>
          ))}
        </dl>
      </aside>
      <main className="flex flex-col pt-[max(1.5rem,env(safe-area-inset-top))] pr-[max(1.5rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(3rem,env(safe-area-inset-right))] sm:pl-[max(3rem,env(safe-area-inset-left))]">
        <div className="flex items-center justify-between">
          <div className="lg:hidden">
            <BrandLogo className="h-8" />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <Outlet />
        </div>
        <p className="text-center text-muted-foreground text-xs">{m.auth_footer()}</p>
      </main>
    </div>
  );
}
