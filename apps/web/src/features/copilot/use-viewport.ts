import { useEffect, useState, useSyncExternalStore } from 'react';

const MOBILE = '(max-width: 639px)';

/** Telemóvel: o copiloto ocupa o ecrã todo e as listas abrem em folhas inferiores. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(MOBILE);
      mq.addEventListener('change', notify);
      return () => mq.removeEventListener('change', notify);
    },
    () => window.matchMedia(MOBILE).matches,
    () => false,
  );
}

export interface ViewportBox {
  height: number;
  top: number;
}

/**
 * A área realmente visível (descontado o teclado no iOS, onde o viewport de layout não encolhe).
 * Devolve `null` quando não está ativo, para a folha usar só `100dvh`.
 */
export function useVisualViewport(active: boolean): ViewportBox | null {
  const [box, setBox] = useState<ViewportBox | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) {
      setBox(null);
      return;
    }
    const read = () =>
      setBox((prev) => {
        const next = { height: Math.round(vv.height), top: Math.round(vv.offsetTop) };
        return prev && prev.height === next.height && prev.top === next.top ? prev : next;
      });
    read();
    vv.addEventListener('resize', read);
    vv.addEventListener('scroll', read);
    return () => {
      vv.removeEventListener('resize', read);
      vv.removeEventListener('scroll', read);
    };
  }, [active]);
  return box;
}
