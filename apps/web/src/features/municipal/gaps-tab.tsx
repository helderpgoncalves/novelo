import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { MunicipalDensityStat, MunicipalGapRow } from '@/client';
import {
  getMunicipalDensityBenchmarkOptions,
  getMunicipalGapRankingOptions,
} from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { Panel, Section } from '@/components/page';
import { EmptyState, ErrorState } from '@/components/states';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { type BarItem, HBarChart } from './bar-chart';
import { EstimateBadge } from './note';

const num1 = (v: number) => formatNumber(v, 1);
const num2 = (v: number) => formatNumber(v, 2);
const LOWEST = 12;

export function GapsTab() {
  const ranking = useQuery(getMunicipalGapRankingOptions());
  const benchmark = useQuery(getMunicipalDensityBenchmarkOptions());

  const gapColumns: Column<MunicipalGapRow>[] = [
    {
      id: 'rank',
      header: m.mun_col_rank(),
      value: (r) => r.rank,
      cell: (r) => <span className="font-medium tabular-nums">{formatNumber(r.rank)}</span>,
      width: 70,
      align: 'right',
      filter: false,
    },
    {
      id: 'name',
      header: m.mun_col_parish(),
      value: (r) => r.name,
      cell: (r) => <span className="font-medium">{r.name}</span>,
      primary: true,
      className: 'whitespace-normal',
      width: 240,
    },
    {
      id: 'population',
      header: m.mun_col_population(),
      value: (r) => r.population,
      cell: (r) => formatNumber(r.population),
      format: formatNumber,
      aggregate: 'sum',
      align: 'right',
      filter: 'range',
      desktopOnly: true,
    },
    {
      id: 'per1000',
      header: m.mun_col_per_1000(),
      value: (r) => r.containers_per_1000_hab,
      cell: (r) => num1(r.containers_per_1000_hab),
      format: num1,
      align: 'right',
      filter: 'range',
    },
    {
      id: 'candidates',
      header: m.mun_col_candidates(),
      value: (r) => r.candidate_sites,
      cell: (r) => formatNumber(r.candidate_sites),
      exportValue: (r) => r.candidate_sites,
      align: 'right',
      filter: 'range',
      desktopOnly: true,
    },
    {
      id: 'potential',
      header: (
        <span className="inline-flex items-center gap-1.5">
          {m.mun_col_potential()} <EstimateBadge />
        </span>
      ),
      label: m.mun_col_potential(),
      value: (r) => r.textile_potential_t,
      cell: (r) => formatTonnes(r.textile_potential_t),
      format: formatTonnes,
      aggregate: 'sum',
      align: 'right',
      defaultHidden: true,
    },
    {
      id: 'gap',
      header: (
        <span className="inline-flex items-center gap-1.5">
          {m.mun_col_gap()} <EstimateBadge />
        </span>
      ),
      label: m.mun_col_gap(),
      value: (r) => r.textile_gap_t,
      cell: (r) => formatTonnes(r.textile_gap_t),
      format: formatTonnes,
      aggregate: 'sum',
      align: 'right',
      desktopOnly: true,
    },
    {
      id: 'gap_per_site',
      header: (
        <span className="inline-flex items-center gap-1.5">
          {m.mun_col_gap_per_candidate()} <EstimateBadge />
        </span>
      ),
      label: m.mun_col_gap_per_candidate(),
      value: (r) => r.gap_t_per_candidate_site,
      cell: (r) => <span className="font-medium">{`${num2(r.gap_t_per_candidate_site)} t`}</span>,
      format: (v) => `${num2(v)} t`,
      align: 'right',
      filter: 'range',
      badge: true,
    },
  ];

  const statColumns: Column<MunicipalDensityStat>[] = [
    {
      id: 'label',
      header: m.mun_bench_metric(),
      value: (s) => s.label,
      cell: (s) => (
        <div>
          <p className="font-medium">{s.label}</p>
          <p className="text-muted-foreground text-xs">{s.unit}</p>
        </div>
      ),
      primary: true,
      className: 'whitespace-normal',
      width: 260,
    },
    {
      id: 'concelho',
      header: m.mun_bench_concelho(),
      value: (s) => s.concelho,
      cell: (s) => <span className="font-medium">{num1(s.concelho)}</span>,
      align: 'right',
      badge: true,
    },
    {
      id: 'min',
      header: m.mun_bench_min(),
      value: (s) => s.distribution.minimum,
      cell: (s) => num1(s.distribution.minimum),
      align: 'right',
    },
    {
      id: 'p25',
      header: m.mun_bench_p25(),
      value: (s) => s.distribution.p25,
      cell: (s) => num1(s.distribution.p25),
      align: 'right',
    },
    {
      id: 'median',
      header: m.mun_bench_median(),
      value: (s) => s.distribution.median,
      cell: (s) => num1(s.distribution.median),
      align: 'right',
    },
    {
      id: 'p75',
      header: m.mun_bench_p75(),
      value: (s) => s.distribution.p75,
      cell: (s) => num1(s.distribution.p75),
      align: 'right',
    },
    {
      id: 'max',
      header: m.mun_bench_max(),
      value: (s) => s.distribution.maximum,
      cell: (s) => num1(s.distribution.maximum),
      align: 'right',
    },
  ];

  const lowest = useMemo<BarItem[]>(
    () =>
      [...(benchmark.data?.parishes ?? [])]
        .sort((a, b) => a.containers_per_1000_hab - b.containers_per_1000_hab)
        .slice(0, LOWEST)
        .map((p) => ({
          label: p.name.replace(/^União das freguesias de /, ''),
          value: p.containers_per_1000_hab,
          color: p.below_p25 ? '#b8431f' : '#7a746a',
        })),
    [benchmark.data],
  );

  const ref = benchmark.data?.textile_reference;

  return (
    <div className="space-y-8 sm:space-y-12">
      <Section
        title={m.mun_gaps_title()}
        description={m.mun_gaps_desc()}
        actions={<EstimateBadge />}
      >
        {ranking.isError ? (
          <ErrorState error={ranking.error} onRetry={() => void ranking.refetch()} />
        ) : (
          <>
            {ranking.data && (
              <Panel className="space-y-2 text-sm">
                <p className="leading-relaxed" lang="pt-PT">
                  {ranking.data.rule}
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed" lang="pt-PT">
                  {ranking.data.caveat}
                </p>
              </Panel>
            )}
            <DataTable
              id="municipal-gaps"
              title={m.mun_gaps_table_title()}
              columns={gapColumns}
              rows={ranking.data?.items ?? []}
              getRowId={(r) => r.dicofre}
              loading={ranking.isPending}
              refreshing={ranking.isFetching && !ranking.isPending}
              controls="always"
              pageSize={12}
              initialSort={{ id: 'rank', desc: false }}
              searchLabel={m.mun_parishes_search()}
              exportName="rede-municipal-lacunas"
              empty={
                <EmptyState
                  title={m.mun_gaps_empty_title()}
                  description={m.mun_gaps_empty_text()}
                />
              }
            />
          </>
        )}
      </Section>

      <Section title={m.mun_bench_title()} description={m.mun_bench_desc()}>
        {benchmark.isError ? (
          <ErrorState error={benchmark.error} onRetry={() => void benchmark.refetch()} />
        ) : benchmark.isPending ? (
          <div aria-busy="true" className="space-y-3">
            <span className="sr-only">{m.common_loading()}</span>
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : (
          <div className="space-y-4">
            <DataTable
              id="municipal-benchmark"
              columns={statColumns}
              rows={benchmark.data.stats}
              getRowId={(s) => s.key}
              controls="never"
              pageSize={10}
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel className="min-w-0 space-y-3">
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm">
                    {m.mun_bench_lowest_title({ count: LOWEST })}
                  </h3>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {m.mun_bench_lowest_hint({
                      people: formatNumber(benchmark.data.people_per_public_site ?? 0, 1),
                    })}
                  </p>
                </div>
                <HBarChart
                  items={lowest}
                  format={num1}
                  ariaLabel={m.mun_bench_lowest_title({ count: LOWEST })}
                  labelHeader={m.mun_col_parish()}
                  valueHeader={m.mun_col_per_1000()}
                />
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-[#b8431f]" aria-hidden="true" />
                    {m.mun_bench_below_p25()}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-[#7a746a]" aria-hidden="true" />
                    {m.mun_bench_above_p25()}
                  </span>
                </p>
              </Panel>
              {ref && (
                <Panel className="min-w-0 space-y-2 text-sm">
                  <h3 className="flex flex-wrap items-center gap-2 font-semibold">
                    {m.mun_ref_title()} <EstimateBadge />
                  </h3>
                  <p className="leading-relaxed">
                    {m.mun_ref_rule({
                      people: formatNumber(ref.people_per_point),
                      points: formatNumber(ref.reference_points),
                      candidates: formatNumber(ref.candidate_sites),
                    })}
                  </p>
                  {!ref.verified && (
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {m.mun_ref_unverified()}
                    </p>
                  )}
                  <p className="text-muted-foreground text-xs leading-relaxed" lang="pt-PT">
                    {ref.note}
                  </p>
                </Panel>
              )}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
