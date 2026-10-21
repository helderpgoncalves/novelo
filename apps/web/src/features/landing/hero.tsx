import { Link } from '@tanstack/react-router';
import { ArrowDown, ArrowRight } from 'lucide-react';
import type { CSSProperties } from 'react';
import { HeroPicture } from '@/components/photos';
import { Button } from '@/components/ui/button';
import { m } from '@/paraglide/messages';
import { HeroDeadline } from './hero-deadline';
import { HeroFio } from './hero-fio';
import { HERO_SKY } from './landing-assets.generated';
import { CONTAINER } from './layout';

/** Separa o primeiro número com «%» do título («23 %»): vai em itálico verde (Newsreader Display Italic). */
function splitTitle(title: string): [string, string | null, string] {
  const match = /\d+(?:[.,]\d+)?[\s ]?%/.exec(title);
  if (!match) return [title, null, ''];
  return [title.slice(0, match.index), match[0], title.slice(match.index + match[0].length)];
}

/**
 * Topo da página: uma pergunta com a resposta por descobrir. O título diz o que ninguém diz («Guimarães recolhe 23 % do têxtil
 * que podia»), o subtítulo promete o método e o objeto do hero é o fio (`HeroFio`): desenha-se do vale ao campanário da Penha,
 * cheio até aos 22,9 % que a Vitrus já recolhe e a tracejado até ao potencial. Os ganchos (a pergunta das toneladas em falta, o
 * prazo europeu de 17 abr 2028) levam ao «Problema»; o botão primário leva ao «Método». Tudo numa grelha de 12 colunas com uma
 * só margem esquerda, a da barra de navegação. A fotografia é a Penha ao fim do dia (RaquelRosa7, CC BY-SA 4.0), em meio-tom;
 * em ecrã largo é enquadrada para o campanário ficar onde o fio termina. O texto não anima (LCP).
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
          <p className="lp-hs-eyebrow">{m.landing_eyebrow()}</p>
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
          <HeroDeadline className="lp-hs-deadline-copy lp-hs-stagger" />
        </div>
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
