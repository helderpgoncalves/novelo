import { ArrowRight } from 'lucide-react';
import { type CSSProperties, useId } from 'react';
import { formatNumber, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { FACTS } from './facts';
import { HeroCount } from './hero-count';
import { CAPTURED, FIO_H, FIO_MARKS, FIO_PATH, FIO_W, GAP_MID, GAP_T } from './hero-fio-model';
import { Estimate } from './layout';

/** Momento (ms) em que o fio chega a cada marca: o número começa a contar e a marca assenta nesse instante. */
const AT = { solid: 600, gap: 1050, end: 1600 } as const;

const tonnesOne = (n: number) => formatTonnes(n);
const approxT = (n: number) => `≈ ${formatNumber(Math.round(n))} t`;

/** Posição de uma marca: fração do `viewBox` horizontal (`--x`, `--y`) e do fio vertical (`--vy`, o comprimento). */
function at(point: { x: number; y: number }, vy: number): CSSProperties {
  return {
    '--x': point.x / FIO_W,
    '--y': point.y / FIO_H,
    '--vy': vy,
  } as CSSProperties;
}

/**
 * O fio solto: um fio que se desenha ao carregar, do vale (esquerda) ao campanário da Penha, com o troço cheio até
 * 22,9 % do comprimento (o que a Vitrus recolhe: 301,3 t de ≈ 1 317 t) e o resto a tracejado (o que falta captar), um nó
 * onde acaba o cheio e um fio a desfiar na ponta. Três marcas leem-se sobre o fio: o medido, o que falta (em destaque) e o
 * potencial. Em telemóvel o mesmo fio corre na vertical. SVG inline, só `stroke-dashoffset`, opacidade e transform.
 */
export function HeroFio() {
  const id = useId().replace(/:/g, '');
  const { solid, gap, end } = FIO_MARKS;
  const collected = tonnesOne(FACTS.collectedT);
  const potential = approxT(FACTS.potentialT);
  const missing = approxT(GAP_T);
  const description = m.landing_hero_fio_alt({
    collected,
    potential: potential.replace('≈ ', ''),
    gap: missing.replace('≈ ', ''),
  });
  const cut = Math.round(solid.x);
  return (
    <figure className="lp-fio" aria-label={description}>
      <svg
        className="lp-fio-h"
        viewBox={`0 0 ${FIO_W} ${FIO_H}`}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <mask
            id={`${id}-m`}
            maskUnits="userSpaceOnUse"
            x={-20}
            y={-20}
            width={FIO_W + 40}
            height={FIO_H + 40}
          >
            <path
              d={FIO_PATH}
              pathLength={1}
              fill="none"
              stroke="#fff"
              strokeWidth={28}
              className="lp-fio-reveal"
            />
          </mask>
          <clipPath id={`${id}-a`}>
            <rect x={-20} y={-20} width={cut + 20} height={FIO_H + 40} />
          </clipPath>
          <clipPath id={`${id}-b`}>
            <rect x={cut} y={-20} width={FIO_W + 20 - cut} height={FIO_H + 40} />
          </clipPath>
        </defs>
        <g mask={`url(#${id}-m)`}>
          <path d={FIO_PATH} fill="none" className="lp-fio-case" />
          <g clipPath={`url(#${id}-a)`}>
            <path d={FIO_PATH} fill="none" className="lp-fio-line" />
          </g>
          <g clipPath={`url(#${id}-b)`}>
            <path d={FIO_PATH} fill="none" className="lp-fio-dash" />
          </g>
        </g>
      </svg>
      <svg className="lp-fio-v" viewBox="0 0 12 100" aria-hidden="true" focusable="false">
        <defs>
          <mask id={`${id}-vm`} maskUnits="userSpaceOnUse" x={-10} y={-10} width={32} height={120}>
            <path
              d="M6 0V100"
              pathLength={1}
              fill="none"
              stroke="#fff"
              strokeWidth={24}
              className="lp-fio-reveal"
            />
          </mask>
        </defs>
        <g mask={`url(#${id}-vm)`}>
          <path d="M6 0V100" fill="none" className="lp-fio-case" />
          <path d={`M6 0V${CAPTURED * 100}`} fill="none" className="lp-fio-line" />
          <path d={`M6 ${CAPTURED * 100}V100`} fill="none" className="lp-fio-dash" />
        </g>
      </svg>

      <span className="lp-fio-brace" style={at(solid, CAPTURED)} aria-hidden="true" />
      <span className="lp-fio-node" data-k="solid" style={at(solid, CAPTURED)} aria-hidden="true" />
      <span className="lp-fio-node" data-k="gap" style={at(gap, GAP_MID)} aria-hidden="true" />
      <svg
        className="lp-fio-fray"
        viewBox="0 0 40 40"
        aria-hidden="true"
        focusable="false"
        style={at(end, 1)}
      >
        <path d="M2 20C10 19 14 12 22 10S34 6 38 2" />
        <path d="M2 20C12 21 18 18 26 19S34 22 38 28" />
        <path d="M2 20C8 24 10 30 16 33S26 36 30 39" />
      </svg>

      <div
        className="lp-fm"
        data-k="solid"
        style={{ ...at(solid, CAPTURED), '--d': `${AT.solid}ms` } as CSSProperties}
      >
        <div aria-hidden="true" className="lp-fm-body">
          <p className="lp-fm-v">
            <HeroCount value={FACTS.collectedT} format={tonnesOne} delay={AT.solid} />
          </p>
          <p className="lp-fm-l">
            {m.landing_hero_mark_collected()}
            <span className="lp-fm-tag">{m.landing_status_measured()}</span>
          </p>
        </div>
      </div>

      <div
        className="lp-fm"
        data-k="gap"
        style={{ ...at(gap, GAP_MID), '--d': `${AT.gap}ms` } as CSSProperties}
      >
        <div aria-hidden="true" className="lp-fm-body">
          <p className="lp-fm-v">
            <HeroCount value={GAP_T} format={approxT} delay={AT.gap} />
          </p>
          <p className="lp-fm-l">
            {m.landing_hero_mark_gap()}
            <Estimate className="lp-fm-tag" />
          </p>
        </div>
        <a href="#problema" className="lp-fm-hook">
          {m.landing_hero_hook_gap({ tonnes: `${formatNumber(GAP_T)}\u00a0t` })}
          <ArrowRight aria-hidden="true" className="size-4" />
        </a>
      </div>

      <div
        className="lp-fm"
        data-k="end"
        style={{ ...at(end, 1), '--d': `${AT.end}ms` } as CSSProperties}
      >
        <div aria-hidden="true" className="lp-fm-body">
          <p className="lp-fm-v">
            <HeroCount value={FACTS.potentialT} format={approxT} delay={AT.end} />
          </p>
          <p className="lp-fm-l">
            {m.landing_hero_mark_potential()}
            <Estimate className="lp-fm-tag" />
          </p>
        </div>
      </div>

      <p className="lp-fio-src">
        {m.landing_hero_source()}
        <span aria-hidden="true"> · </span>
        <span className="lp-fio-src-est">{m.landing_estimate_tag()}</span>
      </p>
    </figure>
  );
}
