import { useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import type { BrandStat, Fibre } from '@/client';
import { getBrandEvidenceOptions } from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { StatStripSkeleton } from '@/components/skeletons';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { EmptyState, ErrorState } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatNumber, formatPercent } from '@/lib/format';
import { fibreLabel } from '@/lib/lots';
import { m } from '@/paraglide/messages';
import { PilotEmpty } from './pilot-empty';

const MIN_SAMPLE = 30;
const TOP = 5;

/** Evidência por marca: quilos e composição por marca a partir das peças triadas, para a discussão da RAP. */
export function BrandsTab() {
  const { data, isPending, isFetching, error, refetch } = useQuery(getBrandEvidenceOptions());

  if (isPending) return <StatStripSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  if (data.sample_items === 0) {
    return (
      <div className="space-y-5">
        <p className="max-w-3xl text-muted-foreground text-sm leading-relaxed">
          {m.rw_brands_description()}
        </p>
        <PilotEmpty
          title={m.brands_empty_pilot_title()}
          text={m.brands_empty_pilot_text({ min: MIN_SAMPLE })}
        />
        <p className="text-muted-foreground text-xs">{m.brands_privacy()}</p>
      </div>
    );
  }

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
      aggregate: 'sum',
      format: (v) => `${formatNumber(v, 2)} kg`,
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
    <div className="space-y-6">
      <p className="max-w-3xl text-muted-foreground text-sm leading-relaxed">
        {m.rw_brands_description()}
      </p>
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
          value={`${formatNumber(data.total_kg, 2)} kg`}
          tag={m.common_estimate()}
          hint={m.brands_stat_weight_hint()}
        />
        <StatCell
          label={m.rw_brands_stat_top()}
          value={formatPercent(topShare)}
          tone="primary"
          hint={
            Math.min(TOP, data.brands.length) === 1
              ? m.rw_brands_stat_top_hint_one()
              : m.rw_brands_stat_top_hint({ count: Math.min(TOP, data.brands.length) })
          }
        />
      </StatStrip>
      {small && (
        <Alert>
          <Info className="size-4" />
          <AlertDescription>{m.brands_small_sample({ min: MIN_SAMPLE })}</AlertDescription>
        </Alert>
      )}
      <DataTable
        id="brands"
        exportName="marcas"
        columns={columns}
        rows={data.brands}
        getRowId={(b) => b.brand}
        caption={m.brands_title()}
        refreshing={isFetching}
        empty={<EmptyState title={m.brands_empty_title()} description={m.brands_empty_text()} />}
      />
      <p className="text-muted-foreground text-xs">{m.brands_privacy()}</p>
    </div>
  );
}
