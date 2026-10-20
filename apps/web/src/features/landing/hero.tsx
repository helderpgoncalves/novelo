import { Link } from '@tanstack/react-router';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { HeroPicture } from '@/components/dither';
import { GithubMark } from '@/components/github-mark';
import { Button } from '@/components/ui/button';
import { formatKg, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { CountUp } from './count-up';
import { FACTS, REPO_URL } from './facts';
import {
  CARD,
  CONTAINER,
  CTA_PRIMARY,
  CTA_SECONDARY,
  Estimate,
  GRID_GAP,
  HERO_Y,
  LandingSection,
  STAT,
} from './layout';

/** Divide o título na primeira vírgula: a segunda metade vai em itálico (Newsreader Display Italic) e na cor da marca. */
function splitTitle(title: string): [string, string | null] {
  const i = title.indexOf(', ');
  return i < 0 ? [title, null] : [`${title.slice(0, i)},`, title.slice(i + 2)];
}

/**
 * Topo da página: um único h1, o que faz numa frase, os três botões (demo, conta, código) e a fotografia dither em
 * fundo total, com o número que ancora tudo (301,3 t, Vitrus 2025) num cartão sólido. O texto não anima (LCP).
 * A imagem tem parallax só em CSS e um véu de pontos que se dissolve uma vez; em telemóvel fica por baixo (4:5).
 */
export function Hero() {
  const [first, second] = splitTitle(m.landing_title());
  return (
    <section
      aria-labelledby="landing-title"
      className={`${HERO_Y} relative isolate flex min-h-[100vh] min-h-[100svh] overflow-clip lg:max-h-[960px]`}
    >
      <div
        aria-hidden="true"
        className="-z-10 absolute inset-x-0 bottom-0 aspect-[4/5] [mask-image:linear-gradient(to_bottom,transparent,#000_22%)] md:inset-0 md:aspect-auto md:[mask-image:none]"
      >
        <div className="hero-drift size-full">
          <HeroPicture className="md:object-[70%_60%]" />
        </div>
        <div className="hero-veil absolute inset-0" />
      </div>
      <div
        className={`${CONTAINER} flex flex-col justify-between gap-10 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-14`}
      >
        <div className="flex flex-col gap-6 lg:self-center">
          <p className="eyebrow font-mono">{m.landing_eyebrow()}</p>
          <h1 id="landing-title" className="lp-hero">
            <span className="sr-only">Novelo: </span>
            {first}
            {second && <em className="block text-primary">{second}</em>}
          </h1>
          <p className="lp-lead max-w-xl text-foreground/80">{m.landing_lead()}</p>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
            <Button asChild className={`${CTA_PRIMARY} lp-press h-12 gap-2 text-base`}>
              <Link to="/login">
                {m.landing_cta_demo()}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className={`${CTA_SECONDARY} lp-press h-12 bg-background/70 text-base`}
            >
              <Link to="/register">{m.landing_register()}</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className={`${CTA_SECONDARY} lp-press h-12 gap-2 text-base`}
            >
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                <GithubMark className="size-4" />
                {m.landing_cta_code()}
              </a>
            </Button>
          </div>
          <p className="max-w-md text-pretty text-foreground/70 text-sm leading-relaxed">
            {m.landing_register_note()}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card/95 p-5 shadow-lg sm:max-w-xs lg:justify-self-end">
          <p className="font-serif text-primary text-xl">{m.landing_tagline()}</p>
          <p className={`${STAT} mt-4`}>
            <CountUp value={FACTS.collectedT} format={(n) => formatTonnes(n)} />
          </p>
          <p className="mt-2 font-medium text-sm">{m.landing_stat_collected_label()}</p>
          <div
            role="img"
            aria-label={`${formatPercent(FACTS.capturePct)} ${m.landing_gap_value_label()} (${m.landing_estimate_tag()})`}
            className="mt-4 h-2 overflow-hidden rounded-full bg-secondary"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${FACTS.capturePct}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-[12px] text-muted-foreground">
            {formatPercent(FACTS.capturePct)} {m.landing_gap_value_label()}
            <Estimate />
          </p>
          <p className="mt-3 border-border border-t pt-3 font-mono text-[11px] text-muted-foreground">
            {m.landing_hero_chip_note()}
          </p>
        </div>
      </div>
      <a
        href="#numeros"
        className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1 rounded-sm font-mono text-[11px] text-foreground/70 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:flex"
      >
        {m.landing_scroll_hint()}
        <ChevronDown className="lp-hint size-4" aria-hidden="true" />
      </a>
    </section>
  );
}

/** Prova: os números de partida, todos medidos (Vitrus Ambiente 2025 e INE), a contar uma só vez. */
export function Proof() {
  const stats = [
    {
      id: 'collected',
      value: FACTS.collectedT,
      format: (n: number) => formatTonnes(n),
      label: m.landing_stat_collected_label(),
      source: m.landing_stat_collected_source(),
    },
    {
      id: 'entities',
      value: FACTS.entities,
      format: (n: number) => formatNumber(Math.round(n)),
      label: m.landing_stat_entities_label(),
      source: m.landing_stat_entities_source(),
    },
    {
      id: 'rate',
      value: FACTS.kgPerInhabMonth,
      format: (n: number) => formatKg(n),
      label: m.landing_stat_rate_label(),
      source: m.landing_stat_rate_source(),
    },
    {
      id: 'people',
      value: FACTS.inhabitants,
      format: (n: number) => formatNumber(Math.round(n)),
      label: m.landing_stat_people_label(),
      source: m.landing_stat_people_source(),
    },
  ] as const;
  return (
    <LandingSection
      id="numeros"
      defer={false}
      tone="band"
      eyebrow={m.landing_numbers_eyebrow()}
      title={m.landing_numbers_title()}
      lead={m.landing_numbers_note()}
    >
      <dl className={`grid sm:grid-cols-2 lg:grid-cols-4 ${GRID_GAP}`}>
        {stats.map((s) => (
          <div key={s.id} className={`${CARD} flex flex-col`}>
            <dd className={`order-1 ${STAT}`}>
              <CountUp value={s.value} format={s.format} />
            </dd>
            <dt className="order-2 mt-3 text-pretty font-medium">{s.label}</dt>
            <dd className="order-3 mt-2 font-mono text-[12px] text-muted-foreground">{s.source}</dd>
          </div>
        ))}
      </dl>
    </LandingSection>
  );
}
