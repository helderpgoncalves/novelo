import { useQuery } from '@tanstack/react-query';
import { Quote } from 'lucide-react';
import type { CoverageGroup, CoverageParish, ScenarioCoverage, Tipau } from '@/client';
import { getScenarioCoverageOptions } from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable, type TableView } from '@/components/data-table';
import { Section } from '@/components/page';
import { EstimateTag } from '@/components/panel';
import { EmptyState, ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatEur, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { cn } from '@/lib/utils';
import { tipauLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';
import { type CoverageChannel, coverageChannels } from './coverage';

const channelLabel: Record<CoverageChannel, () => string> = {
  door_to_door: () => m.scov_channel_pap(),
  detour: () => m.plan_channel_detour(),
  on_demand: () => m.scov_channel_on_demand(),
  existing: () => m.scov_channel_existing(),
  street: () => m.scov_channel_street(),
};

const tipauShort: Record<Tipau, () => string> = {
  apu: () => m.scov_tipau_short_apu(),
  amu: () => m.scov_tipau_short_amu(),
  apr: () => m.scov_tipau_short_apr(),
};

const tipauName = (t: Tipau | null) => (t ? tipauLabel[t]() : m.scov_no_tipau());
const dash = <span className="text-muted-foreground">{m.common_dash()}</span>;
const eurPerT = (v: number) => `${formatNumber(v, 0)} €/t`;
const channelsText = (p: CoverageParish) =>
  coverageChannels(p)
    .map((c) => channelLabel[c]())
    .join(', ') || m.scov_channel_none();

/**
 * Separador «Cobertura»: a matriz do art. 22.º-C, n.º 9, alínea b) da Diretiva (UE) 2025/1892 para o cenário. Por TIPAU,
 * o indicador fora/dentro das zonas urbanas e a tabela por freguesia. Todos os números vêm da API (cenário e base de dados).
 */
/**
 * Cabeçalho que pode quebrar linha («Volume / previsto»): com os cabeçalhos numa só linha a tabela da cobertura passava
 * da largura do ecrã a 1440 px e cortava «Dias porta a porta».
 */
function WrapHead({ children, title }: { children: string; title?: string }) {
  return (
    <span
      title={title}
      className="inline-block min-w-16 whitespace-normal text-right leading-tight"
    >
      {children}
    </span>
  );
}

export function CoveragePanel({ scenarioId }: { scenarioId: string }) {
  const query = useQuery(getScenarioCoverageOptions({ path: { scenario_id: scenarioId } }));
  const data = query.data;

  return (
    <div className="space-y-8">
      <Section
        title={m.scov_title()}
        description={
          <>
            {m.scov_note()} <EstimateTag label={m.common_estimate()} />
          </>
        }
      >
        <figure className="flex gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
          <Quote className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 space-y-2">
            <blockquote className="text-pretty font-serif text-base leading-relaxed sm:text-lg">
              {m.scov_quote()}
            </blockquote>
            <figcaption className="text-muted-foreground text-xs">
              {m.scov_quote_source()}
            </figcaption>
          </div>
        </figure>
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : !data ? (
          <CoverageSummarySkeleton />
        ) : (
          <CoverageSummary coverage={data} />
        )}
      </Section>

      {/* Em erro, um só aviso com «tentar de novo» (em cima); a tabela volta quando o pedido responder. */}
      {!query.isError && (
        <Section title={m.scov_table_title()} description={m.scov_table_description()}>
          <ParishTable
            parishes={data?.parishes ?? []}
            loading={query.isPending}
            refreshing={query.isFetching && !query.isPending}
          />
        </Section>
      )}
    </div>
  );
}

function CoverageSummarySkeleton() {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label={m.common_loading()}>
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function CoverageSummary({ coverage }: { coverage: ScenarioCoverage }) {
  const { equity } = coverage;
  const pct = (v: number | null) => (v == null ? null : formatPercent(v, 1));
  const nonUrban = pct(equity.non_urban_covered_pct);
  const urban = pct(equity.urban_covered_pct);
  return (
    <div className="space-y-4">
      <div
        className="space-y-1 rounded-xl bg-primary/8 p-4 ring-1 ring-primary/25 sm:p-5"
        data-testid="coverage-equity"
      >
        <p className="eyebrow flex flex-wrap items-center gap-2 text-primary">
          {m.scov_equity_label()} <EstimateTag label={m.common_estimate()} />
        </p>
        <p className="text-pretty font-medium font-serif text-lg leading-snug sm:text-xl">
          {nonUrban != null && urban != null && equity.non_urban_population > 0
            ? m.scov_equity({
                population: formatNumber(equity.non_urban_population),
                nonUrban,
                urban,
              })
            : m.scov_equity_none()}
        </p>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold text-base">{m.scov_tipau_title()}</h3>
        <p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">
          {m.scov_tipau_description()}
        </p>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {coverage.by_tipau.map((g) => (
            <GroupCard key={g.tipau ?? 'none'} group={g} title={tipauName(g.tipau)} />
          ))}
          <GroupCard group={coverage.total} title={m.scov_total()} total />
        </ul>
      </div>
    </div>
  );
}

function GroupCard({
  group,
  title,
  total = false,
}: {
  group: CoverageGroup;
  title: string;
  total?: boolean;
}) {
  const rows: [string, string][] = [
    [m.scov_stat_population(), `${formatNumber(group.population)} hab.`],
    [m.scov_stat_tonnes(), formatTonnes(group.tonnes)],
    [m.scov_stat_cost(), formatEur(group.annual_cost_eur)],
    [
      m.scov_stat_eur_t(),
      group.eur_per_tonne == null ? m.common_dash() : eurPerT(group.eur_per_tonne),
    ],
  ];
  return (
    <li
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-xl p-4 ring-1',
        total ? 'bg-secondary/60 ring-foreground/15' : 'bg-card ring-foreground/10',
      )}
    >
      <div className="space-y-0.5">
        <p className="font-medium text-sm leading-snug">{title}</p>
        <p className="text-muted-foreground text-xs">
          {group.parishes === 1
            ? m.scov_parishes_one()
            : m.scov_parishes_n({ n: formatNumber(group.parishes) })}
        </p>
      </div>
      <p className="space-x-1.5">
        <span className="font-medium font-serif text-3xl text-primary tabular-nums leading-none">
          {group.covered_pct == null ? m.common_dash() : formatPercent(group.covered_pct, 1)}
        </span>
        <span className="text-muted-foreground text-xs">{m.scov_stat_served()}</span>
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

const VIEWS: TableView[] = [
  {
    id: 'non-urban',
    get label() {
      return m.scov_view_non_urban();
    },
    state: { filters: { tipau: { kind: 'facet', values: ['amu', 'apr'] } } },
  },
];

function ParishTable({
  parishes,
  loading,
  refreshing,
}: {
  parishes: CoverageParish[];
  loading: boolean;
  refreshing: boolean;
}) {
  const columns: Column<CoverageParish>[] = [
    {
      id: 'parish',
      className: 'min-w-36 whitespace-normal',
      header: m.scov_col_parish(),
      primary: true,
      pinned: 'left',
      value: (p) => p.parish_name,
      cell: (p) => <span className="font-medium">{p.parish_name}</span>,
    },
    {
      id: 'tipau',
      header: m.scov_col_tipau(),
      value: (p) => p.tipau,
      exportValue: (p) => tipauName(p.tipau),
      filter: { format: (v) => tipauLabel[v as Tipau]?.() ?? v },
      searchable: false,
      // Na tabela, a forma curta (o nome completo no `title`, nos filtros, na exportação e no cartão em telemóvel).
      cell: (p) =>
        p.tipau ? (
          <>
            <span className="md:hidden">{tipauName(p.tipau)}</span>
            <span className="hidden whitespace-nowrap md:inline" title={tipauName(p.tipau)}>
              {tipauShort[p.tipau]()}
            </span>
          </>
        ) : (
          dash
        ),
    },
    {
      id: 'population',
      header: m.scov_col_population(),
      type: 'number',
      align: 'right',
      searchable: false,
      filter: 'range',
      aggregate: 'sum',
      format: (n) => formatNumber(n),
      value: (p) => p.population,
      cell: (p) => <span className="tabular-nums">{formatNumber(p.population)}</span>,
    },
    {
      id: 'density',
      label: m.scov_col_density_unit(),
      header: m.scov_col_density_unit(),
      className: 'min-w-28 whitespace-normal',
      type: 'number',
      align: 'right',
      searchable: false,
      filter: 'range',
      format: (n) => `${formatNumber(n)} hab/km²`,
      // Escondidas por omissão (menu Colunas): com dez colunas a tabela rolava na horizontal a 1440 px.
      defaultHidden: true,
      value: (p) => p.density_hab_km2,
      cell: (p) =>
        p.density_hab_km2 == null ? (
          dash
        ) : (
          <span className="tabular-nums">{formatNumber(p.density_hab_km2)}</span>
        ),
    },
    {
      id: 'demand',
      label: m.scov_col_demand(),
      header: <WrapHead>{m.scov_col_demand()}</WrapHead>,
      type: 'number',
      align: 'right',
      searchable: false,
      aggregate: 'sum',
      format: (n) => formatTonnes(n),
      value: (p) => p.demand_t,
      cell: (p) => <span className="tabular-nums">{formatTonnes(p.demand_t)}</span>,
    },
    {
      id: 'area300',
      label: m.scov_col_area300(),
      header: <span title={m.scov_col_area300_hint()}>{m.scov_col_area300_short()}</span>,
      type: 'number',
      align: 'right',
      searchable: false,
      filter: 'range',
      format: (n) => formatPercent(n, 0),
      defaultHidden: true,
      value: (p) => p.area_within_300m_pct,
      cell: (p) =>
        p.area_within_300m_pct == null ? (
          dash
        ) : (
          <span className="tabular-nums">{formatPercent(p.area_within_300m_pct, 0)}</span>
        ),
    },
    {
      id: 'pap_days',
      label: m.scov_col_pap_days(),
      header: <WrapHead title={m.scov_col_pap_days()}>{m.scov_col_pap_days_short()}</WrapHead>,
      type: 'number',
      align: 'right',
      searchable: false,
      filter: true,
      value: (p) => p.door_to_door_days_week,
      cell: (p) => <span className="tabular-nums">{formatNumber(p.door_to_door_days_week)}</span>,
    },
    {
      id: 'channels',
      header: m.scov_col_channels(),
      className: 'min-w-32 whitespace-normal',
      value: (p) => channelsText(p),
      filter: true,
      cell: (p) =>
        coverageChannels(p).length === 0 ? (
          <span className="text-muted-foreground">{m.scov_channel_none()}</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {coverageChannels(p).map((c) => (
              <Badge
                key={c}
                variant="outline"
                className={cn(
                  'h-auto py-0.5 font-medium leading-snug',
                  c === 'door_to_door'
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-areia/70 bg-areia/15 text-foreground/85',
                )}
              >
                {channelLabel[c]()}
              </Badge>
            ))}
          </span>
        ),
      full: true,
    },
    {
      id: 'tonnes',
      label: m.scov_col_tonnes(),
      header: <WrapHead>{m.scov_col_tonnes()}</WrapHead>,
      type: 'number',
      align: 'right',
      searchable: false,
      aggregate: 'sum',
      format: (n) => formatTonnes(n),
      value: (p) => p.tonnes,
      cell: (p) => <span className="tabular-nums">{formatTonnes(p.tonnes)}</span>,
    },
    {
      id: 'served',
      label: m.scov_col_served(),
      header: <WrapHead>{m.scov_col_served()}</WrapHead>,
      type: 'number',
      align: 'right',
      searchable: false,
      filter: 'range',
      badge: true,
      format: (n) => formatPercent(n, 0),
      value: (p) => p.covered_share * 100,
      cell: (p) => (
        <span
          className={cn(
            'font-medium tabular-nums',
            p.covered_share === 0 && 'text-muted-foreground',
          )}
        >
          {formatPercent(p.covered_share * 100, 0)}
          {/* No cartão em telemóvel o valor vai ao lado do nome, sem cabeçalho: diz o que é. */}
          <span className="font-normal text-muted-foreground text-xs md:hidden">
            {' '}
            {m.scov_stat_served().toLowerCase()}
          </span>
        </span>
      ),
    },
    {
      id: 'served_pop',
      header: m.scov_col_served_pop(),
      type: 'number',
      align: 'right',
      searchable: false,
      aggregate: 'sum',
      format: (n) => formatNumber(n),
      value: (p) => p.covered_population,
      cell: (p) => <span className="tabular-nums">{formatNumber(p.covered_population)}</span>,
      defaultHidden: true,
    },
    {
      id: 'cost',
      header: m.scov_col_cost(),
      type: 'number',
      align: 'right',
      searchable: false,
      aggregate: 'sum',
      format: formatEur,
      value: (p) => p.annual_cost_eur,
      cell: (p) => <span className="tabular-nums">{formatEur(p.annual_cost_eur)}</span>,
      defaultHidden: true,
    },
    {
      id: 'service_days',
      header: m.scov_col_service_days(),
      className: 'min-w-32 whitespace-normal',
      type: 'number',
      align: 'right',
      searchable: false,
      value: (p) => p.service_days,
      cell: (p) => <span className="tabular-nums">{formatNumber(p.service_days)}</span>,
      defaultHidden: true,
    },
    {
      id: 'area',
      header: m.scov_col_area(),
      type: 'number',
      align: 'right',
      searchable: false,
      aggregate: 'sum',
      format: (n) => `${formatNumber(n, 1)} km²`,
      value: (p) => p.area_km2,
      cell: (p) =>
        p.area_km2 == null ? (
          dash
        ) : (
          <span className="tabular-nums">{formatNumber(p.area_km2, 1)} km²</span>
        ),
      defaultHidden: true,
    },
  ];

  return (
    <div className="space-y-2">
      <DataTable
        id="scenario-coverage"
        exportName="cenario-cobertura"
        caption={m.scov_table_title()}
        columns={columns}
        rows={parishes}
        getRowId={(p) => p.parish_code}
        searchLabel={m.scov_search()}
        pageSize={10}
        initialSort={{ id: 'population', desc: true }}
        selectable={false}
        views={VIEWS}
        loading={loading}
        refreshing={refreshing}
        empty={<EmptyState title={m.scov_empty_title()} description={m.scov_empty_text()} />}
      />
      <p className="text-muted-foreground text-xs leading-relaxed">{m.scov_col_area300_hint()}</p>
    </div>
  );
}
