import { useEffect, useState } from 'react';

/**
 * Secção ativa por IntersectionObserver: a que cruza uma faixa fina a ~35% do topo do ecrã. Com várias, vale a última
 * da página; sem nenhuma (espaço entre secções) mantém a anterior.
 */
export function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join('|');

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` representa `ids`
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const live = new Set<string>();
    const order = new Map(ids.map((id, i) => [id, i]));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) live.add(e.target.id);
          else live.delete(e.target.id);
        }
        if (live.size === 0) return;
        const last = [...live].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)).pop();
        if (last) setActive(last);
      },
      { rootMargin: '-35% 0px -64% 0px' },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    // Voltar ao topo (acima do primeiro item): nenhuma ativa.
    const onScroll = () => {
      if (window.scrollY < 120) {
        live.clear();
        setActive(null);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [key]);

  return active;
}
