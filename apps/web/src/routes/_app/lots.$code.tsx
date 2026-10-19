import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CheckCheck, ExternalLink, ScanLine, Truck } from 'lucide-react';
import { toast } from 'sonner';
import type { GetLotQrData } from '@/client';
import {
  changeLotStateMutation,
  getLotOptions,
  getLotQueryKey,
  listLotsQueryKey,
} from '@/client/@tanstack/react-query.gen';
import { client } from '@/client/client.gen';
import { PageHeader } from '@/components/page-header';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CompositionBar, EventTimeline } from '@/features/lots/lot-parts';
import { getErrorMessage } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
import { formatDateTime } from '@/lib/i18n';
import { fibreLabel, garmentLabel, lotStateLabel } from '@/lib/lots';
import { destinationLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/lots/$code')({
  loader: ({ context: { queryClient }, params }) =>
    queryClient.ensureQueryData(getLotOptions({ path: { code: params.code } })),
  head: () => ({ meta: [{ title: m.title_lot() }] }),
  component: LotPage,
});

function LotPage() {
  const { code } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: lot } = useSuspenseQuery(getLotOptions({ path: { code } }));
  const qr = client.buildUrl<GetLotQrData>({
    url: '/api/v1/public/lots/{code}/qr',
    path: { code },
  });

  const change = useMutation({
    ...changeLotStateMutation(),
    onSuccess: async (updated) => {
      queryClient.setQueryData(getLotQueryKey({ path: { code } }), updated);
      await queryClient.invalidateQueries({ queryKey: listLotsQueryKey() });
      toast.success(m.lot_state_changed());
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={`${lot.parish_name ?? m.lot_no_parish()} · ${formatDateTime(lot.opened_at)}`}
        title={lot.code}
        description={m.lot_description()}
        actions={
          <>
            {lot.state === 'collected' && (
              <>
                <Button asChild variant="outline" className="h-10 gap-2">
                  <Link to="/triage" search={{ lot: lot.code }}>
                    <ScanLine /> {m.lot_add_items()}
                  </Link>
                </Button>
                <Button
                  className="h-10 gap-2 font-semibold"
                  disabled={lot.items === 0 || change.isPending}
                  onClick={() => change.mutate({ path: { code }, body: { state: 'sorted' } })}
                >
                  <CheckCheck /> {m.lot_close()}
                </Button>
              </>
            )}
            {(lot.state === 'reserved' || lot.state === 'sorted') && (
              <Button
                variant="outline"
                className="h-10 gap-2"
                disabled={change.isPending}
                onClick={() => change.mutate({ path: { code }, body: { state: 'delivered' } })}
              >
                <Truck /> {m.lot_mark_delivered()}
              </Button>
            )}
            <Button asChild variant="outline" className="h-10 gap-2">
              <a href={`/passport/${lot.code}`} target="_blank" rel="noreferrer">
                <ExternalLink /> {m.lot_open_passport()}
              </a>
            </Button>
          </>
        }
      />

      <StatStrip>
        <StatCell
          label={m.lot_stat_state()}
          value={lotStateLabel[lot.state]()}
          tone="primary"
          hint={
            lot.reservation ? m.lot_reserved_by({ name: lot.reservation.recycler_name }) : undefined
          }
        />
        <StatCell
          label={m.lot_stat_items()}
          value={formatNumber(lot.items)}
          hint={m.lot_stat_fibre({ fibre: fibreLabel[lot.dominant_fibre]() })}
        />
        <StatCell
          label={m.lot_stat_weight()}
          value={`${formatNumber(lot.weight_kg, 2)} kg`}
          tag={m.common_estimate()}
          hint={m.lot_stat_weight_hint()}
        />
        <StatCell
          label={m.lot_stat_destination()}
          value={`${formatNumber(lot.reuse_kg, 1)} kg`}
          hint={m.lot_stat_destination_hint({
            reuse: formatNumber(lot.reuse_kg, 1),
            recycle: formatNumber(lot.recycle_kg, 1),
            reject: formatNumber(lot.reject_kg, 1),
          })}
        />
      </StatStrip>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <aside className="space-y-6 self-start">
          <div className="space-y-4 rounded-xl bg-card p-5 text-center ring-1 ring-foreground/10 print:ring-0">
            <img src={qr} alt={m.lot_qr_alt({ code: lot.code })} className="mx-auto size-48" />
            <p className="font-medium font-serif text-xl tracking-widest">{lot.code}</p>
            <div className="flex justify-center gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                {m.lot_print_label()}
              </Button>
              <Button asChild variant="ghost" size="sm">
                <a href={qr} download={`${lot.code}.svg`}>
                  {m.lot_download_qr()}
                </a>
              </Button>
            </div>
          </div>
          <div className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10 print:hidden">
            <h2 className="text-lg">{m.lot_composition_title()}</h2>
            <CompositionBar composition={lot.composition} />
          </div>
          <div className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10 print:hidden">
            <h2 className="text-lg">{m.lot_history_title()}</h2>
            <EventTimeline events={lot.events} />
          </div>
        </aside>

        <section className="min-w-0 space-y-3 print:hidden">
          <h2 className="text-2xl">{m.lot_items_title()}</h2>
          {lot.item_list.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
              {m.lot_items_empty()}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-10 px-4">{m.triage_garment()}</TableHead>
                    <TableHead className="h-10">{m.triage_condition()}</TableHead>
                    <TableHead className="h-10">{m.lots_col_fibre()}</TableHead>
                    <TableHead className="h-10">{m.triage_brand()}</TableHead>
                    <TableHead className="h-10 text-right">{m.lots_col_weight()}</TableHead>
                    <TableHead className="h-10 pr-4 text-right">
                      {m.lot_item_confidence()}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lot.item_list.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="px-4 font-medium">
                        {garmentLabel[i.garment_type]()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={i.condition === 'reject' ? 'outline' : 'secondary'}
                          className="font-semibold text-[10px] uppercase tracking-wider"
                        >
                          {destinationLabel[i.condition]()}
                        </Badge>
                      </TableCell>
                      <TableCell>{fibreLabel[i.dominant_fibre]()}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {i.brand ?? m.common_dash()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {i.estimated_weight_g} g
                      </TableCell>
                      <TableCell className="pr-4 text-right tabular-nums">
                        {Math.round(i.confidence * 100)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {lot.reservation && (
            <div className="space-y-1 rounded-xl bg-card p-5 text-sm ring-1 ring-foreground/10">
              <p className="eyebrow">{m.lot_reservation_title()}</p>
              <p className="font-medium">{lot.reservation.recycler_name}</p>
              <p className="text-muted-foreground">{lot.reservation.contact}</p>
              {lot.reservation.note && (
                <p className="text-muted-foreground">{lot.reservation.note}</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
