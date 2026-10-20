import { useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import type { PageContext } from '@/client';

const toStrings = (value: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (typeof value !== 'object' || value === null) return out;
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      out[k] = String(v);
    else if (Array.isArray(v)) out[k] = v.map(String).join(',');
  }
  return out;
};

/** O ecrã atual como o servidor o entende: padrão da rota (`/scenarios/$scenarioId`), parâmetros e filtros. */
export function usePageContext() {
  const router = useRouter();
  const get = useCallback((): PageContext | null => {
    const matches = router.state.matches;
    const leaf = matches[matches.length - 1];
    if (!leaf) return null;
    const route = leaf.routeId.replace(/^\/_app/, '').replace(/\/$/, '') || '/';
    if (route === '/chat') return null;
    return { route, params: toStrings(leaf.params), search: toStrings(leaf.search) };
  }, [router]);
  return get;
}
