/**
 * PROTOTIPO (wayfinder #50) — comutador flutuante de variantes.
 * Pilula fixa no fundo: setas para circular, rotulo com a variante atual,
 * teclado <-/->. Nunca aparece em build de producao. Throwaway.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect } from 'react';
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
  /** Sobe a pilula quando a variante tem barra inferior fixa propria (B e C). */
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
      aria-label="Variante do protótipo"
      className={cn(
        'fixed left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-foreground px-1.5 py-1 text-background shadow-xl',
        raised ? 'bottom-24' : 'bottom-3',
      )}
    >
      <button
        type="button"
        onClick={() => cycle(-1)}
        aria-label="Variante anterior"
        className="flex size-9 items-center justify-center rounded-full hover:bg-background/15"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </button>
      <span className="min-w-40 text-center text-sm font-semibold">
        {def.key} · {def.name}
      </span>
      <button
        type="button"
        onClick={() => cycle(1)}
        aria-label="Variante seguinte"
        className="flex size-9 items-center justify-center rounded-full hover:bg-background/15"
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
