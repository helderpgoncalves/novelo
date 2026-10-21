import { useEffect, useRef, useState } from 'react';
import { motionAllowed, useInViewOnce } from '@/lib/motion';

/**
 * Número que conta uma só vez ao entrar no ecrã (cerca de 0,9 s, desaceleração suave). Para leitores de ecrã e
 * rastreadores o valor final está sempre no texto; a caixa tem desde o início a largura do valor final (sem saltos de layout); com movimento reduzido ou sem IntersectionObserver aparece já final.
 */
export function CountUp({
  value,
  format,
  duration = 900,
  className,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInViewOnce(ref);
  const [shown, setShown] = useState(() => (motionAllowed() ? 0 : value));

  useEffect(() => {
    if (!seen) return;
    if (!motionAllowed()) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(value * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [seen, value, duration]);

  return (
    <span ref={ref} className={className ? `lp-count ${className}` : 'lp-count'}>
      <span aria-hidden="true" className="lp-count-ghost">
        {format(value)}
      </span>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
