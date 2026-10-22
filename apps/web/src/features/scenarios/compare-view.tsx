import { Link } from '@tanstack/react-router';
import type { ScenarioOut, ZoneOut } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { Section } from '@/components/page';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatEur, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { NetworkBadge } from './network-badge';
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
  // Reutilizável: nulo nos cenários anteriores a 22 out 2026 (a linha mostra «—» e a diferença também).
  {
    key: 'reusable',
    label: () => m.reuse_title(),
    get: (s) => s.result.kpis.reusable_t ?? null,
    format: (v) => formatTonnes(v),
    better: 'up',
  },
  {
    key: 'eur_reusable',
    label: () => m.reuse_kpi_eur(),
    get: (s) => s.result.kpis.eur_per_reusable_t ?? null,
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
    key: 'sites',
    label: () => m.site_kpi_opened(),
    get: (s) => s.result.siting?.opened ?? null,
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

const OPTIONAL = new Set(['reusable', 'eur_reusable']);

function Delta({ metric, a, b }: { metric: Metric; a: number | null; b: number | null }) {
  if (a == null || b == null)
    return <span className="text-muted-foreground">{m.common_dash()}</span>;
  const diff = b - a;
  if (Math.abs(diff) < 1e-9) return <span className="text-muted-foreground">=</span>;
  const good = metric.better === 'none' ? null : metric.better === 'up' ? diff > 0 : diff < 0;
  const pct = a !== 0 ? (diff / Math.abs(a)) * 100 : null;
  return (
    // A percentagem vai por baixo da diferença: lado a lado, a coluna ficava tão larga que saía da tabela a 1440 px.
    <span
      className={cn(
        'inline-flex flex-col items-end font-medium tabular-nums leading-tight',
        good === true && 'text-primary',
        good === false && 'text-destructive',
      )}
    >
      <span>
        {diff > 0 ? '+' : '−'}
        {metric.format(Math.abs(diff))}
      </span>
      {pct != null && (
        <span className="font-normal text-muted-foreground text-xs">
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
      // O nome do indicador pode quebrar linha: sem isto a tabela não cabia ao lado da robustez a 1440 px.
      className: 'min-w-32 whitespace-normal',
      cell: (x) => x.label(),
    },
    ...[a, b].map(
      (s, i): Column<Metric> => ({
        id: i === 0 ? 'a' : 'b',
        label: s.label,
        align: 'right',
        // Telemóvel (cartão): só «Cenário A/B», o nome já está no seletor; tabela: o nome a quebrar linha, sem empurrar
        // as colunas da diferença para fora do ecrã.
        header: (
          <>
            <span className="md:hidden">
              {i === 0 ? m.compare_scenario_a() : m.compare_scenario_b()}
            </span>
            <span className="hidden min-w-28 max-w-48 whitespace-normal md:block">
              <span className="eyebrow block">
                {i === 0 ? m.compare_scenario_a() : m.compare_scenario_b()}
              </span>
              <Link
                to="/scenarios/$scenarioId"
                params={{ scenarioId: s.id }}
                className="font-medium font-serif text-base normal-case leading-snug tracking-normal hover:underline"
              >
                {s.label}
              </Link>
              {s.result.siting && (
                <span className="mt-1 block">
                  <NetworkBadge />
                </span>
              )}
            </span>
          </>
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

  /** Diferença B − A de um indicador e, por baixo, se B é melhor ou pior (a cor só reforça, o texto diz). */
  const kpiDelta = (key: string): { value: string; hint: string } => {
    const metric = METRICS.find((x) => x.key === key);
    const va = metric?.get(a);
    const vb = metric?.get(b);
    if (!metric || va == null || vb == null)
      return { value: m.common_dash(), hint: m.compare_delta_hint() };
    const diff = vb - va;
    if (Math.abs(diff) < 1e-9) return { value: '=', hint: m.compare_delta_same() };
    const pct =
      va !== 0
        ? `${diff > 0 ? '+' : '−'}${formatNumber(Math.abs((diff / va) * 100), 0)}%`
        : signed(diff, metric.format);
    const good = metric.better === 'up' ? diff > 0 : diff < 0;
    return {
      value: signed(diff, metric.format),
      hint:
        metric.better === 'none'
          ? m.compare_delta_hint()
          : good
            ? m.compare_delta_better({ pct })
            : m.compare_delta_worse({ pct }),
    };
  };
  // As linhas do reutilizável só aparecem quando pelo menos um dos cenários as tem (os antigos não).
  const rows = METRICS.filter((x) => !OPTIONAL.has(x.key) || x.get(a) != null || x.get(b) != null);
  const tonnes = kpiDelta('tonnes');
  const eurT = kpiDelta('eur_t');
  const annual = kpiDelta('annual');

  const networkName = (s: ScenarioOut) =>
    s.result.siting ? m.site_compare_network_sites() : m.site_compare_network_parish();
  const mixedNetworks = Boolean(a.result.siting) !== Boolean(b.result.siting);

  return (
    <div className="space-y-8 sm:space-y-12">
      {mixedNetworks && (
        <Alert>
          <AlertDescription>
            {m.site_compare_mixed({ a: networkName(a), b: networkName(b) })}
          </AlertDescription>
        </Alert>
      )}
      <StatStrip className="lg:grid-cols-3">
        <StatCell
          label={m.compare_delta_of({ label: m.kpi_tonnes() })}
          value={tonnes.value}
          tag={m.common_estimate()}
          hint={tonnes.hint}
        />
        <StatCell
          label={m.compare_delta_of({ label: m.kpi_eur_per_tonne() })}
          value={eurT.value}
          tag={m.common_estimate()}
          hint={eurT.hint}
        />
        <StatCell
          label={m.compare_delta_of({ label: m.kpi_annual_cost() })}
          value={annual.value}
          tag={m.common_estimate()}
          hint={annual.hint}
        />
      </StatStrip>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-3 lg:col-span-8">
          <DataTable
            id="compare-metrics"
            columns={columns}
            rows={rows}
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
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium font-serif text-lg">
                {s.label}
                {s.result.siting && <NetworkBadge />}
              </p>
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
