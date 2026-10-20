import type { ReactNode } from 'react';
import { PUBLIC_GUTTER, PUBLIC_WIDE } from '@/components/public-shell';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

/**
 * Primitivas da landing. Cada secção compõe o seu próprio layout (bento, pipeline, instrumento, janela, lista editorial),
 * mas todas partilham o ritmo vertical (`SECTION_Y`), a largura (`CONTAINER`, igual à do topo) e o cabeçalho (`Heading`).
 */
export const SECTION_Y = 'py-20 sm:py-24 lg:py-28';
export const CONTAINER = `mx-auto w-full ${PUBLIC_WIDE} ${PUBLIC_GUTTER}`;
/** Legenda e etiquetas técnicas: mono, pequeno, Pedra. */
export const MONO = 'font-mono text-[12px] text-muted-foreground leading-relaxed tracking-tight';
export const BODY = 'text-pretty text-muted-foreground leading-relaxed';
/** Número de destaque (serif, algarismos alinhados). */
export const STAT = 'font-medium font-serif text-primary tabular-nums leading-none';
/** Cartão de base: canto grande, linha fina, sem sombra (a profundidade vem do contraste de fundos). */
export const CARD = 'rounded-[1.375rem] border border-border bg-card';
export const CTA_PRIMARY = 'h-11 px-6 font-semibold';

type Tone = 'plain' | 'band' | 'dark';

/**
 * Secção da landing. `band` alterna o fundo; `dark` é a secção de tinta (re-tematiza os tokens com a classe `dark`, por isso o
 * texto, os cartões e os controlos ficam certos sem cores soltas). Abaixo da dobra só pinta quando se aproxima (`defer`).
 */
export function Section({
  id,
  tone = 'plain',
  defer = true,
  className,
  children,
}: {
  id: string;
  tone?: Tone;
  defer?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        'scroll-mt-[calc(var(--nav-h)+0.5rem)]',
        defer && 'lp-defer',
        SECTION_Y,
        tone === 'band' && 'border-border border-y bg-card/50',
        tone === 'dark' && 'dark border-border border-y bg-[#14211d] text-foreground',
        className,
      )}
    >
      {children}
    </section>
  );
}

const SIZES = { xl: 'lp-h-xl', lg: '', md: 'lp-h-md' } as const;

/** Cabeçalho de secção: número editorial em mono, título serifado (três tamanhos) e subtítulo. */
export function Heading({
  id,
  n,
  eyebrow,
  title,
  lead,
  size = 'lg',
  align = 'left',
  className,
}: {
  id: string;
  /** Número da secção («01»). */
  n?: string;
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  size?: keyof typeof SIZES;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        align === 'center' ? 'mx-auto items-center text-center' : 'max-w-3xl',
        className,
      )}
    >
      <p className="lp-eyebrow">
        {n && <span className="lp-eyebrow-n">{n}</span>}
        {eyebrow}
      </p>
      <h2 id={`${id}-title`} className={cn('lp-headline', SIZES[size])}>
        {title}
      </h2>
      {lead && <p className="lp-lead max-w-2xl text-muted-foreground">{lead}</p>}
    </div>
  );
}

/** Remissão numerada para a lista de Referências (estilo artigo): `[1]` ligado a `#ref-1`. */
export function Cite({ n }: { n: number }) {
  return (
    <sup className="ml-0.5 font-mono text-[11px]">
      <a
        href={`#ref-${n}`}
        aria-label={`${m.landing_refs_title()} ${n}`}
        className="rounded-sm px-0.5 text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        [{n}]
      </a>
    </sup>
  );
}

/** Legenda de figura ou tabela: «Fig. 1» em mono, depois o texto. */
export function FigCaption({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figcaption className={cn(MONO, 'max-w-prose text-pretty', className)}>
      <strong className="mr-2 font-semibold text-foreground">{label}</strong>
      {children}
    </figcaption>
  );
}

/** Estado de um valor: medido, estimativa, pressuposto, calibrado, por verificar ou em validação. */
export type Status =
  | 'measured'
  | 'estimate'
  | 'assumption'
  | 'calibrated'
  | 'unverified'
  | 'validating';

const STATUS_STYLE: Record<Status, string> = {
  measured: 'border-primary/40 bg-primary/10 text-primary',
  calibrated: 'border-primary/40 bg-primary/10 text-primary',
  estimate: 'border-border bg-secondary text-foreground',
  assumption: 'border-border bg-secondary text-foreground',
  unverified: 'border-dashed border-foreground/40 text-muted-foreground',
  validating: 'border-dashed border-foreground/40 text-muted-foreground',
};

export function statusLabel(status: Status): string {
  switch (status) {
    case 'measured':
      return m.landing_status_measured();
    case 'estimate':
      return m.landing_status_estimate();
    case 'assumption':
      return m.landing_status_assumption();
    case 'calibrated':
      return m.landing_status_calibrated();
    case 'unverified':
      return m.landing_status_unverified();
    case 'validating':
      return m.landing_validating();
  }
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[11px] leading-none',
        STATUS_STYLE[status],
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

/** Etiqueta "estimativa": todo o número que não foi medido a leva (regra do projeto). */
export function Estimate({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'ml-2 inline-flex items-center rounded-full border border-current/25 px-2 py-0.5 align-middle font-semibold text-[10px] uppercase leading-none tracking-wider',
        className,
      )}
    >
      {m.landing_estimate_tag()}
    </span>
  );
}
