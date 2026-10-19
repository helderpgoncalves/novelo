import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Raiz de cada página: o mesmo ritmo vertical em todo o produto (mais apertado em telemóvel). */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('space-y-8 sm:space-y-12', className)}>{children}</div>;
}

interface SectionProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Secção de página: título serifado, descrição curta e conteúdo. */
export function Section({ title, description, actions, children, className }: SectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-balance text-[1.4rem] sm:text-2xl">{title}</h2>
          {description && (
            <p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">{description}</p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
