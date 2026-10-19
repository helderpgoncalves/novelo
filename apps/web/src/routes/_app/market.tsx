import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { getFibreMarketOptions } from '@/client/@tanstack/react-query.gen';
import { PageHeader } from '@/components/page-header';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { CompositionBar, LotStateBadge } from '@/features/lots/lot-parts';
import { ReserveDialog } from '@/features/market/reserve-dialog';
import { formatNumber } from '@/lib/format';
import { fibreLabel } from '@/lib/lots';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/market')({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(getFibreMarketOptions()),
  head: () => ({ meta: [{ title: m.title_market() }] }),
  component: Market,
});

function Market() {
  const { data } = useSuspenseQuery(getFibreMarketOptions());
  const [reserving, setReserving] = useState<string | null>(null);
  const totalKg = data.reduce((s, e) => s + e.weight_kg, 0);
  const totalLots = data.reduce((s, e) => s + e.lots, 0);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={m.market_eyebrow()}
        title={m.market_title()}
        description={m.market_description()}
      />
      <StatStrip className="lg:grid-cols-3">
        <StatCell
          label={m.market_stat_lots()}
          value={formatNumber(totalLots)}
          hint={m.market_stat_lots_hint()}
        />
        <StatCell
          label={m.market_stat_weight()}
          value={`${formatNumber(totalKg, 1)} kg`}
          tag={m.common_estimate()}
          tone="primary"
          hint={m.market_stat_weight_hint()}
        />
        <StatCell
          label={m.market_stat_fibres()}
          value={formatNumber(data.length)}
          hint={m.market_stat_fibres_hint()}
        />
      </StatStrip>

      {data.length === 0 ? (
        <EmptyState
          title={m.market_empty_title()}
          description={m.market_empty_text()}
          action={
            <Button asChild>
              <Link to="/lots">{m.nav_lots()}</Link>
            </Button>
          }
        />
      ) : (
        data.map((entry) => (
          <section key={entry.fibre} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl">{fibreLabel[entry.fibre]()}</h2>
              <p className="text-muted-foreground text-sm tabular-nums">
                {m.market_group_summary({
                  lots: entry.lots,
                  kg: formatNumber(entry.weight_kg, 1),
                  parishes: entry.parishes.join(', ') || m.common_dash(),
                })}
              </p>
            </div>
            <ul className="grid gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border md:grid-cols-2">
              {entry.items.map((lot) => (
                <li key={lot.code} className="space-y-3 bg-card p-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium tabular-nums">{lot.code}</p>
                    <LotStateBadge state={lot.state} />
                  </div>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {lot.parish_name ?? m.lot_no_parish()} · {formatNumber(lot.weight_kg, 1)} kg
                  </p>
                  <CompositionBar composition={lot.composition} />
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="h-8"
                      disabled={lot.state !== 'sorted'}
                      onClick={() => setReserving(lot.code)}
                    >
                      {lot.state === 'sorted' ? m.market_reserve() : m.market_reserved_label()}
                    </Button>
                    <Button asChild size="sm" variant="ghost" className="h-8">
                      <a href={`/passport/${lot.code}`} target="_blank" rel="noreferrer">
                        {m.lot_open_passport()}
                      </a>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <ReserveDialog
        code={reserving}
        open={reserving !== null}
        onOpenChange={(open) => !open && setReserving(null)}
      />
    </div>
  );
}
