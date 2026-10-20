import { useSyncExternalStore } from 'react';

/** `true` a partir da largura de tablet grande (md): a grelha da semana cabe; abaixo disso usa-se a lista por dia. */
export function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', notify);
      return () => mq.removeEventListener('change', notify);
    },
    () => window.matchMedia(query).matches,
    () => true,
  );
}
