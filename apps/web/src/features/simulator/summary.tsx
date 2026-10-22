import type { ReactNode } from 'react';
import type { ScenarioOut } from '@/client';
import { EstimateTag, Panel } from '@/components/panel';
import { Button } from '@/components/ui/button';
import { WorkingState } from '@/components/working-state';
import { formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { type RunStatus, StatusChip } from './run-status';

export interface SummaryData {
  goalLabel: string;
  valueLabel: string;
  valueText: string;
  potentialText: string;
  locationsText: string;
  networkText: string;
  /** Nota por baixo do botão: muda com a rede escolhida. */
  runNote: string;
  restrictionsText: string;
  assumptionsText: string;
  problems: string[];
}

export interface RunControl {
  status: RunStatus;
  pending: boolean;
  elapsed: number;
  onCancel: () => void;
  /** Rede por locais reais: mostra as fases do cálculo (escolha dos locais, rotas, orçamento). */
  bySites?: boolean;
  result?: ScenarioOut;
  onSeeResult: () => void;
}

/** Fases estimadas pelo tempo decorrido (o servidor não envia progresso): o cálculo por locais demora 20 a 40 s. */
function phaseLabel(run: RunControl): string {
  if (!run.bySites) return m.simx_running_label();
  if (run.elapsed < 8) return m.simx_phase_sites();
  if (run.elapsed < 20) return m.simx_phase_routes();
  return m.simx_phase_budget();
}

/** Barra de progresso estimada: sobe depressa e abranda, nunca chega a 100% antes de acabar. */
function EstimatedBar({ elapsed }: { elapsed: number }) {
  const pct = Math.round((1 - Math.exp(-elapsed / 18)) * 94);
  return (
    <div
      role="progressbar"
      aria-label={m.simx_running_label()}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-1 w-full overflow-hidden rounded-full bg-border"
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-out motion-reduce:transition-none"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

const ctaLabel = (status: RunStatus) =>
  status === 'done' || status === 'stale' || status === 'infeasible'
    ? m.simx_run_again()
    : m.sim_run();

/** Botão primário e, a correr, o estado real: tempo decorrido e cancelar. Sem ícone decorativo. */
export function RunButton({
  run,
  className,
  hint,
  compact,
}: {
  run: RunControl;
  className?: string;
  hint?: boolean;
  compact?: boolean;
}) {
  if (run.pending && compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="min-w-0 flex-1 space-y-2">
          <WorkingState
            size="sm"
            title={phaseLabel(run)}
            elapsed={run.elapsed}
            className="justify-start"
          />
          <EstimatedBar elapsed={run.elapsed} />
        </div>
        <Button type="button" variant="outline" className="h-11 shrink-0" onClick={run.onCancel}>
          {m.simx_cancel()}
        </Button>
      </div>
    );
  }
  if (run.pending) {
    return (
      <div className={cn('space-y-3', className)}>
        <WorkingState
          size="sm"
          title={phaseLabel(run)}
          elapsed={run.elapsed}
          className="justify-start"
        />
        <EstimatedBar elapsed={run.elapsed} />
        <Button type="button" variant="outline" className="h-11 w-full" onClick={run.onCancel}>
          {m.simx_cancel()}
        </Button>
      </div>
    );
  }
  return (
    <div className={cn('space-y-1.5', className)}>
      <Button type="submit" className="h-11 w-full font-semibold">
        {ctaLabel(run.status)}
      </Button>
      {hint && (
        <p className="hidden text-center text-muted-foreground text-xs lg:block">
          {m.simx_shortcut_hint()}
        </p>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium tabular-nums">{children}</dd>
    </div>
  );
}

/** Resumo vivo para ecrãs largos: o que vai ser calculado, avisos e o último resultado. */
export function SummaryPanel({ data, run }: { data: SummaryData; run: RunControl }) {
  const { result } = run;
  const kpis = result?.result.kpis;
  return (
    <Panel
      title={m.simx_sum_title()}
      aside={<StatusChip status={run.status} />}
      className="space-y-5"
    >
      <dl className="space-y-2.5 text-sm">
        <Row label={m.simx_sum_goal()}>{data.goalLabel}</Row>
        <Row label={data.valueLabel}>{data.valueText}</Row>
        <Row label={m.sim_summary_potential()}>
          {data.potentialText} <EstimateTag label={m.common_estimate()} />
        </Row>
        <Row label={m.site_net_label()}>{data.networkText}</Row>
        <Row label={m.simx_sum_locations()}>{data.locationsText}</Row>
        <Row label={m.sim_summary_constraints()}>{data.restrictionsText}</Row>
        <Row label={m.sim_summary_assumptions()}>{data.assumptionsText}</Row>
      </dl>

      {data.problems.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-destructive/5 p-3 text-destructive text-xs">
          {data.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {kpis && result && (
        <div className="space-y-2 border-t pt-4">
          <p className="flex items-center justify-between gap-2 font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
            {m.simx_sum_last()}
            <EstimateTag label={m.common_estimate()} />
          </p>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <MiniKpi label={m.kpi_tonnes()} value={formatTonnes(kpis.tonnes_year)} />
            <MiniKpi
              label={m.kpi_eur_per_tonne()}
              value={
                kpis.eur_per_tonne == null
                  ? m.common_dash()
                  : `${formatNumber(kpis.eur_per_tonne)} €/t`
              }
            />
            <MiniKpi
              label={m.simx_kpi_capture()}
              value={formatPercent(
                kpis.potential_t > 0 ? (kpis.tonnes_year / kpis.potential_t) * 100 : 0,
                1,
              )}
            />
          </dl>
          {run.status === 'stale' && (
            <p className="text-muted-foreground text-xs">{m.simx_stale_note()}</p>
          )}
          <button
            type="button"
            onClick={run.onSeeResult}
            className="min-h-10 font-medium text-primary text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            {m.simx_sum_see_result()}
          </button>
        </div>
      )}

      <RunButton run={run} hint />
      {!run.pending && <p className="text-muted-foreground text-xs">{data.runNote}</p>}
    </Panel>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-1 rounded-lg bg-muted/60 px-1.5 py-2">
      <dt className="text-balance text-[10px] text-muted-foreground leading-tight">{label}</dt>
      <dd className="font-medium font-serif text-base tabular-nums">{value}</dd>
    </div>
  );
}

/** Barra inferior em telemóvel: o essencial do cenário e o botão, sempre ao alcance do polegar. */
export function SummaryBar({ data, run }: { data: SummaryData; run: RunControl }) {
  if (run.pending) {
    return <RunButton run={run} compact />;
  }
  const problem = data.problems[0];
  const kpis = run.result?.result.kpis;
  const detail =
    problem ??
    (kpis && run.status !== 'draft'
      ? `${formatTonnes(kpis.tonnes_year)} · ${
          kpis.eur_per_tonne == null ? m.common_dash() : `${formatNumber(kpis.eur_per_tonne)} €/t`
        }`
      : m.simx_bar_potential({ value: data.potentialText }));
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-medium text-sm tabular-nums" title={data.valueText}>
          {data.valueText}
        </p>
        <p className="flex items-center gap-2">
          {run.status !== 'draft' && <StatusChip status={run.status} className="shrink-0" />}
          <span
            title={detail}
            className={cn(
              'min-w-0 truncate text-xs',
              problem ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {detail}
          </span>
        </p>
      </div>
      <Button type="submit" className="h-11 shrink-0 px-5 font-semibold">
        {ctaLabel(run.status)}
      </Button>
    </div>
  );
}
