import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import type {
  Colour,
  ExportLotItemOut,
  FineState,
  GarmentType,
  Gender,
  Season,
  SizeBand,
} from '@/client';
import {
  closeExportLotMutation,
  getExportLotOptions,
  getExportLotQueryKey,
  listExportLotsQueryKey,
} from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { Page, Panel } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { Button } from '@/components/ui/button';
import { ProvenanceSeals, provenanceSummary } from '@/features/export-lots/key-parts';
import { getErrorMessage } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
import { formatDateTime } from '@/lib/i18n';
import { garmentLabel } from '@/lib/lots';
import {
  colourLabel,
  fineStateLabel,
  genderLabel,
  seasonLabel,
  sizeBandLabel,
} from '@/lib/taxonomy';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/export-lots/$code')({
  staticData: { skeleton: 'detail' },
  loader: ({ context: { queryClient }, params }) =>
    queryClient.ensureQueryData(getExportLotOptions({ path: { code: params.code } })),
  head: () => ({ meta: [{ title: m.title_export_lot() }] }),
  component: ExportLotPage,
});

function ExportLotPage() {
  const { code } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: lot } = useSuspenseQuery(getExportLotOptions({ path: { code } }));

  const seal = useMutation({
    ...closeExportLotMutation(),
    onSuccess: (closed) => {
      queryClient.setQueryData(getExportLotQueryKey({ path: { code } }), closed);
      void queryClient.invalidateQueries({ queryKey: listExportLotsQueryKey() });
      toast.success(m.export_lot_closed_toast());
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <Page>
      <PageHeader
        eyebrow={`${fineStateLabel[lot.fine_state]()} · ${garmentLabel[lot.garment_type]()} · ${seasonLabel[lot.season]()} · ${genderLabel[lot.gender]()}`}
        title={lot.code}
        description={m.export_lot_description()}
        actions={
          lot.state === 'open' && (
            <Button
              className="h-10 gap-2 font-semibold"
              disabled={seal.isPending}
              onClick={() => seal.mutate({ path: { code } })}
            >
              <PackageCheck /> {m.export_lot_close()}
            </Button>
          )
        }
      />
      <StatStrip>
        <StatCell
          label={m.export_lots_col_state()}
          value={lot.state === 'open' ? m.export_state_open() : m.export_state_closed()}
          tone="primary"
          hint={lot.closed_at ? formatDateTime(lot.closed_at) : undefined}
        />
        <StatCell label={m.export_lot_stat_items()} value={formatNumber(lot.items)} />
        <StatCell
          label={m.export_lot_stat_weight()}
          value={`${formatNumber(lot.weight_kg, 2)} kg`}
          tag={m.common_estimate()}
        />
        <StatCell
          label={m.export_lot_stat_lineage()}
          value={`${formatNumber(lot.collection_lots)} / ${formatNumber(lot.localities)}`}
          hint={m.export_lot_stat_lineage_hint({
            lots: lot.collection_lots,
            localities: lot.localities,
          })}
        />
      </StatStrip>

      <LineagePanel code={code} />

      <DataTable
        id="export-lot-items"
        exportName={`lote-${lot.code}`}
        columns={itemColumns}
        rows={lot.item_list}
        getRowId={(i) => i.id}
        caption={m.export_lot_lineage_title()}
        searchLabel={m.export_lot_items_search()}
      />
    </Page>
  );
}

/** Linhagem: os lotes de recolha de origem e a paragem de cada um, mais pesado primeiro. */
function LineagePanel({ code }: { code: string }) {
  const { data: lot } = useSuspenseQuery(getExportLotOptions({ path: { code } }));
  return (
    <Panel className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-medium font-serif text-lg">{m.export_lot_lineage_title()}</h2>
        <p className="text-muted-foreground text-sm">{m.export_lot_lineage_hint()}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4 font-medium">{m.export_lot_lineage_col_lot()}</th>
              <th className="py-2 pr-4 font-medium">{m.export_lot_lineage_col_locality()}</th>
              <th className="py-2 pr-4 font-medium">{m.export_lot_lineage_col_parish()}</th>
              <th className="py-2 pr-4 text-right font-medium">
                {m.export_lot_lineage_col_items()}
              </th>
              <th className="py-2 text-right font-medium">{m.export_lot_lineage_col_weight()}</th>
            </tr>
          </thead>
          <tbody>
            {lot.lineage.map((o) => (
              <tr key={o.lot_code} className="border-b last:border-0">
                <td className="py-2 pr-4">
                  <Link to="/lots/$code" params={{ code: o.lot_code }} className="hover:underline">
                    {o.lot_code}
                  </Link>
                </td>
                <td className="py-2 pr-4">{o.locality_name ?? m.common_dash()}</td>
                <td className="py-2 pr-4 text-muted-foreground">
                  {o.parish_name ?? m.common_dash()}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">{o.items}</td>
                <td className="py-2 text-right tabular-nums">{formatNumber(o.weight_kg, 2)} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

const itemColumns: Column<ExportLotItemOut>[] = [
  {
    id: 'garment_type',
    header: m.export_lot_items_col_garment(),
    primary: true,
    value: (i) => i.garment_type,
    filter: { format: (v) => garmentLabel[v as GarmentType]() },
    cell: (i) => garmentLabel[i.garment_type](),
  },
  {
    id: 'fine_state',
    header: m.export_lot_items_col_fine_state(),
    badge: true,
    value: (i) => i.fine_state,
    filter: { format: (v) => fineStateLabel[v as FineState]() },
    cell: (i) => fineStateLabel[i.fine_state](),
  },
  {
    id: 'season',
    header: m.export_lot_items_col_season(),
    value: (i) => i.season,
    filter: { format: (v) => seasonLabel[v as Season]() },
    cell: (i) => seasonLabel[i.season](),
  },
  {
    // Cor e tamanho: fora da chave, só filtros (o pedido do comprador: «tens azul M?»).
    id: 'colour',
    header: m.export_lot_items_col_colour(),
    value: (i) => i.colour,
    filter: { format: (v) => colourLabel[v as Colour]() },
    cell: (i) => i.colour && colourLabel[i.colour](),
  },
  {
    id: 'size_band',
    header: m.export_lot_items_col_size(),
    value: (i) => i.size_band,
    filter: { format: (v) => sizeBandLabel[v as SizeBand]() },
    cell: (i) => i.size_band && sizeBandLabel[i.size_band](),
  },
  {
    id: 'gender',
    header: m.export_lot_items_col_gender(),
    value: (i) => i.gender,
    filter: { format: (v) => genderLabel[v as Gender]() },
    cell: (i) => genderLabel[i.gender](),
  },
  {
    id: 'brand',
    header: m.export_lot_items_col_brand(),
    value: (i) => i.brand,
    filter: true,
    cell: (i) => i.brand ?? m.common_dash(),
  },
  {
    id: 'weight',
    header: m.export_lot_items_col_weight(),
    align: 'right',
    value: (i) => i.estimated_weight_g,
    searchable: false,
    cell: (i) => `${formatNumber(i.estimated_weight_g / 1000, 2)} kg`,
  },
  {
    id: 'origin',
    header: m.export_lot_items_col_lot(),
    value: (i) => i.lot_code,
    cell: (i) => (
      <Link to="/lots/$code" params={{ code: i.lot_code }} className="hover:underline">
        {i.lot_code}
      </Link>
    ),
  },
  {
    id: 'locality',
    header: m.export_lot_lineage_col_locality(),
    className: 'text-muted-foreground',
    value: (i) => i.locality_name,
    filter: true,
    cell: (i) => i.locality_name ?? m.common_dash(),
  },
  {
    id: 'added_at',
    type: 'datetime',
    header: m.export_lot_items_col_added(),
    className: 'text-muted-foreground',
    value: (i) => i.added_at,
    searchable: false,
    cell: (i) => formatDateTime(i.added_at),
  },
  {
    id: 'provenance',
    header: m.triage_provenance_title(),
    value: (i) => (i.provenance ? provenanceSummary(i.provenance) : ''),
    searchable: false,
    cell: (i) => (i.provenance ? <ProvenanceSeals provenance={i.provenance} /> : m.common_dash()),
  },
];
