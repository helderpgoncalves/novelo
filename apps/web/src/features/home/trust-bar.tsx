import { Link } from '@tanstack/react-router';
import { useId, useState } from 'react';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { type TrustItem, type TrustKey, type TrustStatus, trustCounts } from './derive';

const STATUS_STYLE: Record<TrustStatus, { bar: string; dot: string; label: () => string }> = {
  measured: { bar: 'bg-primary', dot: 'bg-primary', label: () => m.home_trust_measured() },
  estimate: {
    bar: 'bg-areia',
    dot: 'bg-areia ring-1 ring-foreground/30',
    label: () => m.home_trust_estimate(),
  },
  missing: {
    bar: 'border-2 border-foreground/50 border-dashed bg-card',
    dot: 'border-2 border-foreground/60 border-dashed',
    label: () => m.home_trust_missing(),
  },
};

const ITEM_LABEL: Record<TrustKey, () => string> = {
  collected: () => m.home_trust_collected(),
  destinations: () => m.home_trust_destinations(),
  circuits: () => m.home_trust_circuits(),
  population: () => m.home_trust_population(),
  boundaries: () => m.home_trust_boundaries(),
  municipal_containers: () => m.home_trust_municipal(),
  potential: () => m.home_trust_potential(),
  parish_demand: () => m.home_trust_demand(),
  costs: () => m.home_trust_costs(),
  capture_by_parish: () => m.home_trust_capture(),
  textile_containers: () => m.home_trust_textile(),
};

const ORDER: TrustStatus[] = ['measured', 'estimate', 'missing'];

/** Barra «medido / estimativa / em falta»: o que a Vitrus enviou, o que se estima e o que está por receber. */
export function TrustBar({ items }: { items: TrustItem[] }) {
  const counts = trustCounts(items);
  const [open, setOpen] = useState(false);
  const panel = useId();
  return (
    <div className="space-y-3">
      <div
        role="img"
        aria-label={m.home_trust_aria({
          measured: counts.measured,
          estimate: counts.estimate,
          missing: counts.missing,
        })}
        className="flex h-4 gap-0.5 overflow-hidden rounded-full"
      >
        {ORDER.filter((s) => counts[s] > 0).map((s) => (
          <span
            key={s}
            className={cn(STATUS_STYLE[s].bar, 'h-full basis-0')}
            style={{ flexGrow: counts[s] }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {ORDER.map((s) => (
          <li key={s} className="inline-flex items-center gap-2">
            <span className={cn('size-3.5 rounded-full', STATUS_STYLE[s].dot)} aria-hidden="true" />
            <span className="font-semibold tabular-nums">{counts[s]}</span>
            <span>{STATUS_STYLE[s].label()}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panel}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-10 items-center rounded-md px-1 text-primary text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/60"
        >
          {open ? m.home_trust_hide() : m.home_trust_show()}
        </button>
        <Link
          to="/assumptions"
          className="inline-flex min-h-10 items-center text-primary text-sm underline-offset-4 hover:underline"
        >
          {m.home_trust_assumptions()}
        </Link>
      </div>
      {open && (
        <ul id={panel} className="grid gap-1.5 sm:grid-cols-2">
          {items.map((i) => (
            <li key={i.key} className="flex items-start gap-2 text-sm leading-snug">
              <span
                className={cn('mt-0.5 size-3.5 shrink-0 rounded-full', STATUS_STYLE[i.status].dot)}
                aria-hidden="true"
              />
              <span>
                {ITEM_LABEL[i.key]()}{' '}
                <span className="text-muted-foreground">({STATUS_STYLE[i.status].label()})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
