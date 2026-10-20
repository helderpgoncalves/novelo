import { Link } from '@tanstack/react-router';
import { ArrowRight, ChevronDown } from 'lucide-react';
import type { CSSProperties } from 'react';
import { GithubMark } from '@/components/github-mark';
import { HeroPicture } from '@/components/photos';
import { Button } from '@/components/ui/button';
import { formatKg, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { CountUp } from './count-up';
import { FACTS, REPO_URL } from './facts';
import { HERO_SKY } from './landing-assets.generated';
import { CARD, CONTAINER, CTA_PRIMARY, Estimate, GRID_GAP, LandingSection, STAT } from './layout';

/** Divide o título na primeira vírgula: a segunda metade vai em itálico (Newsreader Display Italic) e na cor da marca. */
function splitTitle(title: string): [string, string | null] {
  const i = title.indexOf(', ');
  return i < 0 ? [title, null] : [`${title.slice(0, i)},`, title.slice(i + 2)];
}

/**
 * Topo da página: um único h1, o que faz numa frase, os botões (demo, conta, código) e a prova (o número que ancora tudo,
 * 301,3 t, Vitrus 2025). A fotografia é a Penha ao fim do dia (RaquelRosa7, CC BY-SA 4.0): em ecrã largo ocupa o hero e o texto fica sobre o
 * céu, à esquerda; em ecrã estreito ou de pé o texto assenta no papel e a fotografia dissolve-se por baixo, com o pico
 * sempre livre. O fundo é a cor média do céu (nunca branco enquanto a imagem chega); o texto não anima (LCP).
 */
export function Hero() {
  const [first, second] = splitTitle(m.landing_title());
  return (
    <section
      aria-labelledby="landing-title"
      className="lp-hs"
      style={
        {
          '--hero-sky-light': HERO_SKY.light,
          '--hero-sky-dark': HERO_SKY.dark,
        } as CSSProperties
      }
    >
      <div aria-hidden="true" className="lp-hs-media">
        <HeroPicture />
      </div>
      <div className={`${CONTAINER} lp-hs-inner`}>
        <div className="lp-hs-copy">
          <p className="eyebrow lp-hs-eyebrow font-mono">{m.landing_eyebrow()}</p>
          <h1 id="landing-title" className="lp-hs-title">
            <span className="sr-only">Novelo: </span>
            {first}
            {second && <em className="block text-primary">{second}</em>}
          </h1>
          <p className="lp-hs-lead max-w-xl text-foreground/85">
            <span className="sm:hidden">{m.landing_lead_short()}</span>
            <span className="hidden sm:inline">{m.landing_lead()}</span>
          </p>
          <div className="lp-hs-ctas lp-hs-stagger" style={{ '--i': 1 } as CSSProperties}>
            <Button
              asChild
              className={`${CTA_PRIMARY} lp-press h-[3.25rem] w-full gap-2 text-base sm:h-12 sm:w-auto`}
            >
              <Link to="/login">
                {m.landing_cta_demo()}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <div className="lp-hs-links">
              <Link to="/register" className="lp-press">
                {m.landing_register()}
              </Link>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="lp-press">
                <GithubMark className="size-4" />
                {m.landing_cta_code()}
              </a>
            </div>
          </div>
          <p className="lp-hs-note hidden text-pretty text-foreground/75 text-sm leading-relaxed sm:block">
            {m.landing_register_note()}
          </p>
          <p
            className="lp-hs-proof-line lp-hs-stagger font-mono text-[12px] text-foreground/80 leading-relaxed"
            style={{ '--i': 2 } as CSSProperties}
          >
            <strong className="font-semibold text-foreground">
              {formatTonnes(FACTS.collectedT)}
            </strong>{' '}
            {m.landing_stat_collected_label()} · {formatPercent(FACTS.capturePct)}{' '}
            {m.landing_gap_value_label()}
            <Estimate />
          </p>
        </div>
        <div className="lp-hs-proof-card w-72 shrink-0 rounded-xl border border-border bg-card/95 p-5 shadow-lg backdrop-blur-sm xl:w-80">
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
          <p className="mt-2 text-pretty text-[12px] text-muted-foreground leading-relaxed">
            {m.landing_register_note()}
          </p>
        </div>
      </div>
      <a
        href="#numeros"
        className="lp-hs-hint absolute bottom-6 left-1/2 z-10 -translate-x-1/2 items-center gap-1.5 rounded-full bg-background/80 px-3.5 py-1.5 font-mono text-[11px] text-foreground/80 outline-none backdrop-blur-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {m.landing_scroll_hint()}
        <ChevronDown className="lp-hint size-3.5" aria-hidden="true" />
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
      <dl
        className={`lp-snap -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 ${GRID_GAP}`}
      >
        {stats.map((s) => (
          <div
            key={s.id}
            className={`${CARD} flex min-w-[78%] shrink-0 snap-center flex-col sm:min-w-0`}
          >
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
