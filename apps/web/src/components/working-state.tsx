import { useEffect, useState } from 'react';
import { BrandSpinner } from '@/components/brand-logo';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

type Size = 'sm' | 'md' | 'lg';

/** Tamanho do spinner, espaço reservado enquanto o atraso corre (evita saltos de layout) e tipografia. */
const SIZES: Record<Size, { spinner: string; box: string; title: string; layout: string }> = {
  sm: {
    spinner: 'size-7',
    box: 'min-h-10',
    title: 'text-sm',
    layout: 'flex-row text-left',
  },
  md: {
    spinner: 'size-10',
    box: 'min-h-28',
    title: 'text-base',
    layout: 'flex-col text-center',
  },
  lg: {
    spinner: 'size-16',
    box: 'min-h-44',
    title: 'text-lg',
    layout: 'flex-col text-center',
  },
};

/** Segundos decorridos desde a montagem; um só intervalo de 1 s, só neste componente. */
function useElapsedSince(enabled: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const start = Date.now();
    const id = window.setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [enabled]);
  return seconds;
}

/**
 * Estado "a trabalhar" para esperas longas (otimizador, PDF, análise de fotografia): o spinner da marca, a fase em
 * curso e, se pedido, o tempo decorrido. Só aparece passado `delay` ms (por omissão 400): esperas curtas não
 * piscam. Não usar em tabelas nem listas (têm esqueletos) e mostrar no máximo um por ecrã. Quem o monta decide
 * quando: `{pending && <WorkingState … />}`.
 */
export function WorkingState({
  title,
  subtitle,
  size = 'md',
  elapsed,
  trackElapsed = false,
  delay = 400,
  className,
}: {
  title: string;
  subtitle?: string;
  size?: Size;
  /** Segundos já decorridos, quando o pai já os conta. */
  elapsed?: number;
  /** Conta o tempo aqui dentro (alternativa a `elapsed`). */
  trackElapsed?: boolean;
  /** Milissegundos de espera antes de aparecer. */
  delay?: number;
  className?: string;
}) {
  const [visible, setVisible] = useState(delay <= 0);
  useEffect(() => {
    if (delay <= 0) return;
    const id = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(id);
  }, [delay]);

  const own = useElapsedSince(visible && trackElapsed && elapsed === undefined);
  const seconds = elapsed ?? (trackElapsed ? own : undefined);
  const s = SIZES[size];

  if (!visible) return <div aria-hidden="true" className={cn(s.box, className)} />;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="working-state"
      className={cn(
        'fade-in-0 animate-in flex items-center justify-center gap-3 duration-300 motion-reduce:animate-none',
        s.layout,
        s.box,
        className,
      )}
    >
      <BrandSpinner className={s.spinner} />
      <div className="min-w-0 space-y-1">
        <p className={cn('font-medium font-serif leading-snug', s.title)}>{title}</p>
        {subtitle && <p className="text-muted-foreground text-sm leading-relaxed">{subtitle}</p>}
        {seconds !== undefined && (
          // Fora do anúncio: um segundo a cada segundo encheria o leitor de ecrã.
          <p aria-hidden="true" className="text-muted-foreground text-xs tabular-nums">
            {m.working_elapsed({ s: seconds })}
          </p>
        )}
      </div>
    </div>
  );
}
