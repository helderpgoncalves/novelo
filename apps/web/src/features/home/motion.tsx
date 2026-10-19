import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { cn } from '@/lib/utils';

const QUERY = '(prefers-reduced-motion: reduce)';

function usePrefersReducedMotion(): boolean {
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

interface MotionValue {
  /** Animações permitidas: sem `prefers-reduced-motion` e sem pausa do utilizador. */
  enabled: boolean;
  /** O sistema pede movimento reduzido: o controlo de pausa não é necessário. */
  systemReduced: boolean;
  paused: boolean;
  setPaused: (paused: boolean) => void;
}

const MotionContext = createContext<MotionValue>({
  enabled: false,
  systemReduced: true,
  paused: false,
  setPaused: () => undefined,
});

/** Estado único das animações da página: media query do sistema + pausa do utilizador (WCAG 2.2.2). */
export function MotionProvider({ children }: { children: ReactNode }) {
  const systemReduced = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);
  const value = useMemo(
    () => ({ enabled: !systemReduced && !paused, systemReduced, paused, setPaused }),
    [systemReduced, paused],
  );
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export const useMotion = () => useContext(MotionContext);

/** Passa a `true` (e fica) quando o elemento entra no ecrã. */
export function useInView<T extends Element>(threshold = 0.25) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || seen) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen, threshold]);
  return [ref, seen] as const;
}

const easeOut = (p: number) => 1 - (1 - p) ** 3;

/** Valor que sobe de 0 até `target`; sem movimento mostra logo o valor final. */
export function useCountUp(target: number, active: boolean, duration = 1200): number {
  const { enabled } = useMotion();
  const [value, setValue] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    if (!active) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(target * easeOut(p));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled, active, target, duration]);
  return value;
}

interface CountUpProps {
  value: number;
  format: (value: number) => string;
  active?: boolean;
  duration?: number;
  className?: string;
}

/**
 * Número que conta até ao valor. A largura final fica reservada por um pseudo-elemento invisível (não
 * entra no texto), por isso a linha não "salta" enquanto os dígitos sobem; o valor final é o nome acessível.
 */
export function CountUp({ value, format, active = true, duration, className }: CountUpProps) {
  const current = useCountUp(value, active, duration);
  const final = format(value);
  return (
    <span
      role="img"
      aria-label={final}
      data-final={final}
      className={cn(
        'relative inline-block whitespace-nowrap tabular-nums before:invisible before:block before:content-[attr(data-final)]',
        className,
      )}
    >
      <span className="absolute top-0 left-0">{format(current)}</span>
    </span>
  );
}
