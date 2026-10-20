import { useEffect } from 'react';

/** Tempo que a entrada mais longa (escada, fios, barras) demora; passado isto o bloco passa a `done` e o CSS larga as transições. */
const SETTLE_MS = 3200;

/**
 * Entrada ao rolar, uma só para toda a landing: cada bloco `[data-reveal]` abaixo da dobra começa escondido (`hidden`) e
 * assenta (`shown`, só opacidade e transform, sem mexer no layout) quando entra no ecrã; depois passa a `done`, para que as
 * transições de entrada (com atraso em escada) não fiquem a atrasar o hover. O gesto vem de `data-fx` (ver `styles.css`).
 * O que já está à vista nunca anima. Sem `IntersectionObserver` ou com movimento reduzido nada fica escondido.
 */
export function useRevealOnScroll() {
  useEffect(() => {
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm || !('IntersectionObserver' in window)) return;

    const timers = new Set<number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target;
          if (!entry.isIntersecting || !(el instanceof HTMLElement)) continue;
          el.dataset.reveal = 'shown';
          observer.unobserve(el);
          const id = window.setTimeout(() => {
            if (el.dataset.reveal === 'shown') el.dataset.reveal = 'done';
            timers.delete(id);
          }, SETTLE_MS);
          timers.add(id);
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    for (const el of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.88) continue;
      el.dataset.reveal = 'hidden';
      observer.observe(el);
    }
    return () => {
      observer.disconnect();
      for (const id of timers) window.clearTimeout(id);
      for (const el of document.querySelectorAll<HTMLElement>('[data-reveal]'))
        el.dataset.reveal = '';
    };
  }, []);
}
