import { MapPin, Route, ScanLine, School, Truck } from 'lucide-react';
import { type CSSProperties, lazy, Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorState } from '@/components/states';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { CountUp } from './count-up';
import { FACTS, MAP } from './facts';
import { CARD, CONTAINER, Heading, Section, STAT } from './layout';
import { sectionNumber } from './sections';

// O mapa (1 574 pontos, ≈ 27 KB de dados) carrega à parte: não pesa no primeiro ecrã.
const SitesMap = lazy(() => import('./sites-map').then((mod) => ({ default: mod.SitesMap })));

/** Esqueleto com a forma do mapa e da lista (sem saltos de layout quando o pedaço chega). */
function MapSkeleton() {
  return (
    <div
      role="status"
      aria-label={m.landing_map_loading()}
      className="grid gap-4 lg:grid-cols-12 lg:gap-5"
    >
      <div
        className={cn(CARD, 'animate-pulse bg-secondary/50 lg:col-span-7')}
        style={{ aspectRatio: `${MAP.width} / ${MAP.height + 300}` }}
      />
      <div className={cn(CARD, 'h-[32rem] animate-pulse bg-secondary/50 lg:col-span-5')} />
    </div>
  );
}

/**
 * O momento do mapa: onde se perdem as ≈ 2 325 t por ano (estimativa). Cabeçalho dividido (título e tese), uma faixa de
 * números (locais, contentores, nenhum contentor novo, têxtil por desviar) e o mapa dos locais reais com a lista das freguesias.
 */
export function WhereLost() {
  const stats = [
    {
      id: 'sites',
      value: FACTS.municipalSites,
      label: m.landing_map_stat_sites(),
      format: (v: number) => formatNumber(Math.round(v)),
    },
    {
      id: 'containers',
      value: FACTS.municipalContainers,
      label: m.landing_map_stat_containers(),
      format: (v: number) => formatNumber(Math.round(v)),
    },
    {
      id: 'new',
      value: 0,
      label: m.landing_map_stat_new(),
      format: (v: number) => formatNumber(Math.round(v)),
    },
  ] as const;
  const pap = FACTS.doorToDoor;
  const modes = [
    [
      Truck,
      m.landing_map_mode_pap({
        n: formatNumber(pap.parishes),
        people: formatNumber(pap.inhabitants),
        tonnes: `${formatNumber(pap.tonnes, 1)} t`,
        km: formatNumber(pap.newKm),
      }),
    ],
    [MapPin, m.landing_map_mode_existing()],
    [School, m.landing_map_mode_schools({ n: formatNumber(FACTS.schools) })],
    [Route, m.landing_map_mode_demand()],
    [ScanLine, m.landing_map_mode_quality()],
  ] as const;
  return (
    <Section id="mapa" tone="band">
      <div className={`${CONTAINER} flex flex-col gap-10 lg:gap-14`}>
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
          <Heading
            id="mapa"
            n={sectionNumber('mapa')}
            size="xl"
            eyebrow={m.landing_map_eyebrow()}
            title={m.landing_map_title({ tonnes: `${formatNumber(FACTS.residualT)} t` })}
            lead={m.landing_map_lead()}
            className="max-w-none lg:col-span-7"
          />
          <blockquote
            data-reveal=""
            className="border-primary border-l-2 pl-5 font-serif text-[1.375rem] text-foreground leading-snug text-pretty sm:text-2xl lg:col-span-5 lg:mb-1"
          >
            {m.landing_map_thesis()}
          </blockquote>
        </div>
        <dl
          data-reveal=""
          data-fx="stagger"
          className="grid grid-cols-3 divide-x divide-border border-border border-y"
        >
          {stats.map((s, i) => (
            <div
              key={s.id}
              data-s=""
              style={{ '--i': i } as CSSProperties}
              className={cn(
                'flex flex-col gap-2 py-5 sm:py-7',
                i === 0 ? 'pr-3 sm:pr-6' : 'px-3 sm:px-6',
              )}
            >
              <dd className={cn(STAT, 'order-1 text-[2rem] sm:text-5xl lg:text-6xl')}>
                <CountUp value={s.value} format={s.format} />
              </dd>
              <dt className="order-2 text-pretty text-muted-foreground text-[13px] leading-snug sm:text-[0.9375rem]">
                {s.label}
              </dt>
            </div>
          ))}
        </dl>
        <ErrorBoundary
          fallbackRender={({ error, resetErrorBoundary }) => (
            <ErrorState error={error} onRetry={resetErrorBoundary} />
          )}
        >
          <Suspense fallback={<MapSkeleton />}>
            <SitesMap
              aside={
                <div className={cn(CARD, 'flex flex-1 flex-col gap-4 p-5 sm:p-7')}>
                  <h3 className="lp-kicker">{m.landing_map_modes_title()}</h3>
                  <ol className="flex flex-col gap-4">
                    {modes.map(([Icon, text], i) => (
                      <li key={text} className="flex gap-3.5">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-primary/35 bg-accent/60 text-primary">
                          <Icon className="size-[1.125rem]" strokeWidth={1.75} aria-hidden="true" />
                        </span>
                        <p className="pt-1.5 text-pretty text-[0.9375rem] leading-relaxed">
                          <span className="sr-only">{i + 1}. </span>
                          {text}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              }
            />
          </Suspense>
        </ErrorBoundary>
      </div>
    </Section>
  );
}
