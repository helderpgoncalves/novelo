import { type KeyboardEvent, useRef } from 'react';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { LAYER_INFO } from './layer-info';
import { LAYERS } from './map-model';
import type { LayerId } from './tabs';

/**
 * Controlo segmentado das camadas: um grupo de escolha única, limpo e sólido. Setas mudam de camada (como um grupo de
 * rádio); em telemóvel as seis camadas ficam numa grelha (3 × 2, ou 2 × 3 abaixo de 360 px), todas à vista.
 */
export function LayerSwitch({
  layer,
  onChange,
}: {
  layer: LayerId;
  onChange: (layer: LayerId) => void;
}) {
  const group = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (step === 0) return;
    e.preventDefault();
    const at = LAYERS.findIndex((l) => l.id === layer);
    const next = LAYERS[(at + step + LAYERS.length) % LAYERS.length];
    if (!next) return;
    onChange(next.id);
    group.current?.querySelector<HTMLElement>(`[data-layer="${next.id}"]`)?.focus();
  };
  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={m.home_layers_label()}
      onKeyDown={onKeyDown}
      className="-mx-1 grid grid-cols-3 gap-0.5 rounded-lg bg-muted p-1 max-[359px]:grid-cols-2 sm:flex sm:overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {LAYERS.map((l) => {
        const on = l.id === layer;
        return (
          // biome-ignore lint/a11y/useSemanticElements: grupo de escolha única segmentado, com setas
          <button
            key={l.id}
            type="button"
            role="radio"
            data-layer={l.id}
            aria-checked={on}
            aria-label={LAYER_INFO[l.id].label()}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(l.id)}
            className={cn(
              'inline-flex min-h-10 min-w-0 shrink-0 items-center whitespace-nowrap justify-center rounded-md px-2 font-medium text-sm sm:px-3.5 outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/60 sm:flex-1',
              on
                ? 'bg-card text-foreground shadow-sm ring-1 ring-foreground/20'
                : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
            )}
          >
            {LAYER_INFO[l.id].short()}
          </button>
        );
      })}
    </div>
  );
}
