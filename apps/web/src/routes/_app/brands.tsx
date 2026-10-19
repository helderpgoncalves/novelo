import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Info } from 'lucide-react';
import type { BrandStat, Fibre } from '@/client';
import { getBrandEvidenceOptions } from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { EmptyState } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatNumber, formatPercent } from '@/lib/format';
import { fibreLabel } from '@/lib/lots';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/brands')({
  staticData: { skeleton: 'table' },
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(getBrandEvidenceOptions()),
  head: () => ({ meta: [{ title: m.title_brands() }] }),
  component: Brands,
});

const MIN_SAMPLE = 30;
const TOP = 5;

function Brands() {
  const { data } = useSuspenseQuery(getBrandEvidenceOptions());
  const small = data.sample_items < MIN_SAMPLE;
  const topShare = [...data.brands]
    .sort((a, b) => b.weight_kg - a.weight_kg)
    .slice(0, TOP)
    .reduce((sum, b) => sum + b.share_pct, 0);
  const max = Math.max(1, ...data.brands.map((b) => b.weight_kg));

  const columns: Column<BrandStat>[] = [
    {
      id: 'brand',
      header: m.brands_col_brand(),
      primary: true,
      value: (b) => b.brand,
      cell: (b) => b.brand,
    },
    {
      id: 'share',
      header: m.brands_col_share(),
      badge: true,
      value: (b) => b.share_pct,
      searchable: false,
      cell: (b) => formatPercent(b.share_pct),
    },
    {
      id: 'weight',
      header: m.brands_col_weight(),
      className: 'w-56',
      full: true,
      value: (b) => b.weight_kg,
      searchable: false,
      cell: (b) => (
        <div className="flex items-center gap-3">
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${(b.weight_kg / max) * 100}%` }}
            />
          </span>
          <span className="w-16 text-right text-xs tabular-nums">
            {formatNumber(b.weight_kg, 2)} kg
          </span>
        </div>
      ),
    },
    {
      id: 'items',
      header: m.lots_col_items(),
      align: 'right',
      value: (b) => b.items,
      searchable: false,
      cell: (b) => b.items,
    },
    {
      id: 'fibre',
      header: m.brands_col_fibre(),
      className: 'text-muted-foreground',
      value: (b) => b.top_fibre,
      filter: { format: (v) => fibreLabel[v as Fibre]() },
      cell: (b) => fibreLabel[b.top_fibre](),
    },
  ];

  return (
    <Page>
      <PageHeader
        eyebrow={m.brands_eyebrow()}
        title={m.brands_title()}
        description={m.rw_brands_description()}
      />
      <StatStrip>
        <StatCell
          label={m.brands_stat_sample()}
          value={formatNumber(data.sample_items)}
          hint={m.brands_stat_sample_hint({ without: data.items_without_brand })}
        />
        <StatCell
          label={m.brands_stat_brands()}
          value={formatNumber(data.brands.length)}
          hint={m.brands_stat_brands_hint()}
        />
        <StatCell
          label={m.brands_stat_weight()}
          value={`${formatNumber(data.total_kg, 1)} kg`}
          tag={m.common_estimate()}
          hint={m.brands_stat_weight_hint()}
        />
        <StatCell
          label={m.rw_brands_stat_top()}
          value={formatPercent(topShare)}
          tone="primary"
          hint={m.rw_brands_stat_top_hint({ count: Math.min(TOP, data.brands.length) })}
        />
      </StatStrip>
      {small && (
        <Alert>
          <Info className="size-4" />
          <AlertDescription>{m.brands_small_sample({ min: MIN_SAMPLE })}</AlertDescription>
        </Alert>
      )}
      {data.brands.length === 0 ? (
        <EmptyState title={m.brands_empty_title()} description={m.brands_empty_text()} />
      ) : (
        <DataTable
          id="brands"
          columns={columns}
          rows={data.brands}
          getKey={(b) => b.brand}
          caption={m.brands_title()}
        />
      )}
      <p className="text-muted-foreground text-xs">{m.brands_privacy()}</p>
    </Page>
  );
}
