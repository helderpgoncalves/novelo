import type { QueryClient } from '@tanstack/react-query';

/** Tudo o que a administração de contas mostra: depois de qualquer mudança, atualiza-se de uma vez. */
const ADMIN_QUERIES = new Set([
  'listUsers',
  'getUsersSummary',
  'listAudit',
  'listInvitations',
  'getMe',
]);

export function invalidateAdminQueries(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return (
        typeof key === 'object' &&
        key !== null &&
        '_id' in key &&
        ADMIN_QUERIES.has(String(key._id))
      );
    },
  });
}
