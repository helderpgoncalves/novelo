import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { PackageCheck } from 'lucide-react';
import { useState } from 'react';
import type {
  ExportLotState,
  ExportLotSummary,
  FineState,
  GarmentType,
  Gender,
  Season,
} from '@/client';
import { listExportLotsOptions } from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable } from '@/components/data-table';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { Button } from '@/components/ui/button';
import { CreateExportLotDialog } from '@/features/export-lots/create-dialog';
import { ExportStateBadge } from '@/features/export-lots/key-parts';
import { formatNumber } from '@/lib/format';
import { formatDateTime } from '@/lib/i18n';
import { garmentLabel } from '@/lib/lots';
import { fineStateLabel, genderLabel, seasonLabel } from '@/lib/taxonomy';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/export-lots/')({
  staticData: { skeleton: 'table' },
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(listExportLotsOptions()),
  head: () => ({ meta: [{ title: m.title_export_lots() }] }),
  component: ExportLots,
});

function ExportLots() {
  const { data: lots } = useSuspenseQuery(listExportLotsOptions());
  const [creating, setCreating] = useState(false);
  const count = (...states: ExportLotState[]) =>
    lots.filter((l) => states.includes(l.state)).length;

  return (
    <Page>
      <PageHeader
        eyebrow={m.export_lots_eyebrow()}
        title={m.title_export_lots()}
        description={m.export_lots_description()}
        actions={
          <Button className="h-10 gap-2 font-semibold" onClick={() => setCreating(true)}>
            <PackageCheck /> {m.export_lots_create()}
          </Button>
        }
      />
      {lots.length === 0 ? (
        <div className="space-y-6">
          <p className="max-w-3xl text-muted-foreground text-sm leading-relaxed">
            {m.export_lots_description()}
          </p>
          <div className="rounded-xl border border-dashed p-10 text-center">
            <PackageCheck className="mx-auto mb-4 size-10 text-muted-foreground" />
            <p className="font-medium font-serif text-lg">{m.export_lots_empty_title()}</p>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm leading-relaxed">
              {m.export_lots_empty_text()}
            </p>
            <Button className="mt-6 h-10 gap-2 font-semibold" onClick={() => setCreating(true)}>
              <PackageCheck /> {m.export_lots_create()}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <StatStrip>
            <StatCell
              label={m.export_lots_stat_open()}
              value={formatNumber(count('open'))}
              hint={m.export_lots_stat_open_hint()}
              tone="primary"
            />
            <StatCell label={m.export_lots_stat_closed()} value={formatNumber(count('closed'))} />
            <StatCell
              label={m.export_lots_stat_items()}
              value={formatNumber(lots.reduce((s, l) => s + l.items, 0))}
            />
            <StatCell
              label={m.export_lots_stat_weight()}
              value={`${formatNumber(
                lots.reduce((s, l) => s + l.weight_kg, 0),
                2,
              )} kg`}
              tag={m.common_estimate()}
            />
          </StatStrip>
          <DataTable
            id="export-lots"
            exportName="lotes-de-escoamento"
            columns={columns}
            rows={lots}
            getRowId={(l) => l.code}
            caption={m.title_export_lots()}
            searchLabel={m.export_lots_search()}
          />
        </div>
      )}
      <CreateExportLotDialog open={creating} onOpenChange={setCreating} />
    </Page>
  );
}

const columns: Column<ExportLotSummary>[] = [
  {
    id: 'code',
    header: m.export_lots_col_code(),
    primary: true,
    className: 'tabular-nums',
    value: (l) => l.code,
    cell: (l) => (
      <Link to="/export-lots/$code" params={{ code: l.code }} className="hover:underline">
        {l.code}
      </Link>
    ),
  },
  {
    id: 'state',
    header: m.export_lots_col_state(),
    badge: true,
    value: (l) => l.state,
    filter: { format: (v) => (v === 'open' ? m.export_state_open() : m.export_state_closed()) },
    cell: (l) => <ExportStateBadge state={l.state} />,
  },
  {
    id: 'fine_state',
    header: m.export_lots_col_fine_state(),
    value: (l) => l.fine_state,
    filter: { format: (v) => fineStateLabel[v as FineState]() },
    cell: (l) => fineStateLabel[l.fine_state](),
  },
  {
    id: 'garment_type',
    header: m.export_lots_col_garment(),
    value: (l) => l.garment_type,
    filter: { format: (v) => garmentLabel[v as GarmentType]() },
    cell: (l) => garmentLabel[l.garment_type](),
  },
  {
    id: 'season',
    header: m.export_lots_col_season(),
    value: (l) => l.season,
    filter: { format: (v) => seasonLabel[v as Season]() },
    cell: (l) => seasonLabel[l.season](),
  },
  {
    id: 'gender',
    header: m.export_lots_col_gender(),
    value: (l) => l.gender,
    filter: { format: (v) => genderLabel[v as Gender]() },
    cell: (l) => genderLabel[l.gender](),
  },
  {
    id: 'items',
    header: m.export_lots_col_items(),
    align: 'right',
    value: (l) => l.items,
    searchable: false,
    cell: (l) => l.items,
  },
  {
    id: 'weight',
    header: m.export_lots_col_weight(),
    align: 'right',
    value: (l) => l.weight_kg,
    searchable: false,
    cell: (l) => `${formatNumber(l.weight_kg, 2)} kg`,
  },
  {
    id: 'collection_lots',
    header: m.export_lots_col_lots(),
    align: 'right',
    value: (l) => l.collection_lots,
    searchable: false,
    cell: (l) => l.collection_lots,
  },
  {
    id: 'localities',
    header: m.export_lots_col_localities(),
    align: 'right',
    value: (l) => l.localities,
    searchable: false,
    cell: (l) => l.localities,
  },
  {
    id: 'closed_at',
    type: 'datetime',
    header: m.export_lots_col_closed(),
    className: 'text-muted-foreground',
    value: (l) => l.closed_at,
    searchable: false,
    cell: (l) => (l.closed_at ? formatDateTime(l.closed_at) : m.common_dash()),
  },
];
