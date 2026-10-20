import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { MapPinned, X } from 'lucide-react';
import type { MunicipalParishOut } from '@/client';
import { listMunicipalParishesOptions } from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { Panel } from '@/components/page';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
import {
  formatLitres,
  formatMetres,
  formatNumber,
  formatPercent,
  formatTonnes,
} from '@/lib/format';
import { m } from '@/paraglide/messages';
import { EstimateBadge } from './note';
import { PctBar } from './pct-bar';
import { KIND_ORDER, kindLabel, PRODUCER_ORDER, producerLabel } from './vocab';

const dash = <span className="text-muted-foreground">{m.common_dash()}</span>;
const num1 = (v: number) => formatNumber(v, 1);
const num2 = (v: number) => formatNumber(v, 2);

const producersTotal = (p: MunicipalParishOut) =>
  PRODUCER_ORDER.reduce((s, t) => s + p.producers[t], 0);

function Metric({ label, value, estimate }: { label: string; value: string; estimate?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
        {label}
        {estimate && <EstimateBadge />}
      </dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** Todas as métricas de uma freguesia, na linha expandida e no cartão de foco. */
export function ParishMetrics({ p }: { p: MunicipalParishOut }) {
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
        <Metric label={m.mun_col_population()} value={formatNumber(p.population)} />
        <Metric label={m.mun_col_area()} value={`${formatNumber(p.area_km2, 1)} km²`} />
        <Metric label={m.mun_col_containers()} value={formatNumber(p.containers)} />
        <Metric label={m.mun_col_sites()} value={formatNumber(p.sites)} />
        <Metric label={m.mun_col_per_1000()} value={num1(p.containers_per_1000_hab)} />
        <Metric label={m.mun_col_public_per_1000()} value={num1(p.public_sites_per_1000_hab)} />
        <Metric label={m.mun_col_per_km2()} value={num1(p.containers_per_km2)} />
        <Metric label={m.mun_col_capacity()} value={formatLitres(p.capacity_litres_total)} />
        <Metric
          label={m.mun_col_nn_mean()}
          value={
            p.mean_nn_distance_m == null ? m.common_dash() : formatMetres(p.mean_nn_distance_m)
          }
        />
        <Metric
          label={m.mun_col_nn_median()}
          value={
            p.median_nn_distance_m == null ? m.common_dash() : formatMetres(p.median_nn_distance_m)
          }
        />
        <Metric label={m.mun_col_pending()} value={formatNumber(p.containers_pending)} />
        <Metric label={m.mun_col_suspect()} value={formatNumber(p.containers_coord_suspect)} />
      </dl>
      <dl className="grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
        <Metric
          label={m.mun_cover_radius({ value: 200 })}
          value={formatPercent(p.cover_pct_200m, 1)}
          estimate
        />
        <Metric
          label={m.mun_cover_radius({ value: 300 })}
          value={formatPercent(p.cover_pct_300m, 1)}
          estimate
        />
        <Metric
          label={m.mun_cover_radius({ value: 500 })}
          value={formatPercent(p.cover_pct_500m, 1)}
          estimate
        />
      </dl>
      <div className="grid gap-4 sm:grid-cols-2">
        <section>
          <h4 className="mb-1.5 font-semibold text-xs">{m.mun_by_kind()}</h4>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {KIND_ORDER.map((k) => (
              <li key={k} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{kindLabel[k]()}</span>
                <span className="tabular-nums">{formatNumber(p.by_kind[k])}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h4 className="mb-1.5 font-semibold text-xs">{m.mun_by_producer()}</h4>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {PRODUCER_ORDER.map((t) => (
              <li key={t} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{producerLabel[t]()}</span>
                <span className="tabular-nums">{formatNumber(p.producers[t])}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3 text-sm sm:grid-cols-4">
        <Metric
          label={m.mun_col_candidates()}
          value={`${formatNumber(p.candidate_sites)} (${m.mun_precise_count({ count: formatNumber(p.candidate_sites_precise) })})`}
          estimate
        />
        <Metric
          label={m.mun_col_potential()}
          value={formatTonnes(p.textile_potential_t)}
          estimate
        />
        <Metric label={m.mun_col_gap()} value={formatTonnes(p.textile_gap_t)} estimate />
        <Metric
          label={m.mun_col_gap_rank()}
          value={`${formatNumber(p.gap_rank)}.º · ${num2(p.gap_t_per_candidate_site)} t`}
          estimate
        />
      </dl>
    </div>
  );
}

interface ParishesTabProps {
  focus: string | undefined;
  onFocusChange: (parish: string | undefined) => void;
}

export function ParishesTab({ focus, onFocusChange }: ParishesTabProps) {
  const navigate = useNavigate();
  const query = useQuery(listMunicipalParishesOptions());
  const rows = query.data?.items ?? [];
  const focused = focus
    ? rows.find((p) => p.dicofre === focus || p.dicofre_caop === focus)
    : undefined;

  const columns: Column<MunicipalParishOut>[] = [
    {
      id: 'name',
      header: m.mun_col_parish(),
      value: (p) => p.name,
      cell: (p) => <span className="font-medium">{p.name}</span>,
      primary: true,
      width: 240,
      className: 'whitespace-normal',
    },
    {
      id: 'population',
      header: m.mun_col_population(),
      value: (p) => p.population,
      cell: (p) => formatNumber(p.population),
      aggregate: 'sum',
      format: formatNumber,
      align: 'right',
      filter: 'range',
    },
    {
      id: 'containers',
      header: m.mun_col_containers(),
      value: (p) => p.containers,
      cell: (p) => formatNumber(p.containers),
      aggregate: 'sum',
      format: formatNumber,
      align: 'right',
      filter: 'range',
    },
    {
      id: 'per1000',
      header: m.mun_col_per_1000(),
      value: (p) => p.containers_per_1000_hab,
      cell: (p) => <span className="font-medium">{num1(p.containers_per_1000_hab)}</span>,
      format: num1,
      align: 'right',
      filter: 'range',
      badge: true,
    },
    {
      id: 'sites',
      header: m.mun_col_sites(),
      value: (p) => p.sites,
      cell: (p) => formatNumber(p.sites),
      aggregate: 'sum',
      format: formatNumber,
      align: 'right',
      defaultHidden: true,
    },
    {
      id: 'public_sites',
      header: m.mun_col_public_sites(),
      value: (p) => p.public_sites,
      cell: (p) => formatNumber(p.public_sites),
      aggregate: 'sum',
      format: formatNumber,
      align: 'right',
    },
    {
      id: 'public_per_1000',
      header: m.mun_col_public_per_1000(),
      value: (p) => p.public_sites_per_1000_hab,
      cell: (p) => num1(p.public_sites_per_1000_hab),
      format: num1,
      align: 'right',
      filter: 'range',
      defaultHidden: true,
    },
    {
      id: 'per_km2',
      header: m.mun_col_per_km2(),
      value: (p) => p.containers_per_km2,
      cell: (p) => num1(p.containers_per_km2),
      format: num1,
      align: 'right',
      defaultHidden: true,
    },
    {
      id: 'nn_mean',
      header: m.mun_col_nn_mean(),
      value: (p) => p.mean_nn_distance_m,
      cell: (p) => (p.mean_nn_distance_m == null ? dash : formatMetres(p.mean_nn_distance_m)),
      format: formatMetres,
      align: 'right',
      defaultHidden: true,
    },
    {
      id: 'cover_300',
      header: (
        <span className="inline-flex items-center gap-1.5">
          {m.mun_col_cover_300()} <EstimateBadge />
        </span>
      ),
      label: m.mun_col_cover_300(),
      value: (p) => p.cover_pct_300m,
      cell: (p) => <PctBar pct={p.cover_pct_300m} label={m.mun_col_cover_300()} />,
      exportValue: (p) => p.cover_pct_300m,
      format: (v) => formatPercent(v, 1),
      filter: 'range',
      full: true,
    },
    {
      id: 'cover_200',
      header: m.mun_col_cover_200(),
      value: (p) => p.cover_pct_200m,
      cell: (p) => formatPercent(p.cover_pct_200m, 1),
      format: (v) => formatPercent(v, 1),
      align: 'right',
      defaultHidden: true,
    },
    {
      id: 'cover_500',
      header: m.mun_col_cover_500(),
      value: (p) => p.cover_pct_500m,
      cell: (p) => formatPercent(p.cover_pct_500m, 1),
      format: (v) => formatPercent(v, 1),
      align: 'right',
      defaultHidden: true,
    },
    {
      id: 'candidates',
      header: m.mun_col_candidates(),
      value: (p) => p.candidate_sites,
      cell: (p) => formatNumber(p.candidate_sites),
      aggregate: 'sum',
      format: formatNumber,
      align: 'right',
      defaultHidden: true,
    },
    {
      id: 'producers',
      header: m.mun_col_producers(),
      value: producersTotal,
      cell: (p) => formatNumber(producersTotal(p)),
      aggregate: 'sum',
      format: formatNumber,
      align: 'right',
      defaultHidden: true,
    },
    {
      id: 'capacity',
      header: m.mun_col_capacity(),
      value: (p) => p.capacity_litres_total,
      cell: (p) => formatLitres(p.capacity_litres_total),
      format: formatLitres,
      aggregate: 'sum',
      align: 'right',
      defaultHidden: true,
    },
    {
      id: 'gap_rank',
      header: (
        <span className="inline-flex items-center gap-1.5">
          {m.mun_col_gap_rank()} <EstimateBadge />
        </span>
      ),
      label: m.mun_col_gap_rank(),
      value: (p) => p.gap_rank,
      cell: (p) => `${formatNumber(p.gap_rank)}.º`,
      align: 'right',
      defaultHidden: true,
    },
    {
      id: 'suspect',
      header: m.mun_col_suspect(),
      value: (p) => p.containers_coord_suspect,
      cell: (p) => formatNumber(p.containers_coord_suspect),
      aggregate: 'sum',
      format: formatNumber,
      align: 'right',
      defaultHidden: true,
    },
    {
      id: 'pending',
      header: m.mun_col_pending(),
      value: (p) => p.containers_pending,
      cell: (p) => formatNumber(p.containers_pending),
      aggregate: 'sum',
      format: formatNumber,
      align: 'right',
      defaultHidden: true,
    },
  ];

  return (
    <div className="space-y-4">
      {focus && focused && (
        <Panel className="space-y-4" data-testid="parish-focus">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow">{m.mun_focus_eyebrow()}</p>
              <h3 className="font-serif text-2xl leading-tight">{focused.name}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="h-10 gap-2">
                <Link to="/map" search={{ preset: 'municipal', parish: focused.dicofre }}>
                  <MapPinned aria-hidden="true" />
                  {m.mun_focus_map()}
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="h-10 gap-2"
                onClick={() => onFocusChange(undefined)}
              >
                <X aria-hidden="true" />
                {m.mun_focus_clear()}
              </Button>
            </div>
          </div>
          <ParishMetrics p={focused} />
        </Panel>
      )}
      {focus && !focused && query.isSuccess && (
        <p role="status" className="text-muted-foreground text-sm">
          {m.mun_focus_missing({ code: focus })}
        </p>
      )}
      <DataTable
        id="municipal-parishes"
        title={m.mun_parishes_title()}
        columns={columns}
        rows={rows}
        getRowId={(p) => p.dicofre}
        loading={query.isPending}
        refreshing={query.isFetching && !query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        controls="always"
        pageSize={12}
        initialSort={{ id: 'name', desc: false }}
        searchLabel={m.mun_parishes_search()}
        exportName="rede-municipal-freguesias"
        renderExpanded={(p) => (
          <div className="p-4">
            <ParishMetrics p={p} />
          </div>
        )}
        rowActions={(p) => [
          {
            id: 'focus',
            label: m.mun_action_focus(),
            onSelect: () => onFocusChange(p.dicofre),
          },
          {
            id: 'map',
            label: m.mun_action_map(),
            icon: <MapPinned />,
            onSelect: () =>
              void navigate({ to: '/map', search: { preset: 'municipal', parish: p.dicofre } }),
          },
        ]}
        empty={
          <EmptyState
            title={m.mun_parishes_empty_title()}
            description={m.mun_parishes_empty_text()}
          />
        }
      />
    </div>
  );
}
