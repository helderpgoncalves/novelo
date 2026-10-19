import { Link } from '@tanstack/react-router';
import type { ScenarioOut, ZoneOut } from '@/client';
import { formatEur, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
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

export function CompareView({ a, b, zones }: { a: ScenarioOut; b: ScenarioOut; zones: ZoneOut[] }) {
  return (
    <div className="space-y-10">
      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-border border-b text-left">
              <th scope="col" className="p-4 font-medium text-muted-foreground">
                {m.compare_metric()}
              </th>
              {[a, b].map((s, i) => (
                <th key={s.id} scope="col" className="p-4 text-right">
                  <p className="eyebrow">
                    {i === 0 ? m.compare_scenario_a() : m.compare_scenario_b()}
                  </p>
                  <Link
                    to="/scenarios/$scenarioId"
                    params={{ scenarioId: s.id }}
                    className="font-medium font-serif text-xl hover:underline"
                  >
                    {s.label}
                  </Link>
                </th>
              ))}
              <th scope="col" className="p-4 text-right font-medium text-muted-foreground">
                {m.compare_delta()}
              </th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((metric) => {
              const va = metric.get(a);
              const vb = metric.get(b);
              return (
                <tr key={metric.key} className="border-border border-b last:border-0">
                  <th scope="row" className="p-4 text-left font-medium">
                    {metric.label()}
                  </th>
                  <td className="p-4 text-right tabular-nums">
                    {va == null ? m.common_dash() : metric.format(va)}
                  </td>
                  <td className="p-4 text-right tabular-nums">
                    {vb == null ? m.common_dash() : metric.format(vb)}
                  </td>
                  <td className="p-4 text-right">
                    <Delta metric={metric} a={va} b={vb} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-xs">{m.compare_note()}</p>
      <div className="grid gap-4 lg:grid-cols-2">
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
    </div>
  );
}
