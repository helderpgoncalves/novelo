import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { GetLotQrData } from '@/client';
import { getPassportOptions } from '@/client/@tanstack/react-query.gen';
import { client } from '@/client/client.gen';
import { BrandLogo, BrandSpinner } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ErrorState } from '@/components/states';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { CompositionBar, EventTimeline, LotStateBadge } from '@/features/lots/lot-parts';
import { ItemThumb, PhotoViewer, type ViewerPhoto } from '@/features/lots/photo-viewer';
import { getErrorCode } from '@/lib/errors';
import { formatNumber, formatPercent } from '@/lib/format';
import { getLocale } from '@/lib/i18n';
import { formatPhotoCredit, photoAlt } from '@/lib/lot-photos';
import { fibreLabel } from '@/lib/lots';
import { ogImage, SITE_URL } from '@/lib/seo';
import { destinationLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';

// Página pública (sem sessão): é para onde o QR do lote aponta. Só mostra o que o reciclador e a câmara precisam.
export const Route = createFileRoute('/passport/$code')({
  // Indexável (o passaporte é público) mas fora do sitemap: há um código por lote.
  head: ({ params }) => ({
    meta: [
      { title: m.title_passport() },
      { name: 'description', content: m.seo_passport_description({ code: params.code }) },
      { name: 'robots', content: 'index, follow' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: m.title_passport() },
      { property: 'og:description', content: m.seo_passport_description({ code: params.code }) },
      { property: 'og:image', content: ogImage('passaporte') },
      { property: 'og:image:alt', content: m.seo_og_alt_passaporte() },
      { name: 'twitter:image', content: ogImage('passaporte') },
    ],
    links: [
      {
        rel: 'canonical',
        href: `${SITE_URL}/${getLocale() === 'en' ? 'en' : 'pt'}/passport/${params.code}`,
      },
    ],
  }),
  component: PassportPage,
});

function PassportPage() {
  const { code } = Route.useParams();
  const {
    data: passport,
    isPending,
    error,
    refetch,
  } = useQuery(getPassportOptions({ path: { code } }));
  // Só um 404 é «lote não encontrado»; sem rede ou com o limite de pedidos atingido mostra-se o erro e tentar de novo.
  const notFound = getErrorCode(error) === 'not_found';
  const [viewing, setViewing] = useState<number | null>(null);
  const photos = useMemo<ViewerPhoto[]>(
    () =>
      (passport?.photos ?? []).map((p) => ({
        id: p.item_id,
        src: p.url,
        alt: photoAlt(p.garment_type, p.brand),
        credit: p.credit ?? null,
      })),
    [passport?.photos],
  );
  const qr = client.buildUrl<GetLotQrData>({
    url: '/api/v1/public/lots/{code}/qr',
    path: { code },
  });

  return (
    <div className="min-h-dvh bg-background pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5">
        <Link to="/" aria-label="Novelo" className="flex min-h-11 items-center rounded-sm">
          <BrandLogo className="h-7" />
        </Link>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-8 px-4 pb-[max(4rem,env(safe-area-inset-bottom))]">
        {isPending && (
          <div className="grid place-items-center py-24" aria-busy="true">
            <BrandSpinner className="size-7" />
            <span className="sr-only">{m.common_loading()}</span>
          </div>
        )}
        {error && !notFound && <ErrorState error={error} onRetry={() => refetch()} />}
        {notFound && (
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

            {/* No telemóvel peso e peças lado a lado e a fibra por baixo: o essencial cabe no primeiro ecrã. */}
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border sm:grid-cols-3">
              <div className="space-y-1 bg-card p-5">
                <dt className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
                  {m.lot_stat_weight()}
                  {/* Peso médio por tipo de peça (pressuposto): estimativa, como na página do lote. */}
                  <span className="rounded-full bg-areia/25 px-1.5 py-px text-[9px] text-foreground/80">
                    {m.common_estimate()}
                  </span>
                </dt>
                <dd className="font-medium font-serif text-3xl tabular-nums sm:text-4xl">
                  {formatNumber(passport.weight_kg, 2)} kg
                </dd>
              </div>
              <div className="space-y-1 bg-card p-5">
                <dt className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
                  {m.lot_stat_items()}
                </dt>
                <dd className="font-medium font-serif text-3xl tabular-nums sm:text-4xl">
                  {passport.items}
                </dd>
              </div>
              <div className="col-span-2 space-y-1 bg-card p-5 sm:col-span-1">
                <dt className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
                  {m.passport_dominant()}
                </dt>
                <dd className="font-medium font-serif text-3xl sm:text-4xl">
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
              <ul className="grid grid-cols-3 gap-3 text-sm">
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

            {photos.length > 0 && (
              <section
                className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10"
                aria-labelledby="passport-photos"
              >
                <div className="space-y-0.5">
                  <h2 id="passport-photos" className="text-xl">
                    {m.lotphoto_pass_title()}
                  </h2>
                  <p className="text-muted-foreground text-xs">{m.lotphoto_pass_note()}</p>
                </div>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.map((p, i) => {
                    const credit = formatPhotoCredit(p.credit);
                    return (
                      <li key={p.id} className="min-w-0 space-y-1.5">
                        <ItemThumb
                          fluid
                          size={320}
                          src={p.src}
                          alt={p.alt}
                          openLabel={m.lotphoto_open({ label: p.alt })}
                          onOpen={() => setViewing(i)}
                        />
                        {credit && (
                          <p className="line-clamp-2 break-words text-[11px] text-muted-foreground leading-tight">
                            {credit}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
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
                className="size-40 place-self-center rounded-lg"
              />
            </div>
            <p className="text-muted-foreground text-xs">{m.passport_privacy()}</p>
            <PhotoViewer photos={photos} index={viewing} onIndexChange={setViewing} />
          </>
        )}
      </main>
    </div>
  );
}
