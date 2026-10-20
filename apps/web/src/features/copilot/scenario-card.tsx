import { Link } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import type { ScenarioCard as ScenarioCardData, ScenarioCardSpec } from '@/client';
import { Badge } from '@/components/ui/badge';
import { formatEur, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-0.5 bg-card px-3 py-2.5">
      <dt className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
        {label}
      </dt>
      <dd className="font-medium font-serif text-lg tabular-nums leading-tight">{value}</dd>
    </div>
  );
}

interface CardProps {
  scenarioId: string;
  label: string;
  createdNow: boolean;
  tonnes: number;
  cost: number;
  eurPerTonne: number | null;
  coverage: number;
}

export const fromCard = (c: ScenarioCardData): CardProps => ({
  scenarioId: c.scenario_id,
  label: c.label,
  createdNow: c.created_now,
  tonnes: c.kpis.tonnes_year,
  cost: c.kpis.annual_cost_eur,
  eurPerTonne: c.kpis.eur_per_tonne,
  coverage: c.kpis.coverage_pct,
});

export const fromSpec = (s: ScenarioCardSpec): CardProps => ({
  scenarioId: s.scenario_id,
  label: s.label,
  createdNow: s.created_now ?? false,
  tonnes: s.tonnes_year,
  cost: s.annual_cost_eur,
  eurPerTonne: s.eur_per_tonne,
  coverage: s.coverage_pct,
});

/** Cartão de um cenário: os números vêm do otimizador, não do texto do modelo. */
export function CopilotScenarioCard({ card, bleed }: { card: CardProps; bleed?: boolean }) {
  return (
    <article
      className={cn(
        'overflow-hidden border bg-card',
        bleed ? '-mx-4 rounded-none border-x-0 sm:mx-0 sm:rounded-xl sm:border-x' : 'rounded-xl',
      )}
      aria-label={card.label}
    >
      <header className="flex flex-wrap items-center gap-2 px-3 pt-3">
        <h3 className="min-w-0 flex-1 truncate font-sans font-semibold text-sm">{card.label}</h3>
        {card.createdNow && (
          <Badge className="font-semibold text-[10px] uppercase tracking-wider">
            {m.copilot_card_created()}
          </Badge>
        )}
      </header>
      <dl className="mt-3 grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        <Kpi label={m.copilot_card_tonnes()} value={formatTonnes(card.tonnes)} />
        <Kpi label={m.copilot_card_cost()} value={formatEur(card.cost)} />
        <Kpi
          label={m.copilot_card_eur_per_tonne()}
          value={
            card.eurPerTonne === null ? m.common_dash() : `${formatNumber(card.eurPerTonne)} €/t`
          }
        />
        <Kpi label={m.copilot_card_coverage()} value={formatPercent(card.coverage)} />
      </dl>
      <Link
        to="/scenarios/$scenarioId"
        params={{ scenarioId: card.scenarioId }}
        className="flex min-h-10 items-center justify-between gap-2 px-3 font-medium text-primary text-sm hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
      >
        {m.copilot_card_open()}
        <ArrowUpRight className="size-4" aria-hidden="true" />
      </Link>
    </article>
  );
}
