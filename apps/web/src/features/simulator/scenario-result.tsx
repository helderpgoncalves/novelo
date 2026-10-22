import { Link } from '@tanstack/react-router';
import { forwardRef, useEffect, useMemo } from 'react';
import type { ScenarioOut, ZoneOut } from '@/client';
import { EstimateTag, Panel } from '@/components/panel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AllocationsTable } from '@/features/scenarios/allocations-table';
import { CollectionPlanSection } from '@/features/scenarios/collection-plan-section';
import { ModeSummaryCards } from '@/features/scenarios/mode-summary';
import { ScenarioAnchor } from '@/features/scenarios/scenario-anchor';
import { ScenarioKpis, ScenarioSecondaryKpis } from '@/features/scenarios/scenario-kpis';
import { ScenarioMap } from '@/features/scenarios/scenario-map';
import { SitesTable } from '@/features/scenarios/sites-table';
import { SitingOverview } from '@/features/scenarios/siting-overview';
import { formatEur, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { ALL_MODES, modeLabel } from '@/lib/scenario';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { allocationsToCsv, downloadCsv } from './export-csv';
import { type RunStatus, StatusChip } from './run-status';

interface ScenarioResultProps {
  scenario: ScenarioOut;
  zones: ZoneOut[];
  status: RunStatus;
  onMount?: () => void;
}

/** Resultado do cenário calculado: comparação, KPIs, mapa, porquê e tabela de freguesias. */
export const ScenarioResult = forwardRef<HTMLElement, ScenarioResultProps>(function ScenarioResult(
  { scenario, zones, status, onMount },
  ref,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: só na primeira montagem
  useEffect(() => onMount?.(), []);
  const { result } = scenario;
  const { kpis } = result;
  const infeasible = scenario.status === 'infeasible';

  return (
    <section
      ref={ref}
      id="resultado"
      tabIndex={-1}
      aria-labelledby="resultado-title"
      className="scroll-mt-20 space-y-6 outline-none sm:space-y-8"
    >
      <header className="space-y-3">
        <p className="eyebrow">{m.simx_res_eyebrow()}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 id="resultado-title" className="min-w-0 text-balance text-[1.6rem] sm:text-3xl">
            {scenario.label}
          </h2>
          <StatusChip status={status} />
        </div>
        <p className="text-muted-foreground text-sm">{m.simx_res_saved()}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="h-10">
            <Link to="/scenarios/$scenarioId" params={{ scenarioId: scenario.id }}>
              {m.simx_res_open()}
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-10">
            <Link to="/scenarios/compare" search={{ a: scenario.id }}>
              {m.simx_res_compare()}
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() =>
              downloadCsv(
                `novelo-${scenario.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`,
                allocationsToCsv(result.allocations),
              )
            }
          >
            {m.simx_res_export()}
          </Button>
        </div>
      </header>

      {status === 'stale' && (
        <Alert>
          <AlertDescription>{m.simx_res_stale()}</AlertDescription>
        </Alert>
      )}
      {infeasible && (
        <Alert variant="destructive">
          <AlertTitle>{m.scenario_infeasible_title()}</AlertTitle>
          <AlertDescription>{m.scenario_infeasible_text()}</AlertDescription>
        </Alert>
      )}

      <Comparison scenario={scenario} />

      <div className="space-y-3">
        <ScenarioKpis kpis={kpis} bySites={Boolean(result.siting)} />
        <ScenarioSecondaryKpis kpis={kpis} routes={result.routes.length} />
      </div>

      {result.siting && <SitingOverview siting={result.siting} sites={result.sites ?? []} />}

      <ScenarioAnchor scenario={scenario} />

      <Panel title={m.scenario_map_title()} className="space-y-3">
        <ScenarioMap
          zones={zones}
          result={result}
          showRoutes
          className="h-[22rem] overflow-hidden rounded-lg ring-1 ring-foreground/10 sm:h-[30rem] lg:h-[34rem]"
        />
      </Panel>

      <CollectionPlanSection
        plan={result.collection_plan}
        kpis={result.kpis}
        scenarioId={scenario.id}
      />

      <Why scenario={scenario} />

      {result.siting && (
        <section className="space-y-3" aria-labelledby="sites-title">
          <div className="space-y-1">
            <h3 id="sites-title" className="text-xl">
              {m.site_title()}
            </h3>
            <p className="text-muted-foreground text-sm">{m.site_description()}</p>
          </div>
          <SitesTable sites={result.sites ?? []} />
        </section>
      )}

      <section className="space-y-3" aria-labelledby="alloc-title">
        <h3 id="alloc-title" className="text-xl">
          {m.scenario_alloc_title()}
        </h3>
        <AllocationsTable allocations={result.allocations} />
      </section>
    </section>
  );
});

/** Barras horizontais: 2025, este cenário, meta e potencial na mesma escala, legíveis a 390 px. */
function Comparison({ scenario }: { scenario: ScenarioOut }) {
  const { kpis } = scenario.result;
  const isTarget = scenario.objective === 'min_cost' && scenario.target_tonnes != null;
  const rows = [
    {
      key: 'base',
      label: m.simx_cmp_baseline(),
      value: kpis.baseline_observed_t,
      tone: 'bg-muted-foreground/60',
    },
    { key: 'scenario', label: m.simx_cmp_scenario(), value: kpis.tonnes_year, tone: 'bg-primary' },
    ...(isTarget
      ? [
          {
            key: 'target',
            label: m.simx_cmp_target(),
            value: scenario.target_tonnes ?? 0,
            tone: 'bg-areia',
          },
        ]
      : []),
    { key: 'potential', label: m.simx_cmp_potential(), value: kpis.potential_t, tone: 'bg-border' },
  ];
  const max = Math.max(...rows.map((r) => r.value), 1);
  const delta = kpis.tonnes_year - kpis.baseline_observed_t;
  const met = isTarget && kpis.tonnes_year + 0.05 >= (scenario.target_tonnes ?? 0);
  const budget = scenario.objective === 'max_tonnes' ? scenario.budget_eur_year : null;
  const within = budget != null && kpis.annual_cost_eur <= budget + 1;

  return (
    <Panel
      title={m.simx_cmp_title()}
      aside={<EstimateTag label={m.common_estimate()} />}
      className="space-y-4"
    >
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.key} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className={cn(r.key === 'scenario' && 'font-semibold')}>{r.label}</span>
              <span className="font-medium tabular-nums">{formatTonnes(r.value)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className={cn('h-full rounded-full', r.tone)}
                style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-sm">
        <p className="font-medium tabular-nums">
          {m.simx_cmp_delta({ delta: `${delta >= 0 ? '+' : ''}${formatTonnes(delta)}` })}
        </p>
        {isTarget && (
          <p className={cn('font-medium', met ? 'text-primary' : 'text-destructive')}>
            {met ? m.simx_cmp_met() : m.simx_cmp_missed()}
          </p>
        )}
        {budget != null && (
          <p
            className={cn('font-medium tabular-nums', within ? 'text-primary' : 'text-destructive')}
          >
            {within ? m.simx_cmp_within() : m.simx_cmp_over()}:{' '}
            {`${formatEur(kpis.annual_cost_eur)} / ${formatEur(budget)}`}
          </p>
        )}
      </div>
    </Panel>
  );
}

/** Porquê estas escolhas: frases escritas só com números do resultado do otimizador. */
function Why({ scenario }: { scenario: ScenarioOut }) {
  const { result } = scenario;
  const reasons = useMemo(() => {
    const used = result.modes.filter((x) => x.tonnes > 0);
    const out: string[] = [];
    const top = [...used].sort((a, b) => b.tonnes - a.tonnes)[0];
    if (top && result.kpis.tonnes_year > 0) {
      out.push(
        m.simx_why_top({
          mode: modeLabel[top.mode](),
          tonnes: formatTonnes(top.tonnes),
          share: formatPercent((top.tonnes / result.kpis.tonnes_year) * 100, 0),
          zones: formatNumber(top.zones),
        }),
      );
    }
    const cheapest = [...used].sort(
      (a, b) => a.annual_cost_eur / a.tonnes - b.annual_cost_eur / b.tonnes,
    )[0];
    if (cheapest && used.length > 1) {
      out.push(
        m.simx_why_cheapest({
          mode: modeLabel[cheapest.mode](),
          eurT: `${formatNumber(cheapest.annual_cost_eur / cheapest.tonnes)} €/t`,
        }),
      );
    }
    const idle = result.allocations.filter((a) => a.modes.length === 0).length;
    if (idle === 1) out.push(m.simx_why_idle_one());
    else if (idle > 1) out.push(m.simx_why_idle({ n: formatNumber(idle) }));
    return out;
  }, [result]);

  return (
    <section className="space-y-3" aria-labelledby="why-title">
      <div className="space-y-1">
        <h3 id="why-title" className="text-xl">
          {m.simx_why_title()}
        </h3>
        <p className="text-muted-foreground text-sm">{m.simx_why_text()}</p>
        <p className="text-muted-foreground text-xs">
          {m.simx_allowed_modes({
            modes: (result.default_modes ?? ALL_MODES).map((mode) => modeLabel[mode]()).join(' · '),
          })}
        </p>
      </div>
      {reasons.length > 0 && (
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed marker:text-primary">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <ModeSummaryCards modes={result.modes} totalTonnes={result.kpis.tonnes_year} />
      <Panel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-medium">{m.simx_deeper_title()}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="h-10">
            <Link
              to="/scenarios/$scenarioId"
              params={{ scenarioId: scenario.id }}
              search={{ tab: 'uncertainty' }}
            >
              {m.simx_open_uncertainty()}
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-10">
            <Link
              to="/scenarios/$scenarioId"
              params={{ scenarioId: scenario.id }}
              search={{ tab: 'whatif' }}
            >
              {m.simx_open_whatif()}
            </Link>
          </Button>
        </div>
      </Panel>
    </section>
  );
}
