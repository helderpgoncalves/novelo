import { useEffect, useState } from 'react';
import type { Overview } from '@/client';
import { formatDate } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { eprDeadline } from './derive';
import { num, pct, tonnes } from './safe';
import { EstimateTag, MeasuredTag, UnverifiedTag } from './tags';

/** Hoje, atualizado à meia-noite local: os dias até ao prazo contam-se sempre na hora, sem esperar por um novo pedido. */
function useToday(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const next = new Date(now);
    next.setHours(24, 0, 5, 0);
    const id = window.setTimeout(() => setNow(new Date()), next.getTime() - now.getTime());
    return () => window.clearTimeout(id);
  }, [now]);
  return now;
}

interface CellProps {
  label: string;
  value: string;
  unit?: string;
  tag: React.ReactNode;
  source: string;
  emphasis?: boolean;
}

function Cell({ label, value, unit, tag, source, emphasis }: CellProps) {
  return (
    <li className="flex min-w-0 flex-col gap-2 bg-card p-4 sm:p-5">
      <p className="font-medium text-[13px] text-muted-foreground leading-snug">{label}</p>
      <p
        className={cn(
          // A unidade passa para baixo do número quando não cabe (2 325 t/ano a 320 px).
          'flex flex-wrap items-baseline gap-x-1.5 gap-y-1 font-medium font-serif text-[2rem] tabular-nums leading-none tracking-tight sm:text-[2.5rem]',
          emphasis && 'text-primary',
        )}
      >
        {value}
        {unit && <span className="font-sans text-base text-muted-foreground">{unit}</span>}
      </p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">{tag}</div>
      <p className="text-muted-foreground text-xs leading-snug">{source}</p>
    </li>
  );
}

/**
 * Faixa de situação: onde estamos (recolhido, % do potencial), quanto falta e quanto tempo há. Quatro números com
 * unidade, selo «medido» ou «estimativa» e fonte curta. Duas colunas em telemóvel, quatro em ecrã largo.
 */
export function SituationStrip({ overview }: { overview: Overview }) {
  const { gap, timeline } = overview;
  const now = useToday();
  const deadline = eprDeadline(timeline, now);
  return (
    <section aria-label={m.home_strip_label()}>
      <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border lg:grid-cols-4">
        <Cell
          label={m.home_strip_collected({ year: gap.year })}
          value={num(gap.collected_t, 1)}
          unit="t"
          tag={<MeasuredTag />}
          source={m.home_strip_collected_src()}
        />
        <Cell
          label={m.home_strip_capture()}
          value={pct(gap.capture_pct)}
          tag={<EstimateTag />}
          source={m.home_strip_capture_src({
            potential: tonnes(gap.potential_t, 0),
          })}
          emphasis
        />
        <Cell
          label={m.home_strip_missing()}
          value={num(gap.missing_t, 0)}
          unit="t/ano"
          tag={<EstimateTag />}
          source={m.home_strip_missing_src({
            rate: num(gap.missing_kg_per_inhab_month, 3),
            source: gap.potential_source_label,
          })}
          emphasis
        />
        <Cell
          label={m.home_strip_days({ date: formatDate(deadline.date, 'medium') })}
          value={num(deadline.days)}
          unit={m.home_strip_days_unit()}
          tag={deadline.verified ? <MeasuredTag /> : <UnverifiedTag />}
          source={m.home_strip_days_src({ source: deadline.sourceLabel })}
        />
      </ul>
    </section>
  );
}
