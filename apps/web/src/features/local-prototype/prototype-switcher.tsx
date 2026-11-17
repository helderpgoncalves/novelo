/**
 * PROTOTIPO (wayfinder #51) — comutador flutuante de variantes.
 * Pílula fixa no fundo: setas para circular, rótulo com a variante atual,
 * teclado ←/→. Nunca aparece em build de produção.
 * (Duplicado de propósito do comutador do protótipo do cidadão: ambos são
 * throwaway e vivem em branches separados.)
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export interface VariantDef {
  key: string;
  name: string;
}

export function PrototypeSwitcher({
  variants,
  current,
  onSelect,
}: {
  variants: VariantDef[];
  current: string;
  onSelect: (key: string) => void;
}) {
  if (import.meta.env.PROD) return null;

  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current),
  );
  const currentDef = variants[index] ?? { key: current, name: '' };
  const cycle = (dir: 1 | -1) =>
    onSelect(variants[(index + dir + variants.length) % variants.length]?.key ?? current);

  return (
    <section
      aria-label="Variantes do protótipo"
      className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 print:hidden"
    >
      <div className="flex items-center gap-1 rounded-full bg-amber-400 p-1 text-amber-950 shadow-lg ring-2 ring-amber-600/40">
        <Button
          size="icon"
          variant="ghost"
          className="size-10 rounded-full hover:bg-amber-500/40"
          aria-label="Variante anterior"
          onClick={() => cycle(-1)}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Button>
        <span className="min-w-44 text-center text-sm font-semibold">
          {currentDef.key} · {currentDef.name}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-10 rounded-full hover:bg-amber-500/40"
          aria-label="Variante seguinte"
          onClick={() => cycle(1)}
        >
          <ChevronRight className="size-5" aria-hidden />
        </Button>
      </div>
    </section>
  );
}

/** Atalhos de teclado ←/→ (fora de campos de escrita). */
export function useVariantKeyboard(
  variants: VariantDef[],
  current: string,
  onSelect: (key: string) => void,
) {
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
      const index = Math.max(
        0,
        variants.findIndex((v) => v.key === current),
      );
      if (e.key === 'ArrowLeft') {
        onSelect(variants[(index - 1 + variants.length) % variants.length]?.key ?? current);
      }
      if (e.key === 'ArrowRight') {
        onSelect(variants[(index + 1 + variants.length) % variants.length]?.key ?? current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [variants, current, onSelect]);
}
