import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Eye, MapPinned } from 'lucide-react';
import { useState } from 'react';
import type { MunicipalCandidateOut, MunicipalOverview } from '@/client';
import { getTextileCandidateSitesInfiniteOptions } from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { FilterChips } from '@/components/filter-chips';
import { Panel } from '@/components/page';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { EmptyState } from '@/components/states';
import { formatMetres, formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { LoadProgress } from './load-progress';
import { EstimateBadge } from './note';
import { useAllPages } from './use-all-pages';
import { kindLabel, labelOfReason, precisionLabel } from './vocab';

const PAGE = 500;
type Precision = 'all' | 'precise';
const dash = <span className="text-muted-foreground">{m.common_dash()}</span>;
const yesNo = (v: boolean) => (v ? m.mun_yes() : m.mun_no());
const reasonsText = (c: MunicipalCandidateOut) => c.reasons.map(labelOfReason).join(', ');

export function CandidatesTab({
  overview,
  onOpenSite,
}: {
  overview: MunicipalOverview;
  onOpenSite: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [precision, setPrecision] = useState<Precision>('all');
  const query = useInfiniteQuery({
    ...getTextileCandidateSitesInfiniteOptions({
      query: { limit: PAGE, precise_only: precision === 'precise' },
    }),
    // A primeira página não leva cursor (o cliente gerado só aceita objetos aqui).
    initialPageParam: {},
    getNextPageParam: (last) => last.next_cursor,
    staleTime: 5 * 60_000,
  });
  const all = useAllPages(query);
  const first = query.data?.pages[0];
  const { sites } = overview;

  const columns: Column<MunicipalCandidateOut>[] = [
    {
      id: 'rank',
      header: m.mun_col_rank(),
      value: (c) => c.rank,
      cell: (c) => <span className="font-medium tabular-nums">{formatNumber(c.rank)}</span>,
      primary: true,
      width: 80,
      align: 'right',
      filter: false,
    },
    {
      id: 'site',
      header: m.mun_col_site(),
      value: (c) => c.site.site_id,
      cell: (c) => <span className="tabular-nums">{c.site.site_id}</span>,
      width: 130,
    },
    {
      id: 'parish',
      header: m.mun_col_parish(),
      value: (c) => c.site.parish_name,
      cell: (c) => c.site.parish_name ?? dash,
      filter: true,
      className: 'whitespace-normal',
      width: 220,
    },
    {
      id: 'reasons',
      header: m.mun_col_reasons(),
      value: (c) => reasonsText(c),
      cell: (c) => reasonsText(c) || dash,
      filter: 'text',
      className: 'whitespace-normal',
      width: 260,
      full: true,
    },
    {
      id: 'kinds',
      header: m.mun_col_kind(),
      value: (c) => c.site.kinds.map((k) => kindLabel[k]()).join(', '),
      cell: (c) => c.site.kinds.map((k) => kindLabel[k]()).join(', '),
      filter: 'text',
      className: 'whitespace-normal',
      width: 180,
      desktopOnly: true,
    },
    {
      id: 'precision',
      header: m.mun_col_precision(),
      value: (c) => precisionLabel[c.site.coord_precision](),
      cell: (c) => precisionLabel[c.site.coord_precision](),
      filter: true,
      badge: true,
    },
    {
      id: 'containers',
      header: m.mun_col_containers(),
      value: (c) => c.site.containers,
      cell: (c) => formatNumber(c.site.containers),
      align: 'right',
      filter: 'range',
      desktopOnly: true,
    },
    {
      id: 'organic15',
      header: m.mun_col_organic_near(),
      value: (c) => yesNo(c.site.organic_collective_within_15m > 0),
      cell: (c) => yesNo(c.site.organic_collective_within_15m > 0),
      filter: true,
      defaultHidden: true,
    },
    {
      id: 'nn',
      header: m.mun_col_nn(),
      value: (c) => c.site.nn_distance_m,
      cell: (c) => (c.site.nn_distance_m == null ? dash : formatMetres(c.site.nn_distance_m)),
      format: formatMetres,
      align: 'right',
      filter: 'range',
      desktopOnly: true,
    },
    {
      id: 'gap',
      header: (
        <span className="inline-flex items-center gap-1.5">
          {m.mun_col_gap_per_candidate()} <EstimateBadge />
        </span>
      ),
      label: m.mun_col_gap_per_candidate(),
      value: (c) => c.parish_gap_t_per_candidate,
      cell: (c) => `${formatNumber(c.parish_gap_t_per_candidate, 2)} t`,
      format: (v) => `${formatNumber(v, 2)} t`,
      align: 'right',
      filter: 'range',
      desktopOnly: true,
    },
    {
      id: 'gap_rank',
      header: m.mun_col_gap_rank(),
      value: (c) => c.parish_gap_rank,
      cell: (c) => `${formatNumber(c.parish_gap_rank)}.º`,
      align: 'right',
      defaultHidden: true,
    },
  ];

  return (
    <div className="space-y-4">
      <Panel className="space-y-3">
        <h3 className="flex flex-wrap items-center gap-2 font-semibold text-sm">
          {m.mun_cand_criterion_title()} <EstimateBadge />
        </h3>
        <p className="max-w-3xl text-sm leading-relaxed">{m.mun_cand_criterion_text()}</p>
        <p className="max-w-3xl text-muted-foreground text-xs leading-relaxed">
          {m.mun_cand_criterion_validate()}
        </p>
        {first && (
          <p className="max-w-3xl text-muted-foreground text-xs leading-relaxed" lang="pt-PT">
            {first.rank_rule}
          </p>
        )}
      </Panel>

      <StatStrip className="lg:grid-cols-3">
        <StatCell
          label={m.mun_cand_stat_total()}
          value={formatNumber(sites.textile_candidates)}
          tag={m.common_estimate()}
          hint={m.mun_cand_stat_total_hint({ total: formatNumber(sites.public) })}
        />
        <StatCell
          label={m.mun_cand_stat_precise()}
          value={formatNumber(sites.textile_candidates_precise)}
          hint={m.mun_cand_stat_precise_hint()}
        />
        <StatCell
          label={m.mun_cand_stat_underground()}
          value={formatNumber(sites.textile_candidates_underground)}
          hint={m.mun_cand_stat_underground_hint()}
        />
      </StatStrip>

      <FilterChips<Precision>
        legend={m.mun_cand_filter()}
        value={precision}
        onChange={(v) => setPrecision(v ?? 'all')}
        options={[
          { value: 'all', label: m.mun_cand_filter_all() },
          { value: 'precise', label: m.mun_cand_filter_precise() },
        ]}
      />

      <DataTable
        id={`municipal-candidates-${precision}`}
        title={m.mun_cand_table_title()}
        columns={columns}
        rows={all.rows}
        getRowId={(c) => c.site.site_id}
        loading={all.loading}
        refreshing={all.loadingMore}
        error={all.rows.length === 0 ? all.error : undefined}
        onRetry={all.retry}
        controls="always"
        pageSize={15}
        initialSort={{ id: 'rank', desc: false }}
        searchLabel={m.mun_cand_search()}
        exportName="rede-municipal-candidatos-texteis"
        rowActions={(c) => [
          {
            id: 'detail',
            label: m.mun_action_detail(),
            icon: <Eye />,
            onSelect: () => onOpenSite(c.site.site_id),
          },
          {
            id: 'map',
            label: m.mun_action_map(),
            icon: <MapPinned />,
            onSelect: () =>
              void navigate({
                to: '/map',
                search: { preset: 'gaps', site: c.site.site_id },
              }),
          },
        ]}
        empty={
          <EmptyState title={m.mun_cand_empty_title()} description={m.mun_cand_empty_text()} />
        }
      />
      <LoadProgress pages={all} />
    </div>
  );
}
