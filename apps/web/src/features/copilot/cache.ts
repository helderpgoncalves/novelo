import type { QueryClient } from '@tanstack/react-query';

/** Invalida as consultas do copiloto cujo operationId corresponde (ex.: /Threads|History/). Sem filtro, todas. */
export function invalidateCopilot(qc: QueryClient, only?: RegExp) {
  return qc.invalidateQueries({
    predicate: (q) => {
      const head = q.queryKey[0];
      const id = typeof head === 'object' && head !== null && '_id' in head ? String(head._id) : '';
      return /Copilot|PendingMemory/.test(id) && (!only || only.test(id));
    },
  });
}
