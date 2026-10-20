import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, HeadContent, Outlet } from '@tanstack/react-router';
import { RouteError } from '@/components/route-error';
import { NotFoundScreen } from '@/features/errors/not-found-screen';

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <HeadContent />
      <Outlet />
    </>
  ),
  notFoundComponent: () => <NotFoundScreen layout="page" />,
  errorComponent: ({ error, reset }) => <RouteError error={error} reset={reset} fullPage />,
});
