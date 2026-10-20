import { useQuery } from '@tanstack/react-query';
import type { TriageEvalModel } from '@/client';
import { getTriageEvalOptions } from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { Section } from '@/components/page';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { EmptyState, ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber, formatPercent } from '@/lib/format';
import { formatDateTime } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { formatSeconds, formatUsd } from './ai';

const FIELDS = [
  ['garment_type', () => m.aiadm_eval_garment()],
  ['condition', () => m.aiadm_eval_condition()],
  ['brand', () => m.aiadm_eval_brand()],
  ['dominant_fibre', () => m.aiadm_eval_fibre()],
  ['composition_within_10pp', () => m.aiadm_eval_composition()],
] as const;

const mean = (model: TriageEvalModel): number => {
  const values = Object.values(model.accuracy);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
};

const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code: unknown }).code === 'not_found';

export function TriageEvalTab() {
  const report = useQuery({ ...getTriageEvalOptions(), retry: false });

  if (report.isPending) {
    return (
      <div className="space-y-6" aria-busy="true">
        <span className="sr-only">{m.common_loading()}</span>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (report.isError) {
    return isNotFound(report.error) ? (
      <EmptyState
        title={m.aiadm_eval_empty_title()}
        description={m.aiadm_eval_empty_desc()}
        action={
          <code className="rounded-md bg-muted px-3 py-1.5 font-mono text-sm">
            just eval-triage
          </code>
        }
      />
    ) : (
      <ErrorState error={report.error} onRetry={() => report.refetch()} />
    );
  }

  const data = report.data;
  const best = [...data.models].sort((a, b) => mean(b) - mean(a))[0];

  const columns: Column<TriageEvalModel>[] = [
    {
      id: 'model',
      header: m.aiadm_col_model(),
      primary: true,
      value: (r) => r.model,
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="break-all font-medium font-mono text-xs">{r.model}</span>
          {best && r.model === best.model && data.models.length > 1 && (
            <Badge variant="secondary">{m.aiadm_eval_best()}</Badge>
          )}
        </span>
      ),
    },
    {
      id: 'mean',
      header: m.aiadm_eval_mean(),
      align: 'right',
      badge: true,
      value: (r) => mean(r),
      cell: (r) => <strong>{formatPercent(mean(r) * 100, 0)}</strong>,
    },
    ...FIELDS.map(
      ([key, label]): Column<TriageEvalModel> => ({
        id: key,
        header: label(),
        align: 'right',
        value: (r) => r.accuracy[key] ?? null,
        cell: (r) =>
          r.accuracy[key] === undefined ? '—' : formatPercent(r.accuracy[key] * 100, 0),
      }),
    ),
    {
      id: 'cost',
      header: m.aiadm_eval_cost_piece(),
      align: 'right',
      value: (r) => r.avg_cost_usd,
      cell: (r) => (r.avg_cost_usd === null ? '—' : formatUsd(r.avg_cost_usd)),
    },
    {
      id: 'latency',
      header: m.aiadm_eval_latency(),
      align: 'right',
      value: (r) => r.avg_latency_s,
      cell: (r) => `${formatSeconds(r.avg_latency_s)} (p95 ${formatSeconds(r.p95_latency_s)})`,
    },
    {
      id: 'failures',
      header: m.aiadm_col_errors(),
      align: 'right',
      value: (r) => r.failures,
      cell: (r) => formatNumber(r.failures),
    },
  ];

  return (
    <div className="space-y-8">
      <StatStrip>
        <StatCell label={m.aiadm_eval_stat_images()} value={formatNumber(data.images)} />
        <StatCell label={m.aiadm_eval_stat_models()} value={formatNumber(data.models.length)} />
        <StatCell
          label={m.aiadm_eval_stat_best()}
          value={best ? formatPercent(mean(best) * 100, 0) : '—'}
          hint={best?.model}
          tone="primary"
        />
        <StatCell
          label={m.aiadm_eval_stat_prompt()}
          value={data.prompt_version}
          hint={m.aiadm_eval_generated({ date: formatDateTime(data.generated_at) })}
        />
      </StatStrip>
      <Section title={m.aiadm_eval_title()} description={m.aiadm_eval_desc()}>
        <DataTable
          id="ai-triage-eval"
          columns={columns}
          rows={data.models}
          getRowId={(r) => r.model}
          controls="never"
          initialSort={{ id: 'mean', desc: true }}
          empty={
            <EmptyState
              title={m.aiadm_eval_empty_title()}
              description={m.aiadm_eval_empty_desc()}
            />
          }
        />
      </Section>
    </div>
  );
}
