import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { useEffect } from 'react';

interface Paged<T> {
  items: T[];
  next_cursor: string | null;
  total: number;
}

export interface AllPages<T> {
  rows: T[];
  total: number;
  /** A primeira página ainda não chegou. */
  loading: boolean;
  /** Há páginas por trazer (a tabela já pode ser usada com o que chegou). */
  loadingMore: boolean;
  error: unknown;
  retry: () => void;
}

/**
 * Traz, uma a uma, todas as páginas de uma lista por cursor (`*InfiniteOptions`) e devolve as linhas juntas.
 * A tabela filtra, ordena e exporta no cliente, por isso precisa de tudo; o primeiro pedido já a deixa usar.
 */
export function useAllPages<T, E>(
  query: UseInfiniteQueryResult<InfiniteData<Paged<T>>, E>,
): AllPages<T> {
  const { hasNextPage, isFetchingNextPage, fetchNextPage, isError } = query;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isError]);

  const pages = query.data?.pages ?? [];
  return {
    rows: pages.flatMap((p) => p.items),
    total: pages[0]?.total ?? 0,
    loading: query.isPending,
    loadingMore: !!hasNextPage && !isError,
    error: query.error,
    retry: () => void (isError && pages.length > 0 ? query.fetchNextPage() : query.refetch()),
  };
}
