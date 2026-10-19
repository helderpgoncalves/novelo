import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Barra de ação presa ao fundo do ecrã em telemóvel (acima da barra do sistema) e normal em ecrãs largos.
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
      className={cn(
        'sticky bottom-0 z-20 -mx-4 border-border/60 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none',
        className,
      )}
    >
      {children}
    </div>
  );
}
