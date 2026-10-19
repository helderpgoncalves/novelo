import { cn } from '@/lib/utils';

interface RangeBarProps {
  label: string;
  p10: number;
  p50: number;
  p90: number;
  format: (value: number) => string;
  /** Domínio comum a várias barras; sem ele usa-se o próprio intervalo com folga. */
  domain?: [number, number];
  className?: string;
}

const clamp = (v: number) => Math.min(100, Math.max(0, v));

/** Barra de intervalo P10–P90 com a mediana marcada. Os números ficam sempre escritos por baixo. */
export function RangeBar({ label, p10, p50, p90, format, domain, className }: RangeBarProps) {
  const span = Math.max(p90 - p10, Math.abs(p50) * 0.02, 1e-9);
  const [lo, hi] = domain ?? [p10 - span * 0.35, p90 + span * 0.35];
  const pos = (v: number) => clamp(((v - lo) / Math.max(hi - lo, 1e-9)) * 100);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium text-sm">{label}</p>
        <p className="font-serif text-xl tabular-nums">{format(p50)}</p>
      </div>
      <div
        role="img"
        aria-label={`${label}: P10 ${format(p10)}, P50 ${format(p50)}, P90 ${format(p90)}`}
        className="relative h-3 rounded-full bg-muted"
      >
        <span
          className="absolute inset-y-0 rounded-full bg-primary/35"
          style={{ left: `${pos(p10)}%`, width: `${Math.max(pos(p90) - pos(p10), 1)}%` }}
        />
        <span
          className="absolute top-1/2 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
          style={{ left: `${pos(p50)}%` }}
        />
      </div>
      <dl className="flex justify-between gap-3 text-muted-foreground text-xs tabular-nums">
        <div>
          <dt className="inline">P10 </dt>
          <dd className="inline text-foreground">{format(p10)}</dd>
        </div>
        <div className="text-right">
          <dt className="inline">P90 </dt>
          <dd className="inline text-foreground">{format(p90)}</dd>
        </div>
      </dl>
    </div>
  );
}
