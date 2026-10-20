import { Link } from '@tanstack/react-router';
import type { ScenarioOut, ZoneOut } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { Section } from '@/components/page';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { formatEur, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { RobustnessCard } from './robustness-card';
import { ScenarioMap } from './scenario-map';

interface Metric {
  key: string;
  label: () => string;
  get: (s: ScenarioOut) => number | null;
  format: (v: number) => string;
  /** `up` = mais é melhor; `down` = menos é melhor. */
  better: 'up' | 'down' | 'none';
}

const METRICS: Metric[] = [
  {
    key: 'tonnes',
    label: () => m.kpi_tonnes(),
    get: (s) => s.result.kpis.tonnes_year,
    format: (v) => formatTonnes(v),
    better: 'up',
  },
  {
    key: 'eur_t',
    label: () => m.kpi_eur_per_tonne(),
    get: (s) => s.result.kpis.eur_per_tonne,
    format: (v) => `${formatNumber(v, 0)} €/t`,
    better: 'down',
  },
  {
    key: 'annual',
    label: () => m.kpi_annual_cost(),
    get: (s) => s.result.kpis.annual_cost_eur,
    format: formatEur,
    better: 'down',
  },
  {
    key: 'capex',
    label: () => m.kpi_capex(),
    get: (s) => s.result.kpis.capex_eur,
    format: formatEur,
    better: 'down',
  },
  {
    key: 'coverage',
    label: () => m.kpi_coverage(),
    get: (s) => s.result.kpis.coverage_pct,
    format: (v) => formatPercent(v),
    better: 'up',
  },
  {
    key: 'points',
    label: () => m.compare_points(),
    get: (s) => s.result.kpis.points,
    format: (v) => formatNumber(v),
    better: 'none',
  },
  {
    key: 'km',
    label: () => m.kpi_km(),
    get: (s) => s.result.kpis.km_year,
    format: (v) => `${formatNumber(v)} km`,
    better: 'down',
  },
];

function Delta({ metric, a, b }: { metric: Metric; a: number | null; b: number | null }) {
  if (a == null || b == null)
    return <span className="text-muted-foreground">{m.common_dash()}</span>;
  const diff = b - a;
  if (Math.abs(diff) < 1e-9) return <span className="text-muted-foreground">=</span>;
  const good = metric.better === 'none' ? null : metric.better === 'up' ? diff > 0 : diff < 0;
  const pct = a !== 0 ? (diff / Math.abs(a)) * 100 : null;
  return (
    <span
      className={cn(
        'font-medium tabular-nums',
        good === true && 'text-primary',
        good === false && 'text-destructive',
      )}
    >
      {diff > 0 ? '+' : '−'}
      {metric.format(Math.abs(diff))}
      {pct != null && (
        <span className="ml-1 font-normal text-muted-foreground text-xs">
          ({diff > 0 ? '+' : '−'}
          {formatNumber(Math.abs(pct), 0)}%)
        </span>
      )}
    </span>
  );
}

function signed(diff: number, format: (v: number) => string): string {
  if (Math.abs(diff) < 1e-9) return '=';
  return `${diff > 0 ? '+' : '−'}${format(Math.abs(diff))}`;
}

export function CompareView({ a, b, zones }: { a: ScenarioOut; b: ScenarioOut; zones: ZoneOut[] }) {
  const columns: Column<Metric>[] = [
    {
      id: 'metric',
      header: m.compare_metric(),
      primary: true,
      cell: (x) => x.label(),
    },
    ...[a, b].map(
      (s, i): Column<Metric> => ({
        id: i === 0 ? 'a' : 'b',
        label: s.label,
        align: 'right',
        header: (
          <span className="block">
            <span className="eyebrow block">
              {i === 0 ? m.compare_scenario_a() : m.compare_scenario_b()}
            </span>
            <Link
              to="/scenarios/$scenarioId"
              params={{ scenarioId: s.id }}
              className="font-medium font-serif text-base normal-case tracking-normal hover:underline"
            >
              {s.label}
            </Link>
          </span>
        ),
        cell: (x) => {
          const v = x.get(s);
          return v == null ? m.common_dash() : x.format(v);
        },
      }),
    ),
    {
      id: 'delta',
      header: m.compare_delta(),
      align: 'right',
      cell: (x) => <Delta metric={x} a={x.get(a)} b={x.get(b)} />,
    },
  ];

  const kpiDelta = (key: string) => {
    const metric = METRICS.find((x) => x.key === key);
    const va = metric?.get(a);
    const vb = metric?.get(b);
    return metric && va != null && vb != null ? signed(vb - va, metric.format) : m.common_dash();
  };

  return (
    <div className="space-y-8 sm:space-y-12">
      <StatStrip className="lg:grid-cols-3">
        <StatCell
          label={m.compare_delta_of({ label: m.kpi_tonnes() })}
          value={kpiDelta('tonnes')}
          tone="primary"
          tag={m.common_estimate()}
          hint={m.compare_delta_hint()}
        />
        <StatCell
          label={m.compare_delta_of({ label: m.kpi_eur_per_tonne() })}
          value={kpiDelta('eur_t')}
          tone="primary"
          tag={m.common_estimate()}
          hint={m.compare_delta_hint()}
        />
        <StatCell
          label={m.compare_delta_of({ label: m.kpi_annual_cost() })}
          value={kpiDelta('annual')}
          tag={m.common_estimate()}
          hint={m.compare_delta_hint()}
        />
      </StatStrip>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-3 lg:col-span-8">
          <DataTable
            id="compare-metrics"
            columns={columns}
            rows={METRICS}
            getRowId={(x) => x.key}
            controls="never"
            pageSize={20}
            caption={m.compare_title()}
          />
          <p className="text-muted-foreground text-xs">{m.compare_note()}</p>
        </div>
        <div className="lg:col-span-4">
          <RobustnessCard a={a} b={b} />
        </div>
      </div>

      <Section title={m.compare_maps_title()}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[a, b].map((s) => (
            <div key={s.id} className="space-y-2">
              <p className="font-medium font-serif text-lg">{s.label}</p>
              <ScenarioMap
                zones={zones}
                result={s.result}
                showRoutes={false}
                className="h-96 overflow-hidden rounded-xl ring-1 ring-foreground/10"
              />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
