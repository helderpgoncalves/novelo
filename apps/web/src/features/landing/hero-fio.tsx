import { type CSSProperties, useId } from 'react';
import { formatNumber, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { FACTS } from './facts';
import { FIO_H, FIO_MARKS, FIO_PATH, FIO_W, GAP_T } from './hero-fio-model';

const tonnesOne = (n: number) => formatTonnes(n);
const approxT = (n: number) => `≈ ${formatNumber(Math.round(n))} t`;

/** Posição de um nó: fração do `viewBox` (`--x`, `--y`). */
function at(point: { x: number; y: number }): CSSProperties {
  return { '--x': point.x / FIO_W, '--y': point.y / FIO_H } as CSSProperties;
}

/**
 * O fio solto, só gráfico: desenha-se ao carregar, do vale (esquerda) ao campanário da Penha, com o troço cheio até 9,1 % do
 * comprimento (o que a Vitrus recolhe: 301,3 t de ≈ 3 305 t gerados), o resto a tracejado (o que ainda vai para o lixo), um nó
 * onde acaba o cheio e um fio a desfiar na ponta. Sem texto por cima da fotografia: os números estão no painel do hero
 * (`HeroLedger`); aqui só a descrição para leitores de ecrã. Em telemóvel e tablet de pé não aparece (o painel leva o fio em
 * miniatura). SVG inline, só `stroke-dashoffset`, opacidade e transform.
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
    <figure className="lp-fio" role="img" aria-label={description}>
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

      <span className="lp-fio-node" data-k="solid" style={at(solid)} aria-hidden="true" />
      <span className="lp-fio-node" data-k="gap" style={at(gap)} aria-hidden="true" />
      <svg
        className="lp-fio-fray"
        viewBox="0 0 40 40"
        aria-hidden="true"
        focusable="false"
        style={at(end)}
      >
        <path d="M2 20C10 19 14 12 22 10S34 6 38 2" />
        <path d="M2 20C12 21 18 18 26 19S34 22 38 28" />
        <path d="M2 20C8 24 10 30 16 33S26 36 30 39" />
      </svg>
    </figure>
  );
}
