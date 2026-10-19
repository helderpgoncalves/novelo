import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { type ReactNode, Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorState } from '@/components/states';

interface AsyncBoundaryProps {
  /** Esqueleto mostrado enquanto os dados carregam (use o que tem a mesma forma do conteúdo). */
  fallback: ReactNode;
  children: ReactNode;
}

/**
 * Suspense + erro + retry num só componente, para qualquer bloco com `useSuspenseQuery` fora das rotas
 * (painéis, gavetas, separadores). O botão "Tentar de novo" repõe também a cache de erro do React Query.
 */
export function AsyncBoundary({ fallback, children }: AsyncBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <ErrorState error={error} onRetry={resetErrorBoundary} />
          )}
        >
          <Suspense fallback={fallback}>{children}</Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
