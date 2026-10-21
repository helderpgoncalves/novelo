import { useEffect, useRef } from 'react';

/**
 * Barra de progresso de leitura: 2 px na cor primária, no topo da janela. Onde há `animation-timeline: scroll()` é só CSS (no
 * compositor); nos outros navegadores um único `requestAnimationFrame` por scroll escreve o `transform`. Decorativa
 * (`aria-hidden`): o índice lateral e a navegação já dizem onde se está.
 */
export function ReadingProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (CSS.supports('animation-timeline: scroll()')) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const read = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      el.style.transform = `scaleX(${read})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={ref} aria-hidden="true" className="lp-progress" />;
}
