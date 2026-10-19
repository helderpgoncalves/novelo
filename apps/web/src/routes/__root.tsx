import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  type ErrorComponentProps,
  HeadContent,
  Link,
  Outlet,
} from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { m } from '@/paraglide/messages';

interface RouterContext {
  queryClient: QueryClient;
}

function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md space-y-4 text-center">
        <p className="eyebrow">{m.notfound_eyebrow()}</p>
        <h1 className="text-4xl">{m.notfound_title()}</h1>
        <p className="text-muted-foreground">{m.notfound_text()}</p>
        <Button asChild>
          <Link to="/">{m.common_back_home()}</Link>
        </Button>
      </div>
    </div>
  );
}

function RootError({ error, reset }: ErrorComponentProps) {
  return (
    <div role="alert" className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md space-y-4 text-center">
        <p className="eyebrow">{m.rooterror_eyebrow()}</p>
        <h1 className="text-4xl">{m.rooterror_title()}</h1>
        <p className="text-muted-foreground text-sm">
          {error instanceof Error ? error.message : m.rooterror_unexpected()}
        </p>
        <Button onClick={reset}>{m.common_retry()}</Button>
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
