import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { BrandSymbol } from '@/components/brand-logo';
import { PUBLIC_GUTTER, PUBLIC_WIDE } from '@/components/public-shell';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

/**
 * Sistema de espaçamento e de componentes ÚNICO da landing. Nenhuma secção define medidas próprias:
 * - `SECTION_Y`: padding vertical de toda a secção; `CONTAINER`: largura e margens laterais iguais ao cabeçalho;
 * - ritmo: eyebrow → título (`space-y-4`), cabeçalho → conteúdo (`gap-10 lg:gap-14`), grelhas (`GRID_GAP`);
 * - `CARD` é o único cartão; `IconTile` o único ícone de cartão; `BODY` o único texto corrente.
 */
export const SECTION_Y = 'py-20 lg:py-28';
/** Topo da página: o cabeçalho fixo já dá ar por cima, por isso só o início é mais curto. */
export const HERO_Y = 'pt-12 pb-20 lg:pt-20 lg:pb-28';
export const CONTAINER = `mx-auto w-full ${PUBLIC_WIDE} ${PUBLIC_GUTTER}`;
export const GRID_GAP = 'gap-4 lg:gap-6';
export const CARD_SURFACE = 'rounded-lg border border-border bg-card shadow-xs';
export const CARD = `${CARD_SURFACE} p-6`;
export const CARD_TITLE = 'text-xl leading-snug';
export const BODY = 'text-pretty text-muted-foreground leading-relaxed';
/** Número de destaque (serif, algarismos alinhados). */
export const STAT =
  'font-medium font-serif text-4xl text-primary tabular-nums leading-none lg:text-5xl';
/** Botões: a mesma altura de 44 px do ecrã de entrada. */
export const CTA_PRIMARY = 'h-11 px-6 font-semibold';
export const CTA_SECONDARY = 'h-11 px-6 font-medium';

/** Cabeçalho de secção: eyebrow, título serifado e subtítulo, sempre com o mesmo ritmo e largura de leitura. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  lead,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="max-w-3xl space-y-4">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="lp-headline">
        {title}
      </h2>
      {lead && <p className="lp-lead max-w-2xl text-muted-foreground">{lead}</p>}
    </div>
  );
}

/** Secção da landing. `tone="band"` alterna o fundo para dar ritmo à página; o conteúdo entra ao rolar (um bloco). */
export function LandingSection({
  id,
  eyebrow,
  title,
  lead,
  tone = 'plain',
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead?: string;
  tone?: 'plain' | 'band';
  children: ReactNode;
}) {
  const headingId = `${id}-title`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        'scroll-mt-16',
        SECTION_Y,
        tone === 'band' && 'border-border border-y bg-card/40',
      )}
    >
      <div data-reveal="" className={cn(CONTAINER, 'flex flex-col gap-10 lg:gap-14')}>
        <SectionHeading id={headingId} eyebrow={eyebrow} title={title} lead={lead} />
        {children}
      </div>
    </section>
  );
}

/** Ícone de cartão: mesma família (Lucide), mesmo tamanho (20 px) e traço, sobre o mesmo bloco. */
export function IconTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-md bg-accent text-primary">
      <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
    </span>
  );
}

/** Bloco de uma ilustração decorativa da marca (mesma proporção em toda a landing). */
export function SymbolWatermark({ className }: { className?: string }) {
  return (
    <BrandSymbol className={cn('pointer-events-none absolute size-72 opacity-25', className)} />
  );
}

/** Etiqueta "estimativa": todo o número que não foi medido a leva (regra do projeto). */
export function Estimate() {
  return (
    <span className="ml-2 inline-flex items-center rounded-full border border-border px-2 py-0.5 align-middle font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
      {m.landing_estimate_tag()}
    </span>
  );
}
