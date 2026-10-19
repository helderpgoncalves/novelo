import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import type { AiCreditsOut, BudgetOut, UsageGroup } from '@/client';
import { getAiCreditsOptions, getAiUsageOptions } from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { Section } from '@/components/page';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { EmptyState, ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { formatCompact, formatMs, formatUsd, labelForTask } from './ai';
import { DailyCostChart } from './daily-cost-chart';

const PERIODS = ['7', '30', '90'] as const;

export function OverviewTab({
  days,
  onDaysChange,
}: {
  days: number;
  onDaysChange: (days: number) => void;
}) {
  const usage = useQuery(getAiUsageOptions({ query: { days } }));
  const credits = useQuery({ ...getAiCreditsOptions(), retry: false });

  const c = credits.data;
  const balance = c?.available
    ? (c.limit_remaining_usd ??
      (c.total_credits_usd !== null && c.total_usage_usd !== null
        ? c.total_credits_usd - c.total_usage_usd
        : null))
    : null;
  const u = usage.data;

  return (
    <div className="space-y-8">
      <StatStrip>
        <StatCell
          label={m.aiadm_stat_balance()}
          value={credits.isPending ? '…' : balance !== null ? formatUsd(balance, 2) : '—'}
          hint={
            credits.isPending
              ? m.common_loading()
              : balance !== null
                ? c?.limit_usd != null
                  ? m.aiadm_stat_balance_limit({ limit: formatUsd(c.limit_usd, 2) })
                  : m.aiadm_stat_balance_hint()
                : m.aiadm_credits_unavailable()
          }
        />
        <StatCell
          label={m.aiadm_stat_month()}
          value={u ? formatUsd(u.month.spent_usd) : '…'}
          hint={u ? budgetHint(u.month) : m.common_loading()}
        />
        <StatCell
          label={m.aiadm_stat_calls()}
          value={u ? formatNumber(u.totals.calls) : '…'}
          hint={u ? m.aiadm_stat_calls_hint({ days: u.days, errors: u.totals.errors }) : undefined}
        />
        <StatCell
          label={m.aiadm_stat_latency()}
          value={u ? formatMs(u.totals.avg_latency_ms) : '…'}
          hint={
            u
              ? m.aiadm_stat_tokens_hint({
                  input: formatCompact(u.totals.prompt_tokens),
                  output: formatCompact(u.totals.completion_tokens),
                })
              : undefined
          }
        />
      </StatStrip>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-4">
          <Section title={m.aiadm_budget_title()} description={m.aiadm_budget_desc()}>
            {usage.isPending ? (
              <Skeleton className="h-36 w-full rounded-xl" />
            ) : usage.isError ? (
              <ErrorState error={usage.error} onRetry={() => usage.refetch()} />
            ) : (
              <BudgetCard budget={usage.data.month} />
            )}
          </Section>
          <Section title={m.aiadm_credits_title()}>
            <CreditsCard query={credits} />
          </Section>
        </div>

        <Section
          className="lg:col-span-8"
          title={m.aiadm_chart_title()}
          description={m.aiadm_chart_desc()}
          actions={
            <Select value={String(days)} onValueChange={(v) => onDaysChange(Number(v))}>
              <SelectTrigger className="h-10 w-44" aria-label={m.aiadm_period_label()}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {m.aiadm_period_days({ days: Number(p) })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        >
          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
            {usage.isPending ? (
              <Skeleton className="h-64 w-full sm:h-72" />
            ) : usage.isError ? (
              <ErrorState error={usage.error} onRetry={() => usage.refetch()} />
            ) : usage.data.totals.calls === 0 ? (
              <EmptyState
                title={m.aiadm_usage_empty_title()}
                description={m.aiadm_usage_empty_desc()}
              />
            ) : (
              <DailyCostChart days={usage.data.by_day} />
            )}
          </div>
        </Section>
      </div>

      <div className="space-y-8">
        <Section title={m.aiadm_by_task_title()} description={m.aiadm_by_task_desc()}>
          <UsageTable id="ai-usage-task" groups={usage.data?.by_task} kind="task" query={usage} />
        </Section>
        <Section title={m.aiadm_by_model_title()} description={m.aiadm_by_model_desc()}>
          <UsageTable
            id="ai-usage-model"
            groups={usage.data?.by_model}
            kind="model"
            query={usage}
          />
        </Section>
      </div>
    </div>
  );
}

function budgetHint(b: BudgetOut): string {
  return b.state === 'unlimited' || b.monthly_budget_usd === null
    ? m.aiadm_budget_unlimited()
    : m.aiadm_budget_of({ limit: formatUsd(b.monthly_budget_usd, 2) });
}

const STATE_LABEL: Record<BudgetOut['state'], () => string> = {
  unlimited: () => m.aiadm_budget_state_unlimited(),
  ok: () => m.aiadm_budget_state_ok(),
  warning: () => m.aiadm_budget_state_warning(),
  exceeded: () => m.aiadm_budget_state_exceeded(),
};

const STATE_BAR: Record<BudgetOut['state'], string> = {
  unlimited: '[&_[data-slot=progress-indicator]]:bg-muted-foreground',
  ok: '[&_[data-slot=progress-indicator]]:bg-primary',
  warning: '[&_[data-slot=progress-indicator]]:bg-areia',
  exceeded: '[&_[data-slot=progress-indicator]]:bg-destructive',
};

function BudgetCard({ budget }: { budget: BudgetOut }) {
  const pct = Math.min(100, budget.used_pct ?? 0);
  return (
    <div className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium font-serif text-3xl tabular-nums">
          {formatUsd(budget.spent_usd)}
        </p>
        <Badge
          variant={budget.state === 'exceeded' ? 'destructive' : 'outline'}
          className={cn(budget.state === 'warning' && 'border-areia text-foreground')}
        >
          {STATE_LABEL[budget.state]()}
        </Badge>
      </div>
      {budget.state !== 'unlimited' && (
        <Progress
          value={pct}
          aria-label={m.aiadm_budget_title()}
          className={cn('h-2.5 bg-muted', STATE_BAR[budget.state])}
        />
      )}
      <p className="text-muted-foreground text-sm">
        {budget.state === 'unlimited' || budget.monthly_budget_usd === null
          ? m.aiadm_budget_unlimited()
          : m.aiadm_budget_used({
              pct: formatPercent(budget.used_pct ?? 0, 0),
              limit: formatUsd(budget.monthly_budget_usd, 2),
              warn: formatPercent(budget.warn_pct, 0),
            })}
      </p>
    </div>
  );
}

function CreditsCard({ query }: { query: UseQueryResult<AiCreditsOut, unknown> }) {
  if (query.isPending) return <Skeleton className="h-32 w-full rounded-xl" />;
  const c = query.data;
  if (query.isError || !c || !c.available) {
    return (
      <div className="space-y-1 rounded-xl border border-dashed p-5 text-sm">
        <p className="font-medium">{m.aiadm_credits_unavailable()}</p>
        <p className="text-muted-foreground">
          {c?.message ??
            (query.isError ? m.aiadm_credits_error() : m.aiadm_credits_unavailable_hint())}
        </p>
      </div>
    );
  }
  const rows: [string, number | null][] = [
    [m.aiadm_credits_total(), c.total_credits_usd],
    [m.aiadm_credits_used(), c.total_usage_usd],
    [m.aiadm_credits_key_usage(), c.key_usage_usd],
    [m.aiadm_credits_limit(), c.limit_usd],
    [m.aiadm_credits_remaining(), c.limit_remaining_usd],
  ];
  return (
    <dl className="divide-y divide-border rounded-xl bg-card px-5 ring-1 ring-foreground/10">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium tabular-nums">{value === null ? '—' : formatUsd(value, 2)}</dd>
        </div>
      ))}
      {c.is_free_tier && (
        <div className="py-2.5 text-sm">
          <Badge variant="secondary">{m.aiadm_credits_free_tier()}</Badge>
        </div>
      )}
    </dl>
  );
}

function UsageTable({
  id,
  groups,
  kind,
  query,
}: {
  id: string;
  groups: UsageGroup[] | undefined;
  kind: 'task' | 'model';
  query: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
}) {
  if (query.isPending) return <Skeleton className="h-56 w-full rounded-xl" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const columns: Column<UsageGroup>[] = [
    {
      id: 'name',
      header: kind === 'task' ? m.aiadm_col_task() : m.aiadm_col_model(),
      primary: true,
      value: (g) => (kind === 'task' ? labelForTask(g.task) : (g.model ?? '—')),
      cell: (g) => (
        <span className={cn('break-words font-medium', kind === 'model' && 'font-mono text-xs')}>
          {kind === 'task' ? labelForTask(g.task) : (g.model ?? '—')}
        </span>
      ),
    },
    {
      id: 'calls',
      header: m.aiadm_col_calls(),
      align: 'right',
      value: (g) => g.calls,
      cell: (g) => formatNumber(g.calls),
    },
    {
      id: 'cost',
      header: m.aiadm_col_cost(),
      align: 'right',
      badge: true,
      value: (g) => g.cost_usd,
      cell: (g) => formatUsd(g.cost_usd),
    },
    {
      id: 'tokens',
      header: m.aiadm_col_tokens(),
      align: 'right',
      desktopOnly: true,
      value: (g) => g.prompt_tokens + g.completion_tokens,
      cell: (g) => formatCompact(g.prompt_tokens + g.completion_tokens),
    },
    {
      id: 'latency',
      header: m.aiadm_col_latency(),
      align: 'right',
      value: (g) => g.avg_latency_ms,
      cell: (g) => formatMs(g.avg_latency_ms),
    },
    {
      id: 'errors',
      header: m.aiadm_col_errors(),
      align: 'right',
      value: (g) => g.errors,
      cell: (g) => formatNumber(g.errors),
    },
  ];

  return (
    <DataTable
      id={id}
      columns={columns}
      rows={groups ?? []}
      getKey={(g) => (kind === 'task' ? (g.task ?? '') : (g.model ?? ''))}
      controls="never"
      initialSort={{ id: 'cost', desc: true }}
      empty={
        <EmptyState title={m.aiadm_usage_empty_title()} description={m.aiadm_usage_empty_desc()} />
      }
    />
  );
}
