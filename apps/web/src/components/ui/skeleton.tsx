import { cn } from '@/lib/utils';

/** Bloco de carregamento com brilho suave; respeita `prefers-reduced-motion` (ver `.skeleton` em styles.css). */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" className={cn('skeleton rounded-md', className)} {...props} />;
}

export { Skeleton };
