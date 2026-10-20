import { useMemo } from 'react';
import type { MunicipalOverview } from '@/client';
import { Panel, Section } from '@/components/page';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { formatMetres, formatNumber, formatPercent } from '@/lib/format';
import { formatDate } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { type BarItem, HBarChart } from './bar-chart';
import { EstimateBadge } from './note';
import {
  KIND_COLORS,
  KIND_ORDER,
  kindLabel,
  PRODUCER_COLORS,
  PRODUCER_ORDER,
  producerLabel,
  siteClassLabel,
  streamLabel,
} from './vocab';

const percent0 = (v: number) => formatPercent(v, 1);
const metres = (v: number) => formatMetres(v);

function ChartPanel({
  title,
  hint,
  estimate,
  children,
}: {
  title: string;
  hint?: string;
  estimate?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Panel className="min-w-0 space-y-3">
      <div className="space-y-1">
        <h3 className="flex flex-wrap items-center gap-2 font-semibold text-sm">
          {title}
          {estimate && <EstimateBadge />}
        </h3>
        {hint && <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>}
      </div>
      {children}
    </Panel>
  );
}

export function OverviewTab({ overview }: { overview: MunicipalOverview }) {
  const { containers, sites, density, coverage, source } = overview;

  const byKind = useMemo<BarItem[]>(
    () =>
      KIND_ORDER.flatMap((k) => {
        const row = overview.by_kind.find((r) => r.kind === k);
        return row ? [{ label: kindLabel[k](), value: row.containers, color: KIND_COLORS[k] }] : [];
      }),
    [overview.by_kind],
  );
  const byStream = useMemo<BarItem[]>(
    () => overview.by_stream.map((r) => ({ label: streamLabel[r.stream](), value: r.containers })),
    [overview.by_stream],
  );
  const byProducer = useMemo<BarItem[]>(
    () =>
      PRODUCER_ORDER.flatMap((t) => {
        const row = overview.by_producer_type.find((r) => r.type === t);
        return row
          ? [{ label: producerLabel[t](), value: row.containers, color: PRODUCER_COLORS[t] }]
          : [];
      }),
    [overview.by_producer_type],
  );
  const bySiteClass = useMemo<BarItem[]>(
    () => [
      { label: siteClassLabel.public(), value: sites.public },
      { label: siteClassLabel.producer(), value: sites.producer },
      { label: siteClassLabel.mixed(), value: sites.mixed },
    ],
    [sites.public, sites.producer, sites.mixed],
  );
  const cover = useMemo<BarItem[]>(
    () =>
      [
        { label: m.mun_cover_radius({ value: 200 }), value: coverage.pct_200m },
        { label: m.mun_cover_radius({ value: 300 }), value: coverage.pct_300m },
        { label: m.mun_cover_radius({ value: 500 }), value: coverage.pct_500m },
      ].flatMap((r) => (r.value == null ? [] : [{ label: r.label, value: r.value }])),
    [coverage.pct_200m, coverage.pct_300m, coverage.pct_500m],
  );
  const nn = coverage.nn_distance;
  const nnItems = useMemo<BarItem[]>(
    () =>
      nn
        ? [
            { label: m.mun_nn_p5(), value: nn.p5_m },
            { label: m.mun_nn_p25(), value: nn.p25_m },
            { label: m.mun_nn_median(), value: nn.median_m },
            { label: m.mun_nn_p75(), value: nn.p75_m },
            { label: m.mun_nn_p95(), value: nn.p95_m },
          ]
        : [],
    [nn],
  );

  return (
    <div className="space-y-8 sm:space-y-12">
      <StatStrip>
        <StatCell
          label={m.mun_kpi_containers()}
          value={formatNumber(containers.accepted)}
          hint={m.mun_kpi_containers_hint({
            located: formatNumber(containers.located),
            pending: formatNumber(containers.pending),
          })}
        />
        <StatCell
          label={m.mun_kpi_sites()}
          value={formatNumber(sites.total)}
          hint={m.mun_kpi_sites_hint({
            public: formatNumber(sites.public),
            producer: formatNumber(sites.producer),
          })}
        />
        <StatCell
          label={m.mun_kpi_density()}
          value={formatNumber(density.containers_per_1000_hab, 1)}
          tone="primary"
          hint={m.mun_kpi_density_hint({
            sites: formatNumber(density.public_sites_per_1000_hab, 1),
            population: formatNumber(density.population),
          })}
        />
        <StatCell
          label={m.mun_kpi_cover()}
          value={coverage.pct_300m == null ? m.common_dash() : formatPercent(coverage.pct_300m, 1)}
          tag={m.common_estimate()}
          hint={m.mun_kpi_cover_hint()}
        />
      </StatStrip>

      <Section title={m.mun_overview_charts_title()} description={m.mun_overview_charts_desc()}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartPanel title={m.mun_chart_kind()} hint={m.mun_chart_kind_hint()}>
            <HBarChart
              items={byKind}
              format={formatNumber}
              ariaLabel={m.mun_chart_kind()}
              labelHeader={m.mun_col_kind()}
              valueHeader={m.mun_col_containers()}
            />
          </ChartPanel>
          <ChartPanel
            title={m.mun_chart_stream()}
            hint={m.mun_chart_stream_hint({
              count: formatNumber(overview.quality.stream_unknown_containers),
            })}
          >
            <HBarChart
              items={byStream}
              format={formatNumber}
              ariaLabel={m.mun_chart_stream()}
              labelHeader={m.mun_col_stream()}
              valueHeader={m.mun_col_containers()}
            />
          </ChartPanel>
          <ChartPanel title={m.mun_chart_producers()} hint={m.mun_chart_producers_hint()}>
            <HBarChart
              items={byProducer}
              format={formatNumber}
              ariaLabel={m.mun_chart_producers()}
              labelHeader={m.mun_col_producer_type()}
              valueHeader={m.mun_col_containers()}
            />
          </ChartPanel>
          <ChartPanel title={m.mun_chart_class()} hint={m.mun_chart_class_hint()}>
            <HBarChart
              items={bySiteClass}
              format={formatNumber}
              ariaLabel={m.mun_chart_class()}
              labelHeader={m.mun_col_class()}
              valueHeader={m.mun_col_sites()}
            />
          </ChartPanel>
          <ChartPanel
            title={m.mun_chart_cover()}
            hint={m.mun_chart_cover_hint({
              half: formatNumber(coverage.parishes_half_covered_300m),
              under: formatNumber(coverage.parishes_under_quarter_300m),
            })}
            estimate
          >
            <HBarChart
              items={cover}
              format={percent0}
              max={100}
              ariaLabel={m.mun_chart_cover()}
              labelHeader={m.mun_col_radius()}
              valueHeader={m.mun_col_cover_area()}
            />
          </ChartPanel>
          {nn && (
            <ChartPanel
              title={m.mun_chart_nn()}
              hint={m.mun_chart_nn_hint({ n: formatNumber(nn.n), mean: formatMetres(nn.mean_m) })}
            >
              <HBarChart
                items={nnItems}
                format={metres}
                ariaLabel={m.mun_chart_nn()}
                labelHeader={m.mun_col_percentile()}
                valueHeader={m.mun_col_distance()}
              />
            </ChartPanel>
          )}
        </div>
      </Section>

      <p className="max-w-3xl text-muted-foreground text-xs leading-relaxed">
        {m.mun_overview_source({
          provider: source.provider,
          date: source.received_on ? formatDate(source.received_on) : m.common_dash(),
          caop: source.caop_version,
        })}{' '}
        {overview.estimates.note}
      </p>
    </div>
  );
}
