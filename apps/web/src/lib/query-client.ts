import { QueryClient } from '@tanstack/react-query';

// Não repetir pedidos que falharam por autenticação ou validação.
const shouldRetry = (count: number, error: unknown) => {
  const message = (error as { code?: string } | null)?.code;
  if (message === 'unauthorized' || message === 'forbidden') return false;
  return count < 1;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    // `networkMode: 'always'`: sem rede o React Query, por omissão, *pausa* o pedido e o ecrã fica em "a carregar"
    // para sempre. Assim o pedido falha logo e aparece o ecrã de "sem ligação", que reintenta sozinho.
    queries: {
      staleTime: 60_000,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
      networkMode: 'always',
    },
    mutations: { networkMode: 'always' },
  },
});
