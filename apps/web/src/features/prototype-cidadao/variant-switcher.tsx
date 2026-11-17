/**
 * PROTOTIPO (wayfinder #48) — comutador flutuante de variantes.
 * Pílula fixa no fundo: setas para circular, rótulo com a variante atual,
 * teclado ←/→. Nunca aparece em build de produção.
 * Throwaway.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface VariantDef {
  key: string;
  name: string;
}

export function PrototypeSwitcher({
  variants,
  current,
  onSelect,
  raised,
}: {
  variants: VariantDef[];
  current: string;
  onSelect: (key: string) => void;
  /** Sobe a pílula quando a variante tem barra inferior própria (B). */
  raised?: boolean;
}) {
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current),
  );
  const cycle = (dir: 1 | -1) => {
    const next = variants[(index + dir + variants.length) % variants.length];
    if (next) onSelect(next.key);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'ArrowLeft') cycle(-1);
      if (e.key === 'ArrowRight') cycle(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (import.meta.env.PROD) return null;
  const def = variants[index] ?? { key: current, name: '' };

  return (
    <nav
      aria-label="Comutador de variantes do protótipo"
      className={cn(
        'fixed inset-x-0 z-50 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        raised ? 'bottom-16' : 'bottom-0',
      )}
    >
      <div className="flex items-center gap-1 rounded-full bg-foreground pl-1 pr-2 py-1 text-background shadow-lg ring-2 ring-background/40">
        <Button
          size="icon"
          variant="ghost"
          className="size-8 text-background hover:bg-background/20 hover:text-background"
          aria-label="Variante anterior"
          onClick={() => cycle(-1)}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <p className="min-w-40 text-center font-mono text-xs">
          <span className="font-bold">{def.key}</span> · {def.name}
        </p>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 text-background hover:bg-background/20 hover:text-background"
          aria-label="Variante seguinte"
          onClick={() => cycle(1)}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
