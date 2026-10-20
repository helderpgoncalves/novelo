import { useQuery } from '@tanstack/react-query';
import { getUsersSummaryOptions } from '@/client/@tanstack/react-query.gen';
import { useCurrentUser } from '@/features/auth/use-current-user';

/** Pedidos de acesso por aprovar, só para administradores reais (o badge do menu). Atualiza ao fim de 1 min. */
export function usePendingApprovals(): number {
  const user = useCurrentUser();
  const enabled = user?.role === 'admin' && user.impersonation?.active !== true;
  const summary = useQuery({
    ...getUsersSummaryOptions(),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
  return enabled ? (summary.data?.pending_approvals ?? 0) : 0;
}
