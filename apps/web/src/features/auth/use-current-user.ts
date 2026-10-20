import { useQuery } from '@tanstack/react-query';
import { getMeOptions } from '@/client/@tanstack/react-query.gen';

/** Utilizador da sessão (já em cache desde o `beforeLoad` da app). */
export function useCurrentUser() {
  return useQuery({ ...getMeOptions(), staleTime: 60_000, retry: false }).data ?? null;
}

/** Contas de convidado (QR do evento): sem administração, sem apagar e sem ações críticas do copiloto. */
export const useIsGuest = (): boolean => useCurrentUser()?.role === 'guest';
