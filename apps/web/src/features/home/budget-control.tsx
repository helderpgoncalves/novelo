import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { formatEur, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { type BudgetEstimate, budgetRange, type CurvePoint, estimateAt } from './budget';
import { EstimateTag } from './tags';

interface BudgetControlProps {
  curve: CurvePoint[];
  /** Orçamento inicial (da URL, já limitado ao intervalo). */
  initial: number;
  collectedT: number;
  potentialT: number;
  /** Chamado quando a alça pára: o resto da página (mapa, URL) só reage aí. */
  onCommit: (budget: number, estimate: BudgetEstimate | null) => void;
}

/**
 * Controlo de orçamento ao vivo. Interpola a recolha entre os cenários guardados (o que o otimizador já calculou):
 * nada chama o solver nem a IA. A alça é não controlada e os números atualizam-se no máximo uma vez por fotograma.
 */
export function BudgetControl({
  curve,
  initial,
  collectedT,
  potentialT,
  onCommit,
}: BudgetControlProps) {
  const range = useMemo(() => budgetRange(curve), [curve]);
  const [value, setValue] = useState(initial);
  const frame = useRef(0);
  const pending = useRef(initial);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  // Quando a curva muda (novo cenário guardado), a alça volta a um valor válido.
  useEffect(() => {
    setValue(initial);
    pending.current = initial;
  }, [initial]);

  const estimate = useMemo(() => estimateAt(curve, value), [curve, value]);

  if (curve.length === 0 || !range) {
    return (
      <EmptyState
        title={m.home_budget_empty_title()}
        description={m.home_budget_empty_description()}
        action={
          <Button asChild>
            <Link to="/simulator">{m.home_budget_empty_cta()}</Link>
          </Button>
        }
      />
    );
  }

  const schedule = (next: number) => {
    pending.current = next;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      setValue(pending.current);
    });
  };
  const single = range.min === range.max;
  const gainT = estimate ? estimate.tonnes - collectedT : null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow">{m.home_budget_label()}</p>
          <EstimateTag />
        </div>
        <p
          className="font-medium font-serif text-[2.4rem] tabular-nums leading-none tracking-tight"
          aria-live="polite"
        >
          {formatEur(value)}
          <span className="ml-1.5 font-sans text-base text-muted-foreground">
            {m.home_budget_per_year()}
          </span>
        </p>
      </div>

      {single ? (
        <p className="text-muted-foreground text-sm">{m.home_budget_single()}</p>
      ) : (
        <div className="space-y-1.5">
          <Slider
            key={`${range.min}-${range.max}`}
            defaultValue={[initial]}
            min={range.min}
            max={range.max}
            step={range.step}
            aria-label={m.home_budget_label()}
            className="h-11 [&_[data-slot=slider-thumb]]:size-7 [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-track]]:h-2"
            onValueChange={([v]) => schedule(v ?? range.min)}
            onValueCommit={([v]) => {
              const next = v ?? range.min;
              setValue(next);
              onCommit(next, estimateAt(curve, next));
            }}
          />
          <div className="flex justify-between text-muted-foreground text-xs tabular-nums">
            <span>{formatEur(range.min)}</span>
            <span>{formatEur(range.max)}</span>
          </div>
        </div>
      )}

      {estimate ? (
        <dl className="grid grid-cols-3 gap-x-3 gap-y-1">
          <div className="min-w-0">
            <dt className="text-muted-foreground text-xs">{m.home_budget_captured()}</dt>
            <dd className="font-medium font-serif text-xl tabular-nums leading-tight">
              {formatTonnes(estimate.tonnes, 0)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground text-xs">{m.home_budget_pct()}</dt>
            <dd className="font-medium font-serif text-xl tabular-nums leading-tight">
              {formatPercent((estimate.tonnes / potentialT) * 100, 0)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground text-xs">{m.home_budget_eur_t()}</dt>
            <dd className="font-medium font-serif text-xl tabular-nums leading-tight">
              {formatNumber(estimate.eurPerTonne, 0)}
              <span className="ml-1 font-sans text-xs text-muted-foreground">€/t</span>
            </dd>
          </div>
          <dd className="col-span-3 mt-1 text-muted-foreground text-xs leading-relaxed">
            {estimate.lower.id === estimate.upper.id
              ? m.home_budget_band_exact({ label: estimate.lower.label })
              : m.home_budget_band({
                  lo: formatTonnes(estimate.lower.tonnes, 0),
                  hi: formatTonnes(estimate.upper.tonnes, 0),
                  a: estimate.lower.label,
                  b: estimate.upper.label,
                })}
            {gainT !== null && gainT > 0 && ` ${m.home_budget_gain({ t: formatTonnes(gainT, 0) })}`}
          </dd>
        </dl>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button asChild className="h-11 justify-between gap-2">
          <Link to="/simulator" search={{ goal: 'max_tonnes', budget: value }}>
            {m.home_budget_open()}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
        {estimate && (
          <Button asChild variant="ghost" className="h-10 justify-start px-2 text-sm">
            <Link to="/scenarios/$scenarioId" params={{ scenarioId: estimate.nearest.id }}>
              {m.home_budget_nearest({ label: estimate.nearest.label })}
            </Link>
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {m.home_budget_note({ count: curve.length })}
      </p>
    </div>
  );
}
