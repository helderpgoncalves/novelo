import { useRouter } from '@tanstack/react-router';
import { ErrorState } from '@/components/states';

/** Erro de uma rota (loader ou render): mensagem tipada e "Tentar de novo" que repete o carregamento. */
export function RouteError({ error, reset }: { error: unknown; reset?: () => void }) {
  const router = useRouter();
  return (
    <ErrorState
      error={error}
      onRetry={() => {
        reset?.();
        void router.invalidate();
      }}
    />
  );
}
