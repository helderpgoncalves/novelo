import { useEffect, useState } from 'react';
import { motionAllowed } from '@/lib/motion';

/**
 * Número do hero que conta uma só vez, a partir de `delay` ms (alinhado com o momento em que o fio chega à marca). Sem
 * `prefers-reduced-motion` ou com poupança de dados aparece já final. Para leitores de ecrã e rastreadores o valor final
 * está sempre no texto (o contado é `aria-hidden`).
 */
export function HeroCount({
  value,
  format,
  delay = 0,
  duration = 1100,
}: {
  value: number;
  format: (n: number) => string;
  delay?: number;
  duration?: number;
}) {
  const [shown, setShown] = useState(() => (motionAllowed() ? 0 : value));

  useEffect(() => {
    if (!motionAllowed()) {
      setShown(value);
      return;
    }
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      start ||= now;
      const t = Math.min(1, (now - start) / duration);
      setShown(value * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    const timer = window.setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [value, delay, duration]);

  return (
    <span className="lp-count">
      <span aria-hidden="true" className="lp-count-ghost">
        {format(value)}
      </span>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
