import type { ExpressionSpecification } from 'maplibre-gl';
import { cn } from '@/lib/utils';

/** Rampa sequencial da marca (Linho a Floresta), partilhada por todos os mapas coropléticos. */
export const RAMP = ['#efe9dc', '#cfe0d6', '#9fc4b2', '#5f9a82', '#2e6b57'];

/** Expressão MapLibre que pinta uma propriedade numérica de 0 a `max` com a rampa. */
export function rampExpression(property: string, max: number): ExpressionSpecification {
  const stops = RAMP.flatMap((color, i) => [(max * i) / (RAMP.length - 1), color]);
  return [
    'interpolate',
    ['linear'],
    ['coalesce', ['get', property], 0],
    ...stops,
  ] as ExpressionSpecification;
}

interface RampLegendProps {
  title?: string;
  maxLabel: string;
  minLabel?: string;
  className?: string;
}

export function RampLegend({ title, maxLabel, minLabel = '0', className }: RampLegendProps) {
  return (
    <div
      className={cn(
        'rounded-lg bg-card/95 p-2.5 shadow-sm ring-1 ring-foreground/10 backdrop-blur',
        className,
      )}
      aria-hidden="true"
    >
      {title && <p className="mb-1.5 font-medium text-[11px] leading-none">{title}</p>}
      <div
        className="h-2 w-40 rounded-full"
        style={{ background: `linear-gradient(90deg, ${RAMP.join(', ')})` }}
      />
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
