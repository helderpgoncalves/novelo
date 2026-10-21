import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ScanLine } from 'lucide-react';
import { z } from 'zod';
import type { Fibre, LotState, LotSummary } from '@/client';
import {
  getBrandEvidenceOptions,
  getFibreMarketOptions,
  listLotsOptions,
} from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { PageTabs } from '@/components/page-tabs';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { Button } from '@/components/ui/button';
import { BrandsTab } from '@/features/lots/brands-tab';
import { LotStateBadge } from '@/features/lots/lot-parts';
import { MarketTab } from '@/features/lots/market-tab';
import { PilotEmpty } from '@/features/lots/pilot-empty';
import { LOTS_TABS, type LotsTab } from '@/features/lots/tabs';
import { formatNumber } from '@/lib/format';
import { formatDateTime } from '@/lib/i18n';
import { fibreLabel, lotStateLabel } from '@/lib/lots';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/lots/')({
  staticData: { skeleton: 'table' },
  // Bolsa de fibra e evidência por marca vivem aqui como separadores: tudo se enche com as triagens do piloto.
  validateSearch: z.object({ tab: z.enum(LOTS_TABS).optional().catch(undefined) }),
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(getFibreMarketOptions());
    void queryClient.prefetchQuery(getBrandEvidenceOptions());
    return queryClient.ensureQueryData(listLotsOptions());
  },
  head: () => ({ meta: [{ title: m.title_lots() }] }),
  component: Lots,
});

function Lots() {
  const { tab = 'lots' } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data } = useSuspenseQuery(listLotsOptions());
  const market = useQuery(getFibreMarketOptions());
  const brands = useQuery(getBrandEvidenceOptions());

  return (
    <Page>
      <PageHeader
        eyebrow={m.lots_eyebrow()}
        title={m.lots_page_title()}
        description={m.rw_lots_description()}
        actions={
          <Button asChild className="h-10 gap-2 font-semibold">
            <Link to="/triage">
              <ScanLine /> {m.lots_start_triage()}
            </Link>
          </Button>
        }
      />
      <PageTabs<LotsTab>
        label={m.lots_tabs_label()}
        value={tab}
        onValueChange={(next) =>
          void navigate({ search: { tab: next === 'lots' ? undefined : next }, replace: true })
        }
        tabs={[
          {
            id: 'lots',
            label: m.lots_title(),
            count: data.length,
            content: <LotsList data={data} />,
          },
          {
            id: 'market',
            label: m.market_title(),
            count: market.data?.reduce((s, e) => s + e.lots, 0),
            content: <MarketTab />,
          },
          {
            id: 'brands',
            label: m.brands_title(),
            count: brands.data?.brands.length,
            content: <BrandsTab />,
          },
        ]}
      />
    </Page>
  );
}

function LotsList({ data }: { data: LotSummary[] }) {
  if (data.length === 0) {
    return (
      <div className="space-y-5">
        <p className="max-w-3xl text-muted-foreground text-sm leading-relaxed">{m.lots_intro()}</p>
        <PilotEmpty title={m.lots_empty_title()} text={m.lots_empty_text()} />
      </div>
    );
  }
  const count = (...states: LotState[]) => data.filter((l) => states.includes(l.state)).length;
  const items = data.reduce((sum, l) => sum + l.items, 0);
  const kg = data.reduce((sum, l) => sum + l.weight_kg, 0);
  return (
    <div className="space-y-6">
      <StatStrip>
        <StatCell
          label={m.rw_lots_stat_total()}
          value={formatNumber(data.length)}
          hint={m.rw_lots_stat_total_hint({ items: formatNumber(items), kg: formatNumber(kg, 1) })}
        />
        <StatCell
          label={m.rw_lots_stat_open()}
          value={formatNumber(count('collected'))}
          hint={m.rw_lots_stat_open_hint()}
          tone="primary"
        />
        <StatCell
          label={m.rw_lots_stat_ready()}
          value={formatNumber(count('sorted'))}
          hint={m.rw_lots_stat_ready_hint()}
        />
        <StatCell
          label={m.rw_lots_stat_out()}
          value={formatNumber(count('reserved', 'delivered'))}
          hint={m.rw_lots_stat_out_hint()}
        />
      </StatStrip>
      <DataTable
        id="lots"
        exportName="lotes"
        columns={columns}
        rows={data}
        getRowId={(l) => l.code}
        caption={m.lots_title()}
        searchLabel={m.lots_search()}
      />
    </div>
  );
}

const columns: Column<LotSummary>[] = [
  {
    id: 'code',
    header: m.lots_col_code(),
    primary: true,
    className: 'tabular-nums',
    value: (l) => l.code,
    cell: (l) => (
      <Link to="/lots/$code" params={{ code: l.code }} className="hover:underline">
        {l.code}
      </Link>
    ),
  },
  {
    id: 'state',
    header: m.lots_col_state(),
    badge: true,
    value: (l) => l.state,
    filter: { format: (v) => lotStateLabel[v as LotState]() },
    cell: (l) => <LotStateBadge state={l.state} />,
  },
  {
    id: 'parish',
    header: m.lots_col_parish(),
    className: 'text-muted-foreground',
    value: (l) => l.parish_name,
    filter: true,
    cell: (l) => l.parish_name ?? m.common_dash(),
  },
  {
    id: 'fibre',
    header: m.lots_col_fibre(),
    value: (l) => l.dominant_fibre,
    filter: { format: (v) => fibreLabel[v as Fibre]() },
    cell: (l) => fibreLabel[l.dominant_fibre](),
  },
  {
    id: 'items',
    header: m.lots_col_items(),
    align: 'right',
    value: (l) => l.items,
    searchable: false,
    cell: (l) => l.items,
  },
  {
    id: 'weight',
    header: m.lots_col_weight(),
    align: 'right',
    value: (l) => l.weight_kg,
    searchable: false,
    cell: (l) => `${formatNumber(l.weight_kg, 2)} kg`,
  },
  {
    id: 'opened',
    type: 'datetime',
    header: m.lots_col_opened(),
    className: 'text-muted-foreground',
    value: (l) => l.opened_at,
    searchable: false,
    cell: (l) => formatDateTime(l.opened_at),
  },
];
