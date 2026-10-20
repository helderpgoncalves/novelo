import { type CSSProperties, useState } from 'react';
import { BrandLogo, BrandSpinner } from '@/components/brand-logo';
import { RouteSkeleton } from '@/components/skeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { m } from '@/paraglide/messages';

const NAV_GROUPS = [
  { id: 'a', rows: ['a1', 'a2', 'a3'] },
  { id: 'b', rows: ['b1', 'b2', 'b3', 'b4'] },
  { id: 'c', rows: ['c1', 'c2', 'c3'] },
  { id: 'd', rows: ['d1', 'd2', 'd3', 'd4'] },
];

/**
 * Carregamento de arranque: o mesmo símbolo do ecrã inicial do `index.html` (ver `.boot-splash`),
 * para que a passagem do HTML para a app não tenha salto nem piscar.
 */
export function BootSplash() {
  // Continua a fase do splash do index.html (que começou em `__splashT0`) para não haver salto ao trocar.
  const [elapsed] = useState(() => {
    const t0 = (window as { __splashT0?: number }).__splashT0;
    return t0 === undefined ? 0 : Math.max(0, Math.round(performance.now() - t0));
  });
  return (
    <div
      role="status"
      aria-live="polite"
      className="boot-splash flex min-h-dvh items-center justify-center bg-background"
    >
      <BrandSpinner
        className="boot-splash-mark size-14"
        style={{ '--spin-t': `${elapsed}ms` } as CSSProperties}
      />
      <span className="sr-only">{m.common_loading()}</span>
    </div>
  );
}

/**
 * Carregamento da área autenticada: a mesma estrutura da app (barra lateral, topo e conteúdo),
 * para que ao chegar a sessão só entre o conteúdo e nada mude de sítio.
 */
export function AppShellSkeleton() {
  return (
    <div
      data-app-frame
      className="flex h-dvh overflow-hidden bg-background pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]"
      role="status"
      aria-live="polite"
    >
      <aside className="hidden w-64 shrink-0 border-sidebar-border border-r bg-sidebar pt-[env(safe-area-inset-top)] lg:block">
        <div className="flex h-16 items-center border-sidebar-border border-b px-5">
          <BrandLogo className="h-6" />
        </div>
        <div className="space-y-6 px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.id} className="space-y-2">
              <Skeleton className="mx-2.5 h-2.5 w-20" />
              {group.rows.map((row) => (
                <Skeleton key={row} className="h-9 w-full rounded-lg" />
              ))}
            </div>
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center justify-between gap-3 border-border/60 border-b px-4 pt-[env(safe-area-inset-top)] sm:px-6 lg:h-[calc(4rem+env(safe-area-inset-top))] lg:px-8">
          <BrandLogo className="h-6 lg:hidden" />
          <Skeleton className="hidden h-9 w-72 rounded-lg lg:block" />
          <div className="flex items-center gap-2">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="size-9 rounded-full" />
          </div>
        </div>
        <main className="flex-1 overflow-hidden">
          <div className="mx-auto w-full max-w-[96rem] px-4 pt-5 sm:p-6 lg:px-10 lg:py-8 2xl:px-14">
            <RouteSkeleton />
          </div>
        </main>
        <div className="shrink-0 border-border/60 border-t pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div className="flex h-14 items-center justify-around px-2">
            {['a', 'b', 'c', 'd', 'e'].map((id) => (
              <Skeleton key={id} className="h-9 w-12 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">{m.common_loading()}</span>
    </div>
  );
}
