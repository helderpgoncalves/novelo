import { BadgeCheck, CircleHelp } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

/** Linha de fonte: «Fonte: …». */
export function SourceLine({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-muted-foreground text-xs leading-relaxed', className)}>
      <span className="font-semibold text-foreground/80">{m.home_source()}</span> {children}
    </p>
  );
}

/** Etiqueta pequena de secção: 12 px, maiúsculas, em cor de texto secundário (AA sobre cartão). */
export const EYEBROW = 'font-semibold text-muted-foreground text-xs uppercase tracking-[0.1em]';

const PILL =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 font-semibold text-xs leading-none';

/** Selo «estimativa»: areia só como preenchimento, com contorno e texto em tinta. */
export function EstimateTag({ className }: { className?: string }) {
  return (
    <span className={cn(PILL, 'bg-areia/20 text-foreground ring-1 ring-areia', className)}>
      {m.common_estimate()}
    </span>
  );
}

/** Selo «medido»: dado real recebido (pesagem, contagem, estatística oficial). */
export function MeasuredTag({ className }: { className?: string }) {
  return (
    <span className={cn(PILL, 'bg-primary/10 text-primary ring-1 ring-primary/30', className)}>
      <BadgeCheck className="size-3.5" aria-hidden="true" />
      {m.home_measured()}
    </span>
  );
}

/** Selo «por verificar»: valor registado mas sem fonte confirmada. */
export function UnverifiedTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(PILL, 'border border-foreground/50 border-dashed text-foreground', className)}
    >
      <CircleHelp className="size-3.5" aria-hidden="true" />
      {m.home_unverified()}
    </span>
  );
}
