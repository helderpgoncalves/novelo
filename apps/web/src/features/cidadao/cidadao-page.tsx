import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CalendarDays, Link2 } from 'lucide-react';
import type { MeOut } from '@/client';
import { getPublicCollectionAgendaOptions } from '@/client/@tanstack/react-query.gen';
import { BrandLogo } from '@/components/brand-logo';
import { WeekdayDots } from '@/components/weekdays';
import { agendaByDay } from '@/features/cidadao/agenda';
import { SignupCard } from '@/features/cidadao/signup-card';
import { Wallet } from '@/features/cidadao/wallet';
import { getErrorCode } from '@/lib/errors';

// Strings em pt-PT de propósito: a área do cidadão é só portuguesa no MVP (decisão da spec #54).

/** Aba ativa da carteira (vai na URL: partilhável e voltável). */
export type WalletTab = 'inicio' | 'sacos' | 'saldo' | 'historico' | 'privacidade';

/**
 * A área do cidadão: sem sessão é a porta de entrada (herói público + criação de conta);
 * com conta de doador é a «Carteira» (Início / Sacos / Saldo / Histórico).
 * O `beforeLoad` da rota já resolveu a sessão e redirecionou contas de equipa — aqui só se escolhe o desenho.
 */
export function CidadaoPage({ user, tab }: { user: MeOut | null; tab: WalletTab }) {
  if (user?.role === 'donor') return <Wallet tab={tab} />;
  return <CidadaoPublic />;
}

/** Visto por quem não tem conta de doador: o herói público, «onde e quando entrego» e a porta de entrada. */
function CidadaoPublic() {
  const { data: agendaData, error } = useQuery(getPublicCollectionAgendaOptions());
  const days = agendaByDay(error ? null : (agendaData?.agenda ?? null));
  const errorCode = getErrorCode(error);

  return (
    <div className="bg-background min-h-dvh pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <div className="mx-auto max-w-lg space-y-6 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-16">
        <header className="flex items-center justify-between">
          <Link to="/" aria-label="Novelo — página inicial" className="min-h-11 rounded-sm">
            <BrandLogo className="h-7" />
          </Link>
          <Link
            to="/onde-quando"
            className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-sm"
          >
            <CalendarDays className="size-4" aria-hidden />
            Onde e quando entrego
          </Link>
        </header>

        <section className="space-y-2 pt-2">
          <h1 className="font-serif text-4xl leading-tight text-balance">
            A tua roupa velha vale algo — e agora podes segui-la.
          </h1>
          <p className="text-muted-foreground text-sm">
            Ativa o saco da plataforma, entrega à viatura de têxtil e acompanha cada saco até ao
            passaporte público. Crédito por saco, nunca por quilos — e o teu nome nunca aparece em
            público.
          </p>
        </section>

        <SignupCard />

        <section className="ring-foreground/10 space-y-3 rounded-2xl bg-card p-5 ring-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Os dias da ronda</h2>
            <WeekdayDots days={days.map((d) => d.weekday)} />
          </div>
          {errorCode ? (
            <p className="text-muted-foreground text-sm">
              A agenda não está disponível neste momento.
            </p>
          ) : days.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Ainda não há agenda publicada — a Vitrus anuncia aqui os dias de cada freguesia.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {days.map((day) => (
                <li key={day.weekday} className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{day.label}</span>
                  <span className="text-muted-foreground truncate">
                    {day.entries.map((e) => e.parish_name).join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/onde-quando"
            className="text-primary inline-flex min-h-11 items-center gap-1.5 text-sm font-medium"
          >
            <Link2 className="size-4" aria-hidden />
            Ver onde e quando entregar
          </Link>
        </section>

        <p className="text-muted-foreground px-2 text-xs">
          A rede de recolha de têxtil é uma operação da Vitrus · Guimarães. Lotes e passaportes
          nunca mostram doadores — a{' '}
          <Link to="/politica-dados" className="text-primary underline-offset-2 hover:underline">
            política de dados
          </Link>{' '}
          diz o que guardamos e até quando.
        </p>
      </div>
    </div>
  );
}
