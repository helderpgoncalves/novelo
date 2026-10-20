import { useRouter, useRouterState } from '@tanstack/react-router';
import { ForbiddenScreen } from '@/features/errors/forbidden-screen';
import { NotFoundScreen } from '@/features/errors/not-found-screen';
import { ServerErrorScreen } from '@/features/errors/server-error-screen';
import {
  NewVersionScreen,
  SessionExpiredScreen,
} from '@/features/errors/session-and-version-screens';
import { MaintenanceScreen, OfflineScreen } from '@/features/errors/transient-screens';
import { classifyError, ForbiddenError } from '@/lib/errors';

/**
 * Erro de uma rota (loader ou render): escolhe o ecrã pela família do erro (rede, API a reiniciar, permissão,
 * sessão, versão nova, não encontrado, genérico). "Tentar de novo" repete o carregamento sem recarregar a página.
 * Dentro da app mantém o menu; fora (a rota de arranque falhou) ocupa o ecrã.
 */
export function RouteError({
  error,
  reset,
  fullPage,
}: {
  error: unknown;
  reset?: () => void;
  fullPage?: boolean;
}) {
  const router = useRouter();
  const inShell = useRouterState({
    select: (s) => s.matches.some((x) => x.routeId === '/_app' && x.status !== 'error'),
  });
  const layout = fullPage || !inShell ? 'page' : 'panel';
  const retry = async () => {
    reset?.();
    await router.invalidate();
  };

  switch (classifyError(error)) {
    case 'chunk':
      return <NewVersionScreen layout={layout} />;
    case 'offline':
      return <OfflineScreen layout={layout} onRecover={() => void retry()} />;
    case 'maintenance':
      return <MaintenanceScreen layout={layout} onRecover={() => void retry()} />;
    case 'forbidden':
      return (
        <ForbiddenScreen
          layout={layout}
          requiredRole={error instanceof ForbiddenError ? error.requiredRole : null}
        />
      );
    case 'not_found':
      return <NotFoundScreen layout={layout} />;
    case 'session':
      return <SessionExpiredScreen layout={layout} />;
    default:
      return <ServerErrorScreen layout={layout} error={error} onRetry={retry} />;
  }
}
