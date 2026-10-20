import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { BrandSymbol } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { formatKg, formatNumber, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';
import {
  CARD,
  CARD_SURFACE,
  CONTAINER,
  CTA_PRIMARY,
  CTA_SECONDARY,
  GRID_GAP,
  HERO_Y,
  LandingSection,
  STAT,
} from './layout';

/** Topo da página: um único h1, o que faz numa frase, Entrar/Criar conta e o símbolo da marca. Sem animação (LCP). */
export function Hero() {
  return (
    <section aria-labelledby="landing-title" className={HERO_Y}>
      <div className={`${CONTAINER} grid items-center gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16`}>
        <div className="flex flex-col gap-6">
          <p className="eyebrow">{m.landing_eyebrow()}</p>
          <h1 id="landing-title" className="lp-display tracking-tight">
            <span className="text-primary">Novelo</span>
            <span className="sr-only">: </span>
            <span className="block">{m.landing_title()}</span>
          </h1>
          <p className="lp-lead max-w-xl text-muted-foreground">{m.landing_lead()}</p>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button asChild className={`${CTA_PRIMARY} gap-2`}>
              <Link to="/login">
                {m.landing_sign_in()}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" className={CTA_SECONDARY}>
              <Link to="/register">{m.landing_register()}</Link>
            </Button>
          </div>
          <p className="max-w-md text-pretty text-muted-foreground text-sm leading-relaxed">
            {m.landing_register_note()}
          </p>
        </div>
        <figure className="flex flex-col gap-4">
          <div
            className={`${CARD_SURFACE} relative grid aspect-[4/3] place-items-center overflow-hidden`}
          >
            <BrandSymbol className="size-40 sm:size-52 lg:size-56" />
          </div>
          <figcaption className="space-y-2">
            <p className="eyebrow">{m.landing_hero_tags()}</p>
            <p className="text-pretty text-muted-foreground text-sm leading-relaxed">
              {m.landing_hero_caption()}
            </p>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

/** Prova: os números de partida, todos medidos (Vitrus Ambiente 2025 e INE). */
export function Proof() {
  const stats = [
    {
      id: 'collected',
      value: formatTonnes(301.3),
      label: m.landing_stat_collected_label(),
      source: m.landing_stat_collected_source(),
    },
    {
      id: 'entities',
      value: formatNumber(4),
      label: m.landing_stat_entities_label(),
      source: m.landing_stat_entities_source(),
    },
    {
      id: 'rate',
      value: formatKg(0.16),
      label: m.landing_stat_rate_label(),
      source: m.landing_stat_rate_source(),
    },
    {
      id: 'people',
      value: formatNumber(156830),
      label: m.landing_stat_people_label(),
      source: m.landing_stat_people_source(),
    },
  ] as const;
  return (
    <LandingSection
      id="numeros"
      tone="band"
      eyebrow={m.landing_numbers_eyebrow()}
      title={m.landing_numbers_title()}
      lead={m.landing_numbers_note()}
    >
      <dl className={`grid sm:grid-cols-2 lg:grid-cols-4 ${GRID_GAP}`}>
        {stats.map((s) => (
          <div key={s.id} className={`${CARD} flex flex-col`}>
            <dd className={`order-1 ${STAT}`}>{s.value}</dd>
            <dt className="order-2 mt-3 text-pretty font-medium">{s.label}</dt>
            <dd className="order-3 mt-2 text-muted-foreground text-sm">{s.source}</dd>
          </div>
        ))}
      </dl>
    </LandingSection>
  );
}
