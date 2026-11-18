import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CalendarDays, MapPin, QrCode, Truck } from 'lucide-react';
import type { CollectionMode } from '@/client';
import { getPublicCollectionAgendaOptions } from '@/client/@tanstack/react-query.gen';
import { BrandLogo } from '@/components/brand-logo';
import { WeekdayDots } from '@/components/weekdays';
import { agendaView } from '@/features/citizen/agenda';
import { getLocale } from '@/lib/i18n';
import { ogImage, SITE_URL } from '@/lib/seo';

// Strings em pt-PT de propósito: página pública do cidadão, só portuguesa no MVP (decisão da spec #54).

/** Página pública «Onde e quando entrego» (bilhete #63): sem sessão, a promessa do serviço ao cidadão.

A agenda é a publicada pela equipa da Vitrus (o cenário mais recente com rondas — dado introduzido da
política de paragem, #61): nenhuma visita publicada é saltada. Sem agenda, a página diz-o — nunca
inventa dias. */
export const Route = createFileRoute('/onde-quando')({
  head: () => ({
    meta: [
      { title: 'Onde e quando entregar têxtil · Guimarães' },
      {
        name: 'description',
        content:
          'Os dias da viatura de têxtil em cada freguesia de Guimarães, onde entregar o saco e como pedir recolha à porta.',
      },
      { property: 'og:title', content: 'Onde e quando entregar têxtil · Guimarães' },
      {
        property: 'og:description',
        content: 'Os dias da ronda de têxtil na tua freguesia, com a agenda publicada pela Vitrus.',
      },
      { property: 'og:image', content: ogImage('landing') },
    ],
    links: [
      {
        rel: 'canonical',
        href: `${SITE_URL}/${getLocale() === 'en' ? 'en' : 'pt'}/onde-quando`,
      },
    ],
  }),
  component: OndeQuandoPage,
});

function OndeQuandoPage() {
  const { data, isPending, error, refetch } = useQuery(getPublicCollectionAgendaOptions());
  const view = agendaView(data, Boolean(error));

  return (
    <div className="bg-background min-h-dvh pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5">
        <Link to="/" aria-label="Novelo" className="flex min-h-11 items-center rounded-sm">
          <BrandLogo className="h-7" />
        </Link>
        <Link
          to="/cidadao"
          className="bg-primary text-primary-foreground inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium"
        >
          A minha carteira
        </Link>
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-4 pb-16">
        <section className="space-y-2">
          <p className="text-primary text-xs font-medium tracking-wider uppercase">
            Onde e quando entrego
          </p>
          <h1 className="font-serif text-3xl leading-tight text-balance">
            O saco de têxtil sai à rua no dia da tua freguesia
          </h1>
          <p className="text-muted-foreground text-sm">
            A viatura de têxtil passa à porta com agenda publicada — o que está aqui é promessa
            cumprida: nenhuma ronda publicada é saltada. É a operação da Vitrus em Guimarães.
          </p>
        </section>

        <section className="ring-foreground/10 space-y-4 rounded-2xl bg-card p-5 ring-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 font-semibold">
              <CalendarDays className="text-primary size-5" aria-hidden />
              Dias da ronda
            </h2>
            {view.kind === 'ready' && <WeekdayDots days={view.agenda.map((d) => d.weekday)} />}
          </div>

          {view.kind === 'loading' || isPending ? (
            <ul className="space-y-2" aria-busy>
              {[0, 1, 2].map((i) => (
                <li key={i} className="bg-muted/60 h-6 w-2/3 animate-pulse rounded" />
              ))}
            </ul>
          ) : view.kind === 'empty' ? (
            <p className="text-muted-foreground text-sm">{view.message}</p>
          ) : (
            <ul className="space-y-3">
              {view.agenda.map((day) => (
                <li
                  key={day.weekday}
                  className="border-foreground/10 border-t pt-3 first:border-0 first:pt-0"
                >
                  <p className="font-medium">{day.label}</p>
                  <ul className="text-muted-foreground mt-1 space-y-1 text-sm">
                    {day.entries.map((entry) => (
                      <li
                        key={`${day.weekday}-${entry.parish_code}-${entry.channel}`}
                        className="flex justify-between gap-3"
                      >
                        <span className="truncate">
                          {entry.parish_name} · {channelLabelOf(entry.channel)}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {entry.every_weeks === 1
                            ? 'semanal'
                            : `cada ${entry.every_weeks} semanas`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          {view.kind === 'ready' && view.scenarioLabel && (
            <p className="text-muted-foreground text-[11px]">
              Agenda publicada em «{view.scenarioLabel}» pela equipa da Vitrus — dado introduzido,
              derivado do plano escolhido.
            </p>
          )}
        </section>

        <section className="ring-foreground/10 space-y-3 rounded-2xl bg-card p-5 text-sm ring-1">
          <h2 className="inline-flex items-center gap-2 font-semibold">
            <MapPin className="text-primary size-5" aria-hidden />
            Como entregar
          </h2>
          <ul className="text-muted-foreground space-y-2">
            <li className="flex gap-2">
              <Truck className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <strong className="text-foreground">À porta, no dia da freguesia:</strong> saco
                fechado ao lado do portão até à hora da ronda (a Vitrus publica a hora na
                freguesia).
              </span>
            </li>
            <li className="flex gap-2">
              <QrCode className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <strong className="text-foreground">Entrega mão a mão:</strong> com a carteira do
                Novelo, mostras o QR da conta à viatura e o saco fica creditado sem contentor nem
                compactação.
              </span>
            </li>
          </ul>
          <p className="text-muted-foreground text-xs">
            Fora do dia da tua freguesia, pede a recolha na carteira: 1–5 sacos, com 48 horas de
            aviso, e a equipa garante a visita ou encaixa-te na exceção.
          </p>
        </section>

        <p className="text-muted-foreground px-2 text-xs">
          Esta página é pública: não usa a tua conta nem guarda nada sobre ti. A rede de recolha de
          têxtil é uma operação da Vitrus · Guimarães.
        </p>
        {error && (
          <button
            type="button"
            onClick={() => void refetch()}
            className="text-primary text-sm underline"
          >
            Tentar outra vez
          </button>
        )}
      </main>
    </div>
  );
}

function channelLabelOf(channel: CollectionMode): string {
  if (channel === 'on_demand') return 'ronda à porta';
  if (channel === 'existing') return 'paragens nos locais';
  return 'contentores de rua (referência)';
}
