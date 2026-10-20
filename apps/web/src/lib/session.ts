import type { QueryClient } from '@tanstack/react-query';
import type { MeOut } from '@/client';
import { getMeOptions, getMeQueryKey } from '@/client/@tanstack/react-query.gen';
import { classifyError, isTransient } from '@/lib/errors';

/**
 * Utilizador da sessão, ou `null` sem sessão. Só uma recusa de autenticação conta como "sem sessão"; sem rede ou com
 * a API a reiniciar segue com o que está em cache, e qualquer outra falha sobe para o ecrã de erro.
 */
export async function resolveSessionUser(queryClient: QueryClient): Promise<MeOut | null> {
  try {
    return await queryClient.fetchQuery({ ...getMeOptions(), staleTime: 30_000, retry: false });
  } catch (error) {
    const kind = classifyError(error);
    if (kind === 'session' || kind === 'forbidden') return null;
    if (isTransient(kind)) {
      const cached = queryClient.getQueryData<MeOut>(getMeQueryKey());
      if (cached) return cached;
    }
    throw error;
  }
}
