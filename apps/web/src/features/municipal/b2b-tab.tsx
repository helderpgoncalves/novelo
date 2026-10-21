import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { BedDouble, Eye, Hotel, MapPinned } from 'lucide-react';
import { useState } from 'react';
import type { MunicipalProducerSite, ProducerType } from '@/client';
import { getB2bChannelOptions } from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { Panel } from '@/components/page';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { EmptyState, ErrorState } from '@/components/states';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useCurrentUser } from '@/features/auth/use-current-user';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { HBarChart } from './bar-chart';
import { precisionLabel, producerLabel } from './vocab';

const dash = <span className="text-muted-foreground">{m.common_dash()}</span>;
const typesText = (s: MunicipalProducerSite) =>
  s.producer_types.map((t) => producerLabel[t]()).join(', ');
const TYPE_LABEL: Partial<Record<ProducerType, () => string>> = {
  care_home: () => m.b2b_type_care_home(),
  hospitality: () => m.b2b_type_hospitality(),
};
const TYPE_ICON: Partial<Record<ProducerType, typeof Hotel>> = {
  care_home: BedDouble,
  hospitality: Hotel,
};

/**
 * Canal B2B (lares e hotelaria): roupa de cama e toalhas, têxtil limpo de alto valor de reutilização, à parte da rede
 * para os habitantes. Locais e contagens reais do pacote municipal; toneladas «a medir no piloto» (sem quilos por
 * estabelecimento, não se inventam). Os nomes são privados: só um admin os pede.
 */
export function B2bTab({ onOpenSite }: { onOpenSite: (id: string) => void }) {
  const navigate = useNavigate();
  const isAdmin = useCurrentUser()?.role === 'admin';
  const [showNames, setShowNames] = useState(false);
  const query = useQuery({
    ...getB2bChannelOptions({ query: { show_names: isAdmin && showNames } }),
    staleTime: 5 * 60_000,
  });
  const data = query.data;
  const namesVisible = data?.names_visible === true;

  const columns: Column<MunicipalProducerSite>[] = [
    {
      id: 'type',
      header: m.b2b_col_type(),
      primary: true,
      value: typesText,
      filter: true,
      cell: (s) => <span className="font-medium">{typesText(s)}</span>,
      width: 160,
    },
    ...(namesVisible
      ? [
          {
            id: 'name',
            header: m.b2b_col_name(),
            value: (s: MunicipalProducerSite) => (s.producer_names ?? []).join(', '),
            cell: (s: MunicipalProducerSite) =>
              (s.producer_names ?? []).length ? (s.producer_names ?? []).join(', ') : dash,
            className: 'whitespace-normal',
            width: 260,
            full: true,
          } satisfies Column<MunicipalProducerSite>,
        ]
      : []),
    {
      id: 'parish',
      header: m.b2b_col_parish(),
      value: (s) => s.parish_name,
      filter: true,
      cell: (s) => s.parish_name ?? dash,
      className: 'whitespace-normal',
      width: 240,
    },
    {
      id: 'containers',
      header: m.b2b_col_containers(),
      type: 'number',
      align: 'right',
      searchable: false,
      aggregate: 'sum',
      format: (n) => formatNumber(n),
      value: (s) => s.containers,
      cell: (s) => <span className="tabular-nums">{formatNumber(s.containers)}</span>,
    },
    {
      id: 'precision',
      header: m.mun_col_precision(),
      searchable: false,
      value: (s) => precisionLabel[s.coord_precision](),
      filter: true,
      badge: true,
      cell: (s) => precisionLabel[s.coord_precision](),
    },
    {
      id: 'site',
      header: m.mun_col_site(),
      value: (s) => s.site_id,
      cell: (s) => <span className="text-muted-foreground tabular-nums">{s.site_id}</span>,
      defaultHidden: true,
    },
  ];

  if (query.isPending) {
    return (
      <div className="space-y-4" role="status" aria-label={m.common_loading()}>
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }
  if (query.error || !data) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (data.sites === 0) {
    return <EmptyState title={m.b2b_empty_title()} description={m.b2b_empty_text()} />;
  }

  return (
    <div className="space-y-4">
      <Panel className="space-y-2">
        <h3 className="font-semibold text-base">{m.b2b_title()}</h3>
        <p className="max-w-3xl text-sm leading-relaxed">{m.b2b_lead()}</p>
        <p className="max-w-3xl text-muted-foreground text-xs leading-relaxed">
          {m.b2b_separate()}
        </p>
      </Panel>

      <StatStrip>
        <StatCell
          label={m.b2b_stat_sites()}
          value={formatNumber(data.sites)}
          tone="primary"
          hint={m.b2b_stat_sites_hint({ parishes: formatNumber(data.by_parish.length) })}
        />
        {data.by_type.map((t) => {
          const Icon = TYPE_ICON[t.type];
          return (
            <StatCell
              key={t.type}
              label={(TYPE_LABEL[t.type] ?? producerLabel[t.type])()}
              value={formatNumber(t.sites)}
              hint={
                <span className="inline-flex items-center gap-1.5">
                  {Icon && <Icon className="size-3.5" aria-hidden="true" />}
                  {m.b2b_stat_type_hint({ containers: formatNumber(t.containers) })}
                </span>
              }
            />
          );
        })}
        <StatCell
          label={m.b2b_stat_tonnes()}
          tone={data.tonnes_year == null ? 'muted' : 'default'}
          value={
            data.tonnes_year == null
              ? m.b2b_stat_tonnes_pending()
              : formatNumber(data.tonnes_year, 1)
          }
          hint={m.b2b_stat_tonnes_hint()}
        />
      </StatStrip>

      <Panel className="space-y-3">
        <div className="space-y-1">
          <h3 className="font-semibold text-base">{m.b2b_by_parish_title()}</h3>
          <p className="text-muted-foreground text-sm">{m.b2b_by_parish_text()}</p>
        </div>
        <HBarChart
          items={data.by_parish.map((p) => ({ label: p.name, value: p.containers }))}
          format={(v) => formatNumber(v)}
          ariaLabel={m.b2b_by_parish_aria()}
          labelHeader={m.b2b_col_parish()}
          valueHeader={m.b2b_stat_sites()}
        />
      </Panel>

      <DataTable
        id="municipal-b2b"
        title={m.b2b_table_title()}
        columns={columns}
        rows={data.items}
        getRowId={(s) => s.site_id}
        refreshing={query.isFetching}
        searchLabel={m.b2b_search()}
        exportName="canal-b2b-lares-hotelaria"
        pageSize={10}
        initialSort={{ id: 'containers', desc: true }}
        actions={
          isAdmin ? (
            <Label className="flex min-h-10 items-center gap-2 font-normal text-sm">
              <Switch checked={showNames} onCheckedChange={setShowNames} />
              {m.b2b_names_toggle()}
            </Label>
          ) : undefined
        }
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
        empty={<EmptyState title={m.b2b_empty_title()} description={m.b2b_empty_text()} />}
      />
      {!namesVisible && (
        <p className="text-muted-foreground text-xs leading-relaxed">{m.b2b_names_hidden()}</p>
      )}
    </div>
  );
}
