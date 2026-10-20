import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import type { DataAlertOut, MunicipalOverview } from '@/client';
import { getDataQualityOptions } from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { Panel, Section } from '@/components/page';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { formatNumber, formatPercent } from '@/lib/format';
import { alertKindLabel, alertStatusLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

export const isMunicipalAlert = (a: DataAlertOut) => a.kind.startsWith('municipal_');

function Fact({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium font-serif text-2xl tabular-nums leading-tight">{value}</dd>
      <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>
    </div>
  );
}

export function QualityTab({ overview }: { overview: MunicipalOverview }) {
  const { containers, quality, sites } = overview;
  const dq = useQuery(getDataQualityOptions());
  const alerts = useMemo(() => (dq.data?.alerts ?? []).filter(isMunicipalAlert), [dq.data]);

  const swapped = alerts.find((a) => a.kind === 'municipal_coords_swapped');

  const columns: Column<DataAlertOut>[] = [
    {
      id: 'number',
      header: m.mun_col_number(),
      value: (a) => a.number,
      cell: (a) => <span className="tabular-nums">{a.number}</span>,
      width: 70,
      align: 'right',
      filter: false,
    },
    {
      id: 'kind',
      header: m.mun_col_alert_kind(),
      value: (a) => alertKindLabel[a.kind](),
      cell: (a) => <span className="font-medium">{alertKindLabel[a.kind]()}</span>,
      primary: true,
      filter: true,
      className: 'whitespace-normal',
      width: 280,
    },
    {
      id: 'status',
      header: m.mun_col_alert_status(),
      value: (a) => alertStatusLabel[a.status](),
      cell: (a) => alertStatusLabel[a.status](),
      filter: true,
      badge: true,
    },
    {
      id: 'detail',
      header: m.mun_col_alert_detail(),
      value: (a) => a.detail,
      cell: (a) => (
        <span lang="pt-PT" className="block max-w-xl">
          {a.detail}
        </span>
      ),
      className: 'whitespace-normal',
      width: 420,
      full: true,
    },
  ];

  return (
    <div className="space-y-8 sm:space-y-12">
      <StatStrip>
        <StatCell
          label={m.mun_q_accepted()}
          value={formatNumber(containers.accepted)}
          hint={m.mun_q_accepted_hint({ rejected: formatNumber(containers.rejected ?? 0) })}
        />
        <StatCell
          label={m.mun_q_pending()}
          value={formatNumber(containers.pending)}
          hint={m.mun_q_pending_hint()}
        />
        <StatCell
          label={m.mun_q_suspect()}
          value={formatNumber(quality.containers_coord_suspect)}
          hint={m.mun_q_suspect_hint()}
          tone="primary"
        />
        <StatCell
          label={m.mun_q_parish_equal()}
          value={
            quality.parish_equal_pct == null
              ? m.common_dash()
              : formatPercent(quality.parish_equal_pct, 1)
          }
          hint={m.mun_q_parish_equal_hint({
            equal: formatNumber(quality.parish_equal),
            compared: formatNumber(quality.parish_compared),
          })}
        />
      </StatStrip>

      <Section title={m.mun_q_title()} description={m.mun_q_desc()}>
        <Panel>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <Fact
              label={m.mun_q_approx()}
              value={`${formatNumber(quality.sites_approximate)} / ${formatNumber(sites.total)}`}
              hint={m.mun_q_approx_hint()}
            />
            <Fact
              label={m.mun_q_stream_unknown()}
              value={formatNumber(quality.stream_unknown_containers)}
              hint={m.mun_q_stream_unknown_hint()}
            />
            <Fact
              label={m.mun_q_capacity_assumed()}
              value={formatNumber(quality.capacity_assumed_containers)}
              hint={m.mun_q_capacity_assumed_hint({
                unknown: formatNumber(containers.capacity_unknown),
              })}
            />
          </dl>
          {swapped && (
            <div className="mt-5 space-y-1 border-t pt-4 text-sm">
              <p className="font-medium">{m.mun_q_swapped_title()}</p>
              <p className="max-w-3xl text-muted-foreground leading-relaxed" lang="pt-PT">
                {swapped.detail}
              </p>
            </div>
          )}
        </Panel>
      </Section>

      <Section
        title={m.mun_q_alerts_title()}
        description={m.mun_q_alerts_desc()}
        actions={
          <Button asChild variant="outline" className="h-10">
            <Link to="/data-quality" search={{ tab: 'alerts', origin: 'municipal' }}>
              {m.mun_q_open_quality()}
            </Link>
          </Button>
        }
      >
        <DataTable
          id="municipal-alerts"
          columns={columns}
          rows={alerts}
          getRowId={(a) => a.id}
          loading={dq.isPending}
          refreshing={dq.isFetching && !dq.isPending}
          error={dq.error}
          onRetry={() => void dq.refetch()}
          controls="auto"
          pageSize={10}
          initialSort={{ id: 'number', desc: false }}
          searchLabel={m.mun_q_alerts_search()}
          exportName="rede-municipal-alertas"
          renderExpanded={(a) =>
            a.suggestion ? (
              <p className="p-4 text-sm leading-relaxed" lang="pt-PT">
                <span className="font-medium">{m.quality_alert_suggestion()}: </span>
                {a.suggestion}
              </p>
            ) : null
          }
          empty={
            <EmptyState
              title={m.mun_q_alerts_empty_title()}
              description={m.mun_q_alerts_empty_text()}
            />
          }
        />
      </Section>
    </div>
  );
}
