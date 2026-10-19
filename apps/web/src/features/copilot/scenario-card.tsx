import { Link } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import type { ScenarioCard as ScenarioCardData } from '@/client';
import { Badge } from '@/components/ui/badge';
import { formatEur, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
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

/** Cartão de um cenário devolvido pelo copiloto: os números vêm do otimizador, não do texto do modelo. */
export function CopilotScenarioCard({ card }: { card: ScenarioCardData }) {
  const { kpis } = card;
  return (
    <article className="overflow-hidden rounded-xl border bg-card" aria-label={card.label}>
      <header className="flex flex-wrap items-center gap-2 px-3 pt-3">
        <h3 className="min-w-0 flex-1 truncate font-sans font-semibold text-sm">{card.label}</h3>
        {card.created_now && (
          <Badge className="font-semibold text-[10px] uppercase tracking-wider">
            {m.copilot_card_created()}
          </Badge>
        )}
      </header>
      <dl className="mt-3 grid grid-cols-2 gap-px bg-border">
        <Kpi label={m.copilot_card_tonnes()} value={formatTonnes(kpis.tonnes_year)} />
        <Kpi label={m.copilot_card_cost()} value={formatEur(kpis.annual_cost_eur)} />
        <Kpi
          label={m.copilot_card_eur_per_tonne()}
          value={
            kpis.eur_per_tonne === null
              ? m.common_dash()
              : `${formatNumber(kpis.eur_per_tonne)} €/t`
          }
        />
        <Kpi label={m.copilot_card_coverage()} value={formatPercent(kpis.coverage_pct)} />
      </dl>
      <Link
        to="/scenarios/$scenarioId"
        params={{ scenarioId: card.scenario_id }}
        className="flex min-h-10 items-center justify-between gap-2 px-3 font-medium text-primary text-sm hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
      >
        {m.copilot_card_open()}
        <ArrowUpRight className="size-4" aria-hidden="true" />
      </Link>
    </article>
  );
}
