import { Link } from '@tanstack/react-router';
import { ArrowRight, ChevronDown } from 'lucide-react';
import type { CSSProperties } from 'react';
import { GithubMark } from '@/components/github-mark';
import { HeroPicture } from '@/components/photos';
import { Button } from '@/components/ui/button';
import { formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { CountUp } from './count-up';
import { FACTS, REPO_URL } from './facts';
import { HERO_SKY } from './landing-assets.generated';
import { CONTAINER, Estimate, STAT } from './layout';

/** Divide o título na primeira vírgula: a segunda metade vai em itálico (Newsreader Display Italic) e na cor da marca. */
function splitTitle(title: string): [string, string | null] {
  const i = title.indexOf(', ');
  return i < 0 ? [title, null] : [`${title.slice(0, i)},`, title.slice(i + 2)];
}

/**
 * Topo da página, em grelha de 12 colunas: título em três linhas (itálico verde só no fim), um subtítulo, um botão
 * primário e uma ligação discreta; por baixo, a prova em faixa fina (301,3 t, 22,9 % do potencial, 156 830 habitantes,
 * cada um com a fonte) e, à direita, um cartão de leitura só com o número e a barra. A fotografia é a Penha ao fim do dia
 * (RaquelRosa7, CC BY-SA 4.0); um véu suave só atrás do texto garante o contraste AA. O texto não anima (LCP).
 */
export function Hero() {
  const [first, second] = splitTitle(m.landing_title());
  const proof = [
    {
      id: 'collected',
      value: formatTonnes(FACTS.collectedT),
      label: m.landing_stat_collected_label(),
      source: m.landing_stat_collected_source(),
    },
    {
      id: 'capture',
      value: formatPercent(FACTS.capturePct),
      label: m.landing_gap_value_label(),
      source: null,
    },
    {
      id: 'people',
      value: formatNumber(FACTS.inhabitants),
      label: m.landing_stat_people_label(),
      source: m.landing_stat_people_source(),
    },
  ] as const;
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
          <p className="lp-hs-eyebrow">{m.landing_eyebrow()}</p>
          <h1 id="landing-title" className="lp-hs-title">
            <span className="sr-only">Novelo: </span>
            {first}
            {second && (
              <>
                {' '}
                <em className="text-primary">{second}</em>
              </>
            )}
          </h1>
          <p className="lp-hs-lead">{m.landing_lead_short()}</p>
          <div className="lp-hs-ctas lp-hs-stagger" style={{ '--i': 1 } as CSSProperties}>
            <Button
              asChild
              className="lp-press h-[3.25rem] w-full gap-2 px-7 font-semibold text-base sm:h-12 sm:w-auto"
            >
              <Link to="/login">
                {m.landing_cta_demo()}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="lp-hs-link">
              <GithubMark className="size-4" />
              {m.landing_cta_code()}
            </a>
          </div>
        </div>
        <dl className="lp-hs-strip lp-hs-stagger" style={{ '--i': 2 } as CSSProperties}>
          {proof.map((p) => (
            <div key={p.id} className="lp-hs-fact" title={p.source ?? undefined}>
              <dd className="lp-hs-fact-v">{p.value}</dd>
              <dt className="lp-hs-fact-l">
                {p.label}
                {p.id === 'capture' && <Estimate className="lp-hs-est" />}
              </dt>
              {p.source && <dd className="lp-hs-fact-s">{p.source}</dd>}
            </div>
          ))}
        </dl>
        <div className="lp-hs-card">
          <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
            {m.landing_tagline()}
          </p>
          <p className={`${STAT} mt-4 text-5xl`}>
            <CountUp value={FACTS.collectedT} format={(n) => formatTonnes(n)} />
          </p>
          <p className="mt-2 font-medium text-sm">{m.landing_stat_collected_label()}</p>
          <div
            role="img"
            aria-label={`${formatPercent(FACTS.capturePct)} ${m.landing_gap_value_label()} (${m.landing_estimate_tag()})`}
            className="lp-dotbar mt-5"
          >
            <span style={{ width: `${FACTS.capturePct}%` }} />
          </div>
          <p className="mt-2 font-mono text-[12px] text-muted-foreground">
            {formatPercent(FACTS.capturePct)} {m.landing_gap_value_label()}
            <Estimate />
          </p>
        </div>
      </div>
      <a href="#problema" className="lp-hs-hint">
        {m.landing_scroll_hint()}
        <ChevronDown className="lp-hint size-3.5" aria-hidden="true" />
      </a>
    </section>
  );
}
