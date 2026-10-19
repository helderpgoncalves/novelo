import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PanelProps {
  title?: string;
  description?: ReactNode;
  /** Etiqueta ou ação alinhada à direita do título. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Cartão de conteúdo: o mesmo fundo, anel e espaçamento em todas as páginas. */
export function Panel({ title, description, aside, children, className }: PanelProps) {
  return (
    <div
      className={cn(
        'min-w-0 space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5',
        className,
      )}
    >
      {(title || aside) && (
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            {title && <h3 className="font-semibold text-base">{title}</h3>}
            {aside}
          </div>
          {description && (
            <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

/** Etiqueta pequena "estimativa" usada ao lado de títulos e valores calculados pelo modelo. */
export function EstimateTag({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-areia/25 px-1.5 py-px font-semibold text-[9px] text-foreground/80 uppercase tracking-wider">
      {label}
    </span>
  );
}
