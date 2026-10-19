import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  type ErrorComponentProps,
  HeadContent,
  Link,
  Outlet,
} from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

interface RouterContext {
  queryClient: QueryClient;
}

function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md space-y-4 text-center">
        <p className="eyebrow">Erro 404</p>
        <h1 className="text-4xl">Esta página não existe</h1>
        <p className="text-muted-foreground">
          O endereço pode estar errado ou a página foi movida.
        </p>
        <Button asChild>
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>
    </div>
  );
}

function RootError({ error, reset }: ErrorComponentProps) {
  return (
    <div role="alert" className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md space-y-4 text-center">
        <p className="eyebrow">Algo correu mal</p>
        <h1 className="text-4xl">Não conseguimos mostrar esta página</h1>
        <p className="text-muted-foreground text-sm">
          {error instanceof Error ? error.message : 'Erro inesperado.'}
        </p>
        <Button onClick={reset}>Tentar de novo</Button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <HeadContent />
      <Outlet />
    </>
  ),
  notFoundComponent: NotFound,
  errorComponent: RootError,
});
