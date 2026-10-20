import { useEffect, useState } from 'react';
import type { Overview } from '@/client';
import { formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { formatDate } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { eprDeadline } from './derive';
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
    <li className="flex min-w-[15rem] shrink-0 basis-[78%] snap-start flex-col gap-1.5 bg-card p-4 sm:min-w-0 sm:basis-auto">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="eyebrow text-[10px] tracking-[0.14em]">{label}</p>
        {tag}
      </div>
      <p
        className={cn(
          'font-medium font-serif text-[2rem] tabular-nums leading-none tracking-tight sm:text-[2.25rem]',
          emphasis && 'text-primary',
        )}
      >
        {value}
        {unit && <span className="ml-1.5 font-sans text-base text-muted-foreground">{unit}</span>}
      </p>
      <p className="text-muted-foreground text-xs leading-snug">{source}</p>
    </li>
  );
}

/**
 * Faixa de situação: onde estamos (recolhido, % do potencial), quanto falta e quanto tempo há. Quatro números com
 * unidade, selo «medido» ou «estimativa» e fonte curta. Em telemóvel é um carrossel com snap.
 */
export function SituationStrip({ overview }: { overview: Overview }) {
  const { gap, timeline } = overview;
  const now = useToday();
  const deadline = eprDeadline(timeline, now);
  return (
    <section aria-label={m.home_strip_label()}>
      <ul className="flex snap-x snap-mandatory gap-px overflow-x-auto overscroll-x-contain rounded-xl bg-border ring-1 ring-border sm:grid sm:grid-cols-4 sm:overflow-hidden">
        <Cell
          label={m.home_strip_collected({ year: gap.year })}
          value={formatNumber(gap.collected_t, 1)}
          unit="t"
          tag={<MeasuredTag />}
          source={m.home_strip_collected_src()}
        />
        <Cell
          label={m.home_strip_capture()}
          value={formatPercent(gap.capture_pct)}
          tag={<EstimateTag />}
          source={m.home_strip_capture_src({
            potential: formatTonnes(gap.potential_t, 0),
            rate: formatNumber(gap.potential_kg_per_inhab_month, 1),
          })}
          emphasis
        />
        <Cell
          label={m.home_strip_missing()}
          value={formatNumber(gap.missing_t, 0)}
          unit="t/ano"
          tag={<EstimateTag />}
          source={m.home_strip_missing_src()}
          emphasis
        />
        <Cell
          label={m.home_strip_days({ date: formatDate(deadline.date, 'medium') })}
          value={formatNumber(deadline.days)}
          unit={m.home_strip_days_unit()}
          tag={deadline.verified ? <MeasuredTag /> : <UnverifiedTag />}
          source={m.home_strip_days_src({ source: deadline.sourceLabel })}
        />
      </ul>
    </section>
  );
}
