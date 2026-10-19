import { BadgeCheck, CircleHelp } from 'lucide-react';
import type { ReactNode } from 'react';
import { SectionTitle } from '@/components/page';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

interface StorySectionProps {
  /** Número da secção na narrativa (02 a 07); a secção de fecho não tem número. */
  step?: number;
  /** Etiqueta curta da secção (o "capítulo"). */
  label: string;
  /** Título-conclusão: a frase que o gráfico prova. */
  title: ReactNode;
  description?: ReactNode;
  /** Notas à esquerda, abaixo do texto (leitura do gráfico, estado dos dados). */
  aside?: ReactNode;
  children: ReactNode;
  /** `split`: texto à esquerda e gráfico à direita (desktop). `stack`: gráfico a toda a largura. */
  layout?: 'split' | 'stack';
  id?: string;
  className?: string;
}

/** Uma secção da história: capítulo numerado, título-conclusão e um único visual. */
export function StorySection({
  step,
  label,
  title,
  description,
  aside,
  children,
  layout = 'split',
  id,
  className,
}: StorySectionProps) {
  const headingId = `${id ?? `story-${step ?? 'end'}`}-title`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn('scroll-mt-20 border-border border-t pt-8 sm:pt-10', className)}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-x-10">
        <header
          className={cn(
            'min-w-0 space-y-4',
            layout === 'split' ? 'lg:col-span-4' : 'lg:col-span-12 lg:max-w-4xl',
          )}
        >
          <p className="eyebrow flex items-center gap-3">
            {step !== undefined && (
              <>
                <span className="font-serif text-base text-foreground tabular-nums tracking-normal">
                  {String(step).padStart(2, '0')}
                </span>
                <span aria-hidden="true" className="h-px w-8 bg-areia" />
              </>
            )}
            {label}
          </p>
          <SectionTitle className="text-[1.65rem] leading-[1.15] sm:text-[2rem]">
            <span id={headingId}>{title}</span>
          </SectionTitle>
          {description && (
            <p className="max-w-prose text-muted-foreground text-sm leading-relaxed sm:text-base">
              {description}
            </p>
          )}
          {aside}
        </header>
        <div className={cn('min-w-0', layout === 'split' ? 'lg:col-span-8' : 'lg:col-span-12')}>
          {children}
        </div>
      </div>
    </section>
  );
}

/** Linha de fonte por baixo de cada visual. */
export function SourceLine({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-muted-foreground text-xs leading-relaxed', className)}>
      <span className="font-semibold text-foreground/80">{m.home_source()}</span> {children}
    </p>
  );
}

const PILL =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-semibold text-[10px] uppercase leading-none tracking-wider';

/** Selo "estimativa": areia só como preenchimento, com contorno e texto em tinta. */
export function EstimateTag({ className }: { className?: string }) {
  return (
    <span className={cn(PILL, 'bg-areia/20 text-foreground ring-1 ring-areia', className)}>
      {m.common_estimate()}
    </span>
  );
}

/** Selo "por verificar": valor registado mas sem fonte confirmada. */
export function UnverifiedTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(PILL, 'border border-foreground/50 border-dashed text-foreground', className)}
    >
      <CircleHelp className="size-3" aria-hidden="true" />
      {m.home_unverified()}
    </span>
  );
}

export function VerifiedTag({ className }: { className?: string }) {
  return (
    <span className={cn(PILL, 'bg-primary/10 text-primary ring-1 ring-primary/30', className)}>
      <BadgeCheck className="size-3" aria-hidden="true" />
      {m.home_verified()}
    </span>
  );
}
