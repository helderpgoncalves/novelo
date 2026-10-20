import { type RefObject, useEffect, useState } from 'react';

/** Movimento permitido: sem `prefers-reduced-motion` nem poupança de dados. */
export function motionAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !connection?.saveData;
}

/** Poupança de dados (`Save-Data`) ou `prefers-reduced-data`: pede sempre a menor largura das imagens. */
export function dataSaver(): boolean {
  if (typeof window === 'undefined') return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return (
    connection?.saveData === true || window.matchMedia('(prefers-reduced-data: reduce)').matches
  );
}

/** `true` a partir do momento em que o elemento entra no ecrã (uma só vez). Sem IntersectionObserver devolve já `true`. */
export function useInViewOnce<T extends Element>(
  ref: RefObject<T | null>,
  rootMargin = '0px 0px -10% 0px',
): boolean {
  const [seen, setSeen] = useState(
    () => typeof IntersectionObserver === 'undefined' || !motionAllowed(),
  );
  useEffect(() => {
    const el = ref.current;
    if (seen || !el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setSeen(true);
        io.disconnect();
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin, seen]);
  return seen;
}

/** `true` quando a media query corresponde (ex.: `(min-width: 1024px)`); `false` no primeiro render. */
export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatch(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return match;
}
