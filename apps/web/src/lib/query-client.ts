import { QueryClient } from '@tanstack/react-query';

// Não repetir pedidos que falharam por autenticação ou validação.
const shouldRetry = (count: number, error: unknown) => {
  const message = (error as { code?: string } | null)?.code;
  if (message === 'unauthorized' || message === 'forbidden') return false;
  return count < 1;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: shouldRetry, refetchOnWindowFocus: false },
  },
});
