import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="text-balance text-[1.75rem] leading-tight sm:text-4xl">{title}</h1>
        {description && (
          <p className="max-w-3xl text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
