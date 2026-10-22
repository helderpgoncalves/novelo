import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Barra de ação presa ao fundo da área de conteúdo em telemóvel e normal em ecrãs largos. Assenta sobre a barra de
 * separadores, que já ocupa a zona da barra inicial (safe area), por isso não repete essa folga.
 * Mantém a ação principal ao alcance do polegar em formulários compridos.
 */
export function StickyActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-sticky-actions=""
      className={cn(
        'sticky bottom-0 z-20 -mx-4 border-border/60 border-t bg-background/95 px-4 pt-3 pb-3 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none',
        className,
      )}
    >
      {children}
    </div>
  );
}
