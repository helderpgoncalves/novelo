import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Eye, MapPinned } from 'lucide-react';
import type { MunicipalSiteOut } from '@/client';
import { listMunicipalSitesInfiniteOptions } from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { EmptyState } from '@/components/states';
import { formatLitres, formatMetres, formatNumber } from '@/lib/format';
import { formatList } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { LoadProgress } from './load-progress';
import { ServerExport } from './server-export';
import { useAllPages } from './use-all-pages';
import { kindLabel, precisionLabel, producerLabel, siteClassLabel, streamLabel } from './vocab';

const PAGE = 500;
const dash = <span className="text-muted-foreground">{m.common_dash()}</span>;
const yesNo = (v: boolean) => (v ? m.mun_yes() : m.mun_no());

export function SiteExpanded({ s }: { s: MunicipalSiteOut }) {
  const streams = [
    s.by_stream.organico > 0 && `${streamLabel.organico()}: ${formatNumber(s.by_stream.organico)}`,
    s.by_stream.verdes > 0 && `${streamLabel.verdes()}: ${formatNumber(s.by_stream.verdes)}`,
    s.by_stream.desconhecido > 0 &&
      `${streamLabel.desconhecido()}: ${formatNumber(s.by_stream.desconhecido)}`,
  ].filter(Boolean);
  return (
    <dl className="grid gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <dt className="text-muted-foreground text-xs">{m.mun_fact_kinds()}</dt>
        <dd>{formatList(s.kinds.map((k) => kindLabel[k]()))}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground text-xs">{m.mun_fact_streams()}</dt>
        <dd>{streams.join(' · ')}</dd>
      </div>
      {s.producer_types.length > 0 && (
        <div>
          <dt className="text-muted-foreground text-xs">{m.mun_fact_producers()}</dt>
          <dd>{formatList(s.producer_types.map((t) => producerLabel[t]()))}</dd>
        </div>
      )}
      {s.streets.length > 0 && (
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground text-xs">{m.mun_fact_streets()}</dt>
          <dd>{s.streets.join(', ')}</dd>
        </div>
      )}
      {s.candidate_reason && (
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground text-xs">{m.mun_site_candidate_title()}</dt>
          <dd lang="pt-PT">{s.candidate_reason}</dd>
        </div>
      )}
    </dl>
  );
}

export function SitesTab({ onOpenSite }: { onOpenSite: (id: string) => void }) {
  const navigate = useNavigate();
  const query = useInfiniteQuery({
    ...listMunicipalSitesInfiniteOptions({ query: { limit: PAGE } }),
    // A primeira página não leva cursor (o cliente gerado só aceita objetos aqui).
    initialPageParam: {},
    getNextPageParam: (last) => last.next_cursor,
    staleTime: 5 * 60_000,
  });
  const all = useAllPages(query);

  const columns: Column<MunicipalSiteOut>[] = [
    {
      id: 'site',
      header: m.mun_col_site(),
      value: (s) => s.site_id,
      cell: (s) => <span className="font-medium tabular-nums">{s.site_id}</span>,
      primary: true,
      width: 130,
    },
    {
      id: 'parish',
      header: m.mun_col_parish(),
      value: (s) => s.parish_name,
      cell: (s) => s.parish_name ?? dash,
      filter: true,
      className: 'whitespace-normal',
      width: 220,
    },
    {
      id: 'class',
      header: m.mun_col_class(),
      value: (s) => siteClassLabel[s.site_class](),
      cell: (s) => siteClassLabel[s.site_class](),
      filter: true,
      badge: true,
    },
    {
      id: 'kinds',
      header: m.mun_col_kind(),
      value: (s) => s.kinds.map((k) => kindLabel[k]()).join(', '),
      cell: (s) => s.kinds.map((k) => kindLabel[k]()).join(', '),
      filter: 'text',
      className: 'whitespace-normal',
      width: 200,
    },
    {
      id: 'containers',
      header: m.mun_col_containers(),
      value: (s) => s.containers,
      cell: (s) => formatNumber(s.containers),
      aggregate: 'sum',
      format: formatNumber,
      align: 'right',
      filter: 'range',
    },
    {
      id: 'capacity',
      header: m.mun_col_capacity(),
      value: (s) => s.capacity_litres_total,
      cell: (s) => formatLitres(s.capacity_litres_total),
      aggregate: 'sum',
      format: formatLitres,
      align: 'right',
      defaultHidden: true,
    },
    {
      id: 'nn',
      header: m.mun_col_nn(),
      value: (s) => s.nn_distance_m,
      cell: (s) => (s.nn_distance_m == null ? dash : formatMetres(s.nn_distance_m)),
      format: formatMetres,
      align: 'right',
      filter: 'range',
    },
    {
      id: 'precision',
      header: m.mun_col_precision(),
      value: (s) => precisionLabel[s.coord_precision](),
      cell: (s) => precisionLabel[s.coord_precision](),
      filter: true,
      desktopOnly: true,
    },
    {
      id: 'candidate',
      header: m.mun_col_candidate(),
      value: (s) => yesNo(s.textile_candidate),
      cell: (s) => yesNo(s.textile_candidate),
      filter: true,
      desktopOnly: true,
    },
    {
      id: 'suspect',
      header: m.mun_col_suspect_site(),
      value: (s) => yesNo(s.coord_suspect_containers > 0),
      cell: (s) => yesNo(s.coord_suspect_containers > 0),
      filter: true,
      defaultHidden: true,
    },
    {
      id: 'streets',
      header: m.mun_fact_streets(),
      value: (s) => s.streets.join(', '),
      cell: (s) => (s.streets.length > 0 ? s.streets.join(', ') : dash),
      className: 'whitespace-normal',
      defaultHidden: true,
      width: 260,
    },
  ];

  return (
    <div className="space-y-3">
      <DataTable
        id="municipal-sites"
        title={m.mun_sites_title()}
        caption={m.mun_sites_caption()}
        columns={columns}
        rows={all.rows}
        getRowId={(s) => s.site_id}
        loading={all.loading}
        refreshing={all.loadingMore}
        error={all.rows.length === 0 ? all.error : undefined}
        onRetry={all.retry}
        controls="always"
        pageSize={15}
        initialSort={{ id: 'site', desc: false }}
        searchLabel={m.mun_sites_search()}
        exportName="rede-municipal-locais"
        actions={<ServerExport />}
        renderExpanded={(s) => <SiteExpanded s={s} />}
        rowActions={(s) => [
          {
            id: 'detail',
            label: m.mun_action_detail(),
            icon: <Eye />,
            onSelect: () => onOpenSite(s.site_id),
          },
          {
            id: 'map',
            label: m.mun_action_map(),
            icon: <MapPinned />,
            onSelect: () =>
              void navigate({ to: '/map', search: { preset: 'municipal', site: s.site_id } }),
          },
        ]}
        empty={
          <EmptyState title={m.mun_sites_empty_title()} description={m.mun_sites_empty_text()} />
        }
      />
      <LoadProgress pages={all} />
    </div>
  );
}
