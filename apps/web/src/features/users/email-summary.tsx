import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, MailCheck, RefreshCw, Send, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  getEmailOptions,
  getEmailSummaryOptions,
  refreshEmailStatusMutation,
  sendTestEmailMutation,
} from '@/client/@tanstack/react-query.gen';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { ErrorState } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getErrorMessage } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { invalidateAdminQueries } from './cache';
import { DeliveryBadge } from './delivery-badge';
import {
  acceptedCount,
  alertCopy,
  delayText,
  errorText,
  failedCount,
  isFinalStatus,
  successRateText,
  type TestOutcome,
  testOutcome,
  trackingCopy,
} from './email-logic';

const OUTCOME_TEXT: Record<TestOutcome, () => string> = {
  waiting: () => m.email_test_waiting(),
  ok: () => m.email_test_final_ok(),
  sent: () => m.email_test_final_sent(),
  bad: () => m.email_test_final_bad(),
};

/** O email de teste a evoluir: consulta o envio a cada 3 s até ter um estado final (ou 2 min). */
function TestResult({ id, confirmed }: { id: string; confirmed: boolean }) {
  const [startedAt] = useState(() => Date.now());
  const delivery = useQuery({
    ...getEmailOptions({ path: { delivery_id: id } }),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && isFinalStatus(status, confirmed)) return false;
      return Date.now() - startedAt > 120_000 ? false : 3_000;
    },
  });
  const data = delivery.data;
  if (delivery.isError) return <ErrorState error={delivery.error} onRetry={delivery.refetch} />;
  if (!data) return <Skeleton className="h-16 w-full rounded-xl" />;
  const outcome = testOutcome(data.status, confirmed);
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="email-test-result"
      className="flex flex-wrap items-start gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
    >
      <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-medium text-sm">{m.email_test_title()}</p>
        <DeliveryBadge status={data.status} at={data.updated_at} error={data.error_code} />
        <p className="text-muted-foreground text-sm leading-relaxed">{OUTCOME_TEXT[outcome]()}</p>
        {data.error_code && outcome === 'bad' && (
          <p className="text-sm leading-relaxed">{errorText(data.error_code)}</p>
        )}
      </div>
    </div>
  );
}

/** Resumo dos emails: alertas com a correção, o que sabemos de cada envio, números e as ações «Atualizar» e «Teste». */
export function EmailSummaryPanel() {
  const queryClient = useQueryClient();
  const summary = useQuery({ ...getEmailSummaryOptions(), refetchInterval: 60_000 });
  const [testId, setTestId] = useState<string | null>(null);

  const refresh = useMutation({
    ...refreshEmailStatusMutation(),
    onSuccess: async (result) => {
      await invalidateAdminQueries(queryClient);
      if (result.checked === 0) toast.message(m.email_refresh_nothing());
      else
        toast.success(m.email_refresh_done({ updated: result.updated, checked: result.checked }));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const test = useMutation({
    ...sendTestEmailMutation(),
    onSuccess: async (delivery) => {
      setTestId(delivery.id);
      await invalidateAdminQueries(queryClient);
      toast.success(m.email_test_sent());
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (summary.isPending) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }
  if (summary.isError) return <ErrorState error={summary.error} onRetry={summary.refetch} />;

  const data = summary.data;
  const tracking = trackingCopy(data.delivery_tracking);
  const rate = successRateText(data.success_rate_24h_pct);
  const delay = delayText(data.avg_delivery_delay_s);
  const top = data.failures_by_error_code.slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          className="h-10 w-full sm:w-auto"
          loading={refresh.isPending}
          onClick={() => refresh.mutate({})}
        >
          <RefreshCw aria-hidden="true" />
          {m.email_refresh()}
        </Button>
        <Button
          variant="outline"
          className="h-10 w-full sm:w-auto"
          loading={test.isPending}
          onClick={() => test.mutate({})}
        >
          <Send aria-hidden="true" />
          {m.email_test_send()}
        </Button>
      </div>

      {testId && <TestResult id={testId} confirmed={tracking.confirmed} />}

      {data.alerts.length > 0 ? (
        <div className="space-y-2" data-testid="email-alerts">
          <h3 className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.14em]">
            {m.email_alerts_title()}
          </h3>
          {data.alerts.map((alert) => {
            const copy = alertCopy(alert);
            return (
              <Alert key={alert} variant="destructive" data-alert={alert}>
                <TriangleAlert />
                <AlertTitle className="line-clamp-none">{copy.title}</AlertTitle>
                <AlertDescription>{copy.fix}</AlertDescription>
              </Alert>
            );
          })}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-primary text-sm" role="status">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {m.email_alerts_none()}
        </p>
      )}

      <div
        className={
          tracking.confirmed
            ? 'flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4'
            : 'flex items-start gap-3 rounded-xl border border-areia bg-areia/20 p-4'
        }
        data-testid="email-tracking"
        data-tracking={data.delivery_tracking}
      >
        {tracking.confirmed ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        ) : (
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-sm">{tracking.title}</p>
          <p className="text-muted-foreground text-sm leading-relaxed">{tracking.text}</p>
        </div>
      </div>

      <StatStrip>
        <StatCell
          label={m.email_kpi_rate()}
          value={rate ?? m.common_dash()}
          tone={rate ? 'primary' : 'default'}
          hint={rate ? m.email_kpi_rate_hint() : m.email_kpi_rate_empty()}
        />
        <StatCell
          label={m.email_kpi_delay()}
          value={delay ?? m.common_dash()}
          hint={delay ? undefined : m.email_kpi_delay_none()}
        />
        <StatCell
          label={m.email_kpi_unconfirmed()}
          value={formatNumber(data.unconfirmed)}
          hint={tracking.confirmed ? m.email_kpi_unconfirmed_hint() : m.email_kpi_unconfirmed_na()}
        />
        <StatCell label={m.email_failures_hour()} value={formatNumber(data.failures_last_hour)} />
      </StatStrip>

      <StatStrip className="lg:grid-cols-3">
        {(
          [
            ['24 h', data.last_24h],
            ['7 d', data.last_7d],
          ] as const
        ).flatMap(([period, counts]) => [
          <StatCell
            key={`${period}-sent`}
            label={m.email_kpi_accepted()}
            tag={period === '24 h' ? m.email_kpi_period_24h() : m.email_kpi_period_7d()}
            value={formatNumber(acceptedCount(counts))}
          />,
          <StatCell
            key={`${period}-delivered`}
            label={m.email_kpi_delivered()}
            tag={period === '24 h' ? m.email_kpi_period_24h() : m.email_kpi_period_7d()}
            value={formatNumber(counts.delivered ?? 0)}
          />,
          <StatCell
            key={`${period}-failed`}
            label={m.email_kpi_failed()}
            tag={period === '24 h' ? m.email_kpi_period_24h() : m.email_kpi_period_7d()}
            value={formatNumber(failedCount(counts))}
          />,
        ])}
      </StatStrip>

      {top.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.14em]">
            {m.email_kpi_top_errors()}
          </h3>
          <ul className="space-y-1 text-sm">
            {top.map((f) => (
              <li key={f.error_code} className="flex gap-2">
                <span className="w-8 shrink-0 text-right font-medium tabular-nums">{f.count}×</span>
                <span className="min-w-0 break-words text-muted-foreground">
                  {errorText(f.error_code)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
