import type { CSSProperties } from 'react';
import type { Typology } from '@/client';
import { cn } from '@/lib/utils';
import { typologyLabel } from '@/lib/vocab';
import { TYPOLOGIES } from './schedule';

type Shape = 'square' | 'circle' | 'triangle' | 'diamond' | 'hexagon' | 'cross' | 'ring';

/** Forma de cada tipologia: junto à cor e ao texto, para não depender só da cor. */
export const TYPOLOGY_SHAPE: Record<Typology, Shape> = {
  undifferentiated: 'square',
  organic: 'circle',
  recyclable: 'triangle',
  payt: 'diamond',
  bulky: 'hexagon',
  support: 'cross',
  to_confirm: 'ring',
  unassigned: 'ring',
};

/** Mesmas cores dos tokens `--ty-*` (claro e escuro), para o mapa e os gráficos que não leem CSS. */
export const TYPOLOGY_HEX: Record<Typology, { light: string; dark: string }> = {
  undifferentiated: { light: '#5e6b66', dark: '#9fb0a9' },
  organic: { light: '#2e6b57', dark: '#7fb39c' },
  recyclable: { light: '#35688a', dark: '#7fb0d4' },
  payt: { light: '#8d6a1f', dark: '#d4b068' },
  bulky: { light: '#a4553a', dark: '#e0906f' },
  support: { light: '#6b5a8c', dark: '#b4a4d6' },
  to_confirm: { light: '#7d7766', dark: '#a39d8c' },
  unassigned: { light: '#8a8577', dark: '#8f8a7c' },
};

export const typologyVar = (t: Typology) => `var(--ty-${t})`;

const PATHS: Record<Shape, string> = {
  square: 'M2 2h8v8H2z',
  circle: 'M6 1.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z',
  triangle: 'M6 1.5 11 10.5H1z',
  diamond: 'M6 .8 11.2 6 6 11.2.8 6z',
  hexagon: 'M3.5 1.6h5L11 6l-2.5 4.4h-5L1 6z',
  cross: 'M4.4 1.5h3.2v2.9h2.9v3.2H7.6v2.9H4.4V7.6H1.5V4.4h2.9z',
  ring: 'M6 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 1.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z',
};

/** Marca da tipologia (cor + forma), decorativa: o nome vem sempre em texto ao lado. */
export function TypologyMark({ typology, className }: { typology: Typology; className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={cn('size-3 shrink-0', className)}
      style={{ color: typologyVar(typology) }}
    >
      <path d={PATHS[TYPOLOGY_SHAPE[typology]]} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

/** Estilo de um bloco: fundo suave da tipologia, barra à esquerda na cor cheia. */
export const blockStyle = (t: Typology): CSSProperties => ({
  background: `color-mix(in oklab, ${typologyVar(t)} 13%, var(--card))`,
  borderLeftColor: typologyVar(t),
});

export function TypologyLegend({ only, className }: { only?: Typology[]; className?: string }) {
  const list = only ?? TYPOLOGIES;
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1.5 text-xs', className)}>
      {list.map((t) => (
        <li key={t} className="flex items-center gap-1.5">
          <TypologyMark typology={t} />
          <span>{typologyLabel[t]()}</span>
        </li>
      ))}
    </ul>
  );
}
