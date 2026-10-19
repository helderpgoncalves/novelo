import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StepSectionProps {
  step: number;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Passo numerado de um formulário comprido: o número, o título, uma frase de ajuda e o conteúdo. */
export function StepSection({ step, title, description, children, className }: StepSectionProps) {
  const id = `step-${step}`;
  return (
    <section aria-labelledby={id} className={cn('flex gap-3 sm:gap-5', className)}>
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-foreground text-sm tabular-nums"
      >
        {step}
      </span>
      <div className="min-w-0 flex-1 space-y-4">
        <div className="space-y-1">
          <h2 id={id} className="text-balance text-[1.4rem] leading-tight sm:text-2xl">
            {title}
          </h2>
          {description && (
            <p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">{description}</p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
