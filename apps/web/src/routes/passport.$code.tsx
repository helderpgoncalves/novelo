import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Loader2, SearchX } from 'lucide-react';
import type { GetLotQrData } from '@/client';
import { getPassportOptions } from '@/client/@tanstack/react-query.gen';
import { client } from '@/client/client.gen';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Button } from '@/components/ui/button';
import { CompositionBar, EventTimeline, LotStateBadge } from '@/features/lots/lot-parts';
import { formatNumber, formatPercent } from '@/lib/format';
import { fibreLabel } from '@/lib/lots';
import { destinationLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

// Página pública (sem sessão): é para onde o QR do lote aponta. Só mostra o que o reciclador e a câmara precisam.
export const Route = createFileRoute('/passport/$code')({
  head: () => ({ meta: [{ title: m.title_passport() }] }),
  component: PassportPage,
});

function PassportPage() {
  const { code } = Route.useParams();
  const { data: passport, isPending, isError } = useQuery(getPassportOptions({ path: { code } }));
  const qr = client.buildUrl<GetLotQrData>({
    url: '/api/v1/public/lots/{code}/qr',
    path: { code },
  });

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <Link to="/" aria-label="Novelo">
          <BrandLogo className="h-7" />
        </Link>
        <LanguageSwitcher />
      </header>
      <main className="mx-auto max-w-3xl space-y-8 px-4 pb-16">
        {isPending && (
          <div className="grid place-items-center py-24" aria-busy="true">
            <Loader2 className="size-7 animate-spin text-primary" aria-label={m.common_loading()} />
          </div>
        )}
        {isError && (
          <div className="space-y-4 rounded-xl border border-dashed p-10 text-center">
            <SearchX className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <h1 className="text-3xl">{m.passport_not_found_title()}</h1>
            <p className="text-muted-foreground">{m.passport_not_found_text({ code })}</p>
            <Button asChild>
              <Link to="/">{m.common_back_home()}</Link>
            </Button>
          </div>
        )}
        {passport && (
          <>
            <div className="space-y-3">
              <p className="eyebrow">{m.passport_eyebrow()}</p>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl tracking-wide sm:text-5xl">{passport.code}</h1>
                <LotStateBadge state={passport.state} />
              </div>
              <p className="text-muted-foreground">
                {passport.parish_name
                  ? m.passport_origin({ parish: passport.parish_name })
                  : m.passport_origin_unknown()}
              </p>
            </div>

            <dl className="grid gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border sm:grid-cols-3">
              <div className="space-y-1 bg-card p-5">
                <dt className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
                  {m.lot_stat_weight()}
                </dt>
                <dd className="font-medium font-serif text-4xl tabular-nums">
                  {formatNumber(passport.weight_kg, 1)} kg
                </dd>
              </div>
              <div className="space-y-1 bg-card p-5">
                <dt className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
                  {m.lot_stat_items()}
                </dt>
                <dd className="font-medium font-serif text-4xl tabular-nums">{passport.items}</dd>
              </div>
              <div className="space-y-1 bg-card p-5">
                <dt className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
                  {m.passport_dominant()}
                </dt>
                <dd className="font-medium font-serif text-4xl">
                  {fibreLabel[passport.dominant_fibre]()}
                </dd>
              </div>
            </dl>

            <section className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
              <h2 className="text-xl">{m.lot_composition_title()}</h2>
              <CompositionBar composition={passport.composition} />
              <p className="text-muted-foreground text-xs">{m.passport_composition_note()}</p>
            </section>

            <section className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
              <h2 className="text-xl">{m.passport_destination()}</h2>
              <ul className="grid gap-3 text-sm sm:grid-cols-3">
                {(['reuse', 'recycle', 'reject'] as const).map((d) => (
                  <li key={d} className="space-y-0.5">
                    <p className="text-muted-foreground text-xs">{destinationLabel[d]()}</p>
                    <p className="font-medium font-serif text-2xl tabular-nums">
                      {formatPercent(passport[`${d}_pct` as const], 0)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            {passport.brands.length > 0 && (
              <section className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
                <h2 className="text-xl">{m.passport_brands()}</h2>
                <p className="text-sm">
                  {passport.brands.map((b) => `${b.brand} (${b.items})`).join(' · ')}
                </p>
              </section>
            )}

            <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
              <section className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
                <h2 className="text-xl">{m.lot_history_title()}</h2>
                <EventTimeline events={passport.events} />
              </section>
              <img
                src={qr}
                alt={m.lot_qr_alt({ code: passport.code })}
                className="size-40 place-self-center"
              />
            </div>
            <p className="text-muted-foreground text-xs">{m.passport_privacy()}</p>
          </>
        )}
      </main>
    </div>
  );
}
