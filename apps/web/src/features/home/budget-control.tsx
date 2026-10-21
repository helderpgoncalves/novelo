import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { m } from '@/paraglide/messages';
import { type BudgetEstimate, budgetRange, type CurvePoint, estimateAt } from './budget';
import { eur, num, pct, tonnes } from './safe';
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="font-serif text-xl leading-tight sm:text-2xl">{m.home_budget_title()}</h3>
        <EstimateTag />
      </div>

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="space-y-4 lg:col-span-4">
          <div className="space-y-1.5">
            <p className="font-medium text-[13px] text-muted-foreground">{m.home_budget_label()}</p>
            <p
              className="font-medium font-serif text-[2.75rem] tabular-nums lg:max-xl:text-4xl leading-none tracking-tight"
              aria-live="polite"
            >
              {eur(value)}
              <span className="ml-1.5 whitespace-nowrap font-sans text-base text-muted-foreground">
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
              <div className="flex justify-between text-[13px] text-muted-foreground tabular-nums">
                <span>{eur(range.min)}</span>
                <span>{eur(range.max)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3 lg:col-span-4">
          {estimate ? (
            <>
              <dl className="grid grid-cols-3 gap-x-3">
                <Metric label={m.home_budget_captured()} value={tonnes(estimate.tonnes, 0)} />
                <Metric
                  label={m.home_budget_pct()}
                  value={pct(potentialT > 0 ? (estimate.tonnes / potentialT) * 100 : null, 0)}
                />
                <Metric
                  label={m.home_budget_eur_t()}
                  value={num(estimate.eurPerTonne, 0)}
                  unit="€/t"
                />
              </dl>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {estimate.lower.id === estimate.upper.id
                  ? m.home_budget_band_exact({ label: estimate.lower.label })
                  : m.home_budget_band({
                      lo: tonnes(estimate.lower.tonnes, 0),
                      hi: tonnes(estimate.upper.tonnes, 0),
                      a: estimate.lower.label,
                      b: estimate.upper.label,
                    })}
                {gainT !== null && gainT > 0 && ` ${m.home_budget_gain({ t: tonnes(gainT, 0) })}`}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm leading-relaxed">
              {m.home_budget_out_of_range()}
            </p>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2 lg:col-span-4">
          <Button
            asChild
            className="h-auto min-h-11 justify-between gap-2 whitespace-normal py-2 text-left"
          >
            <Link to="/simulator" search={{ goal: 'max_tonnes', budget: value }}>
              {m.home_budget_open()}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          {estimate && (
            <Button
              asChild
              variant="ghost"
              className="h-auto min-h-10 justify-start whitespace-normal px-2 py-2 text-left text-sm"
            >
              <Link to="/scenarios/$scenarioId" params={{ scenarioId: estimate.nearest.id }}>
                {m.home_budget_nearest({ label: estimate.nearest.label })}
              </Link>
            </Button>
          )}
        </div>
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {m.home_budget_note({ count: curve.length })}
      </p>
    </div>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-[13px] text-muted-foreground leading-snug">{label}</dt>
      <dd className="font-medium font-serif text-2xl tabular-nums leading-none">
        {value}
        {unit && <span className="ml-1 font-sans text-xs text-muted-foreground">{unit}</span>}
      </dd>
    </div>
  );
}
