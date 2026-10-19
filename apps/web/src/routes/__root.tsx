import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';

interface RouterContext {
  queryClient: QueryClient;
}

const nav = [
  { to: '/', label: 'Ponto de partida' },
  { to: '/circuitos', label: 'Circuitos atuais' },
] as const;

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-16 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-linha border-b py-5">
        <Link to="/" className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-8" />
          <span className="font-medium font-titulo text-2xl">Novelo</span>
        </Link>
        <nav className="flex gap-5 text-sm">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-pedra hover:text-tinta"
              activeProps={{ className: 'text-floresta font-medium' }}
              activeOptions={{ exact: item.to === '/' }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="pt-8">
        <Outlet />
      </main>
    </div>
  ),
});
