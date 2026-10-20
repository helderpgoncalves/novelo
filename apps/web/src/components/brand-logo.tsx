import type { CSSProperties } from 'react';
import { LOCKUP, STACKED, SYMBOL } from '@/components/brand-geometry.gen';
import { cn } from '@/lib/utils';

/**
 * Logótipo do Novelo. A geometria (símbolo, wordmark em curvas, caixa simétrica ao eixo do símbolo) vem de
 * `brand-geometry.gen.ts`, gerado por `just brand` a partir da fonte real: nada é montado à mão aqui.
 * O tamanho define-se só pela altura (`h-7`, `h-8`...); a largura segue a proporção do viewBox.
 */
type Tone = 'auto' | 'color' | 'negative' | 'mono';

type ToneClasses = { inner: string; mid: string; outer: string; dot: string; word: string };

/** `auto` segue o tema (html.dark); as outras são fixas. Classes literais para o Tailwind as detetar. */
const TONES: Record<Tone, ToneClasses> = {
  auto: {
    inner: 'stroke-[#A9C2B7] dark:stroke-[#3E6658]',
    mid: 'stroke-[#2E6B57] dark:stroke-[#7FB39C]',
    outer: 'stroke-[#C4A06A]',
    dot: 'fill-[#14211D] dark:fill-[#F4F1EA]',
    word: 'fill-current',
  },
  color: {
    inner: 'stroke-[#A9C2B7]',
    mid: 'stroke-[#2E6B57]',
    outer: 'stroke-[#C4A06A]',
    dot: 'fill-[#14211D]',
    word: 'fill-[#14211D]',
  },
  negative: {
    inner: 'stroke-[#3E6658]',
    mid: 'stroke-[#7FB39C]',
    outer: 'stroke-[#C4A06A]',
    dot: 'fill-[#F4F1EA]',
    word: 'fill-[#F4F1EA]',
  },
  mono: {
    inner: 'stroke-current',
    mid: 'stroke-current',
    outer: 'stroke-current',
    dot: 'fill-current',
    word: 'fill-current',
  },
};

/** Classes de movimento dos arcos (interior, médio, exterior) e do ponto: ver `.brand-arc-*` em styles.css. */
const ARC_MOTION = [
  'brand-arc brand-arc-1',
  'brand-arc brand-arc-2',
  'brand-arc brand-arc-3',
] as const;

function SymbolMarks({
  tone,
  transform,
  animated = false,
}: {
  tone: Tone;
  transform?: string;
  animated?: boolean;
}) {
  const c = TONES[tone];
  const strokes = [c.inner, c.mid, c.outer] as const;
  return (
    <g transform={transform}>
      {SYMBOL.arcs.map((d, i) => (
        <path
          key={d}
          d={d}
          fill="none"
          strokeWidth={SYMBOL.strokeWidth}
          strokeLinecap="round"
          className={cn(strokes[i], animated && ARC_MOTION[i])}
        />
      ))}
      <path d={SYMBOL.dot} fillRule="evenodd" className={cn(c.dot, animated && 'brand-dot')} />
    </g>
  );
}

/** Só o símbolo. O viewBox é a caixa de tinta: centra-se pela tinta em qualquer contentor (`size-8`, etc.). */
export function BrandSymbol({ tone = 'auto', className }: { tone?: Tone; className?: string }) {
  return (
    <svg
      viewBox={SYMBOL.viewBox}
      className={cn('size-8 shrink-0', className)}
      aria-hidden="true"
      focusable="false"
    >
      <SymbolMarks tone={tone} />
    </svg>
  );
}

/**
 * Símbolo a girar (estados de "a trabalhar"). Caixa quadrada centrada no ponto do símbolo: cada arco roda sobre
 * esse centro (exterior lento num sentido, médio mais rápido ao contrário, interior o mais rápido) e o ponto
 * pulsa de leve. O movimento está em `.brand-arc-*` (styles.css, só transform) e é o mesmo do ecrã de arranque
 * do `index.html`; com movimento reduzido vira um pulso de opacidade. Decorativo: quem o usa anuncia o estado por texto.
 */
export function BrandSpinner({
  tone = 'auto',
  className,
  style,
  spin = true,
}: {
  tone?: Tone;
  className?: string;
  style?: CSSProperties;
  /** `false`: só a geometria centrada (para animações próprias, ex.: `.brand-drift`). */
  spin?: boolean;
}) {
  return (
    <svg
      viewBox="-420 -420 840 840"
      style={style}
      className={cn(spin && 'brand-spin', 'size-[18px] shrink-0', className)}
      aria-hidden="true"
      focusable="false"
      data-testid="brand-spinner"
    >
      <SymbolMarks tone={tone} animated={spin} />
    </svg>
  );
}

/** Lockup horizontal (símbolo + wordmark) ou empilhado. Dimensiona-se pela altura. */
export function BrandLogo({
  tone = 'auto',
  stacked = false,
  className,
}: {
  tone?: Tone;
  stacked?: boolean;
  className?: string;
}) {
  const g = stacked ? STACKED : LOCKUP;
  return (
    <svg
      viewBox={g.viewBox}
      className={cn('block h-8 w-auto shrink-0', className)}
      role="img"
      aria-label="Novelo"
    >
      <SymbolMarks tone={tone} transform={g.symbolTransform} />
      <path d={g.wordmark} className={TONES[tone].word} />
    </svg>
  );
}
