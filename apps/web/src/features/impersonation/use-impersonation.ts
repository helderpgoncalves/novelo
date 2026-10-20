import { useQuery } from '@tanstack/react-query';
import { getMeOptions } from '@/client/@tanstack/react-query.gen';

export interface ImpersonationState {
  active: boolean;
  adminName: string | null;
  expiresAt: string | null;
}

/** Estado de impersonação da sessão (lido de `/auth/me`, já em cache pela guarda da app). */
export function useImpersonation(): ImpersonationState {
  const { data } = useQuery({ ...getMeOptions(), staleTime: 60_000, retry: false });
  const info = data?.impersonation;
  return {
    active: info?.active === true,
    adminName: info?.admin_name ?? null,
    expiresAt: info?.expires_at ?? null,
  };
}
