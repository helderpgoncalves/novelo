import type { ComponentProps, ReactNode } from 'react';
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

/** Título de secção, para os sítios onde a secção tem estrutura própria. */
export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('text-balance text-[1.4rem] sm:text-2xl', className)}>{children}</h2>;
}

/** Secção de página: título serifado, descrição curta e conteúdo. */
export function Section({ title, description, actions, children, className }: SectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <SectionTitle>{title}</SectionTitle>
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

/** Painel: o contentor de cartão usado para gráficos, listas e formulários. */
export function Panel({
  children,
  className,
  ...props
}: { children: ReactNode; className?: string } & Omit<ComponentProps<'div'>, 'className'>) {
  return (
    <div
      className={cn('rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5', className)}
      {...props}
    >
      {children}
    </div>
  );
}
