import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** O sistema pede movimento reduzido: nada de animações nem de frases a rodar sozinhas. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener('change', notify);
      return () => mq.removeEventListener('change', notify);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
