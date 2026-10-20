import { useEffect } from 'react';

/**
 * Entrada ao rolar, uma só para toda a landing: cada bloco `[data-reveal]` abaixo da dobra começa transparente e
 * 14 px abaixo, e assenta (só opacidade e transform, sem mexer no layout) quando entra no ecrã. O que já está à
 * vista nunca anima. Sem `IntersectionObserver` ou com movimento reduzido nada fica escondido.
 */
export function useRevealOnScroll() {
  useEffect(() => {
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue;
          entry.target.dataset.reveal = 'shown';
          observer.unobserve(entry.target);
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
      for (const el of document.querySelectorAll<HTMLElement>('[data-reveal]'))
        el.dataset.reveal = '';
    };
  }, []);
}
