import { Link } from '@tanstack/react-router';
import { ArrowDown, ArrowRight } from 'lucide-react';
import type { CSSProperties } from 'react';
import { HeroPicture } from '@/components/photos';
import { Button } from '@/components/ui/button';
import { m } from '@/paraglide/messages';
import { HeroDeadline } from './hero-deadline';
import { HeroFio } from './hero-fio';
import { HeroLedger } from './hero-ledger';
import { HERO_SKY } from './landing-assets.generated';
import { CONTAINER } from './layout';

/** Separa o primeiro número com «%» do título («9,1 %»): vai em itálico verde (Newsreader Display Italic). */
function splitTitle(title: string): [string, string | null, string] {
  const match = /\d+(?:[.,]\d+)?[\s ]?%/.exec(title);
  if (!match) return [title, null, ''];
  return [title.slice(0, match.index), match[0], title.slice(match.index + match[0].length)];
}

/**
 * Topo da página. O título diz o que ninguém diz («Só 9,1 % do têxtil de Guimarães é recolhido à parte»), o subtítulo diz o
 * resto e o que o Novelo faz, e os números vivem num painel no fluxo do texto (`HeroLedger`): ao lado da cópia em ecrã largo,
 * por baixo dos botões nos estreitos. Nada de texto por cima da fotografia. O objeto do hero é o fio (`HeroFio`), só gráfico:
 * desenha-se do vale ao campanário da Penha, cheio até aos 9,1 % e a tracejado até ao potencial. A grelha reserva por baixo
 * do texto a altura do campanário (proporcional à largura), por isso o fio e o texto nunca se cruzam. A fotografia é a Penha
 * ao fim do dia (RaquelRosa7, CC BY-SA 4.0), em meio-tom, com um parallax curto ao rolar. O título não anima (LCP).
 */
export function Hero() {
  const [before, pct, after] = splitTitle(m.landing_title());
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
          <div className="lp-hs-eyebrow-row">
            <p className="lp-hs-eyebrow">{m.landing_eyebrow()}</p>
            <HeroDeadline compact className="lp-hs-deadline-compact" />
          </div>
          <h1 id="landing-title" className="lp-hs-title">
            <span className="sr-only">Novelo: </span>
            {before}
            {pct && <em className="lp-hs-pct">{pct}</em>}
            {after}
          </h1>
          <p className="lp-hs-lead">{m.landing_hero_lead()}</p>
          <div className="lp-hs-ctas lp-hs-stagger" style={{ '--i': 1 } as CSSProperties}>
            <Button
              asChild
              className="lp-press h-[3.25rem] w-full gap-2 px-7 font-semibold text-base sm:h-12 sm:w-auto"
            >
              <a href="#metodo">
                {m.landing_hero_cta_how()}
                <ArrowDown aria-hidden="true" />
              </a>
            </Button>
            <Link to="/login" className="lp-hs-link">
              {m.landing_cta_demo()}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </div>
        <HeroLedger />
      </div>
      <div className={`${CONTAINER} lp-hs-trace`}>
        <HeroFio />
      </div>
      <div className={`${CONTAINER} lp-hs-after`}>
        <HeroDeadline />
      </div>
    </section>
  );
}
