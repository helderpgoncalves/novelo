import { Link } from '@tanstack/react-router';
import { type KeyboardEvent, memo, useId, useMemo, useState } from 'react';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import {
  type Direction,
  dotsPath,
  LAYERS,
  type LayerId,
  type MapModel,
  neighbourInDirection,
  radiusFor,
} from './map-model';
import { EstimateTag } from './tags';

interface LayerInfo {
  label: () => string;
  description: () => string;
  unit: () => string;
  format: (v: number) => string;
  fill: string;
}

const LAYER_INFO: Record<LayerId, LayerInfo> = {
  gap: {
    label: () => m.home_layer_gap(),
    description: () => m.home_layer_gap_desc(),
    unit: () => m.home_layer_gap_unit(),
    format: (v) => formatNumber(v, v < 10 ? 1 : 0),
    fill: 'fill-primary',
  },
  population: {
    label: () => m.home_layer_population(),
    description: () => m.home_layer_population_desc(),
    unit: () => m.home_layer_population_unit(),
    format: (v) => formatNumber(v),
    fill: 'fill-foreground',
  },
  containers: {
    label: () => m.home_layer_containers(),
    description: () => m.home_layer_containers_desc(),
    unit: () => m.home_layer_containers_unit(),
    format: (v) => formatNumber(v, v < 10 ? 1 : 0),
    fill: 'fill-chart-2',
  },
  circuits: {
    label: () => m.home_layer_circuits(),
    description: () => m.home_layer_circuits_desc(),
    unit: () => m.home_layer_circuits_unit(),
    format: (v) => formatNumber(v),
    fill: 'fill-chart-1',
  },
  data_gaps: {
    label: () => m.home_layer_data_gaps(),
    description: () => m.home_layer_data_gaps_desc(),
    unit: () => m.home_layer_data_gaps_unit(),
    format: (v) => (v > 0 ? m.home_layer_data_gaps_yes() : m.home_layer_data_gaps_no()),
    fill: 'fill-chart-3',
  },
};

const ARROWS: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

const Dots = memo(function Dots({
  paths,
  fill,
  selected,
}: {
  paths: { code: string; d: string }[];
  fill: string;
  selected: string | null;
}) {
  return (
    <g className={cn(fill, 'pointer-events-none')}>
      {paths.map((p) => (
        <path
          key={p.code}
          d={p.d}
          className={cn(
            'transition-opacity duration-200',
            selected && selected !== p.code && 'opacity-30',
          )}
        />
      ))}
    </g>
  );
});

export interface DecisionMapProps {
  model: MapModel;
  layer: LayerId;
  onLayerChange: (layer: LayerId) => void;
  values: Map<string, number>;
  selected: string | null;
  onSelect: (code: string | null) => void;
  covered: Set<string> | null;
  /** Freguesia a mostrar quando o mapa recebe foco e ainda não há seleção. */
  fallbackCode: string | null;
  /** Frase que explica o contorno das freguesias cobertas pelo orçamento; `null` sem orçamento escolhido. */
  coveredNote?: string | null;
  className?: string;
}

/**
 * Mapa de Guimarães em meio-tom: cada freguesia é uma grelha de pontos a 45º cujo raio mede a camada escolhida.
 * Um só SVG (≈ 2 600 pontos em 48 caminhos), sem bibliotecas de mapas. Setas navegam entre vizinhas, Enter abre o detalhe.
 */
export function DecisionMap({
  model,
  layer,
  onLayerChange,
  values,
  selected,
  onSelect,
  covered,
  fallbackCode,
  coveredNote,
  className,
}: DecisionMapProps) {
  const info = LAYER_INFO[layer];
  const uid = useId();
  const [hover, setHover] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const max = useMemo(() => {
    let top = 0;
    for (const v of values.values()) if (v > top) top = v;
    return top;
  }, [values]);
  const paths = useMemo(
    () =>
      model.parishes.map((p) => ({
        code: p.code,
        d: dotsPath(p.dots, radiusFor(values.get(p.code), max, model.step)),
      })),
    [model, values, max],
  );
  const anchors = useMemo(
    () => model.parishes.map((p) => ({ code: p.code, x: p.anchor[0], y: p.anchor[1] })),
    [model],
  );
  const byCode = useMemo(() => new Map(model.parishes.map((p) => [p.code, p])), [model]);

  const tipCode = hover ?? (focused ? active : null);
  const tip = tipCode ? byCode.get(tipCode) : undefined;
  const tipValue = tipCode ? values.get(tipCode) : undefined;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = ARROWS[e.key];
    if (dir) {
      e.preventDefault();
      const from = active ?? selected ?? fallbackCode;
      if (!from) return;
      const next = active ? neighbourInDirection(anchors, from, dir) : from;
      if (next) setActive(next);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const code = active ?? selected ?? fallbackCode;
      if (code) onSelect(code);
    } else if (e.key === 'Escape' && selected) {
      e.preventDefault();
      onSelect(null);
    }
  };

  const legendSizes = [1, 0.25, 1 / 16];
  const legendR = (f: number) => 4 + 9 * Math.sqrt(f);

  return (
    <div className={cn('flex min-w-0 flex-col gap-3', className)}>
      <div
        role="radiogroup"
        aria-label={m.home_layers_label()}
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {LAYERS.map((l) => {
          const on = l.id === layer;
          return (
            // biome-ignore lint/a11y/useSemanticElements: grupo de escolha única com botões em forma de etiqueta
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onLayerChange(l.id)}
              className={cn(
                'inline-flex min-h-10 shrink-0 items-center rounded-full px-3.5 font-medium text-sm outline-none ring-1 ring-foreground/20 transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/60',
                on ? 'bg-foreground text-background ring-foreground' : 'bg-card hover:bg-accent',
              )}
            >
              {LAYER_INFO[l.id].label()}
            </button>
          );
        })}
      </div>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-sm leading-snug">
        {LAYERS.find((l) => l.id === layer)?.estimate && <EstimateTag />}
        <span>{info.description()}</span>
      </p>

      <div className="relative">
        <div
          role="listbox"
          tabIndex={0}
          aria-label={m.home_map_aria_room({ count: model.parishes.length, layer: info.label() })}
          aria-activedescendant={focused && active ? `${uid}-${active}` : undefined}
          className="rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
          onKeyDown={onKeyDown}
          onFocus={() => {
            setFocused(true);
            setActive((a) => a ?? selected ?? fallbackCode);
          }}
          onBlur={() => setFocused(false)}
        >
          <svg
            role="presentation"
            viewBox={`0 0 ${model.width} ${model.height}`}
            preserveAspectRatio="xMidYMid meet"
            className="mx-auto block h-auto max-h-[min(36rem,calc(100dvh-19rem))] min-h-[16rem] w-full"
          >
            <Dots paths={paths} fill={info.fill} selected={selected} />
            <g fill="none" strokeLinejoin="round">
              {model.parishes.map((p) => {
                const isSel = selected === p.code;
                const isActive = focused && active === p.code;
                const isCovered = covered?.has(p.code) ?? false;
                return (
                  <path
                    key={p.code}
                    id={`${uid}-${p.code}`}
                    d={p.outline}
                    role="option"
                    aria-selected={isSel}
                    aria-label={p.name}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="all"
                    className={cn(
                      'cursor-pointer transition-[stroke,fill]',
                      isSel
                        ? 'fill-primary/10 stroke-primary stroke-[2.5]'
                        : isActive
                          ? 'fill-primary/10 stroke-foreground stroke-2'
                          : isCovered
                            ? 'stroke-primary/70 stroke-[1.5]'
                            : 'stroke-foreground/25 stroke-[0.75] hover:fill-primary/10 hover:stroke-foreground/60',
                    )}
                    onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(p.code)}
                    onPointerLeave={() => setHover(null)}
                    onClick={() => {
                      setActive(p.code);
                      onSelect(p.code === selected ? null : p.code);
                    }}
                  />
                );
              })}
            </g>
          </svg>
        </div>

        {tip && (
          <div
            role="presentation"
            className="pointer-events-none absolute z-10 w-max max-w-[14rem] -translate-x-1/2 -translate-y-[calc(100%+0.5rem)] rounded-md bg-foreground px-2.5 py-1.5 text-background text-xs leading-snug shadow-lg"
            style={{
              left: `${Math.min(88, Math.max(12, (tip.anchor[0] / model.width) * 100))}%`,
              top: `${Math.max(14, (tip.anchor[1] / model.height) * 100)}%`,
            }}
          >
            <span className="block font-semibold">{tip.name}</span>
            <span className="block tabular-nums">
              {tipValue === undefined
                ? '—'
                : `${info.format(tipValue)}${layer === 'data_gaps' ? '' : ` ${info.unit()}`}`}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs">
        <div className="flex items-center gap-3">
          {layer === 'data_gaps' ? (
            <span className="inline-flex items-center gap-2">
              <svg width="26" height="26" viewBox="-13 -13 26 26" aria-hidden="true">
                <circle r="11" className={info.fill} />
              </svg>
              {m.home_layer_data_gaps_legend()}
            </span>
          ) : (
            <>
              <svg
                width="84"
                height="30"
                viewBox="0 0 84 30"
                aria-hidden="true"
                className={info.fill}
              >
                {legendSizes.map((f, i) => (
                  <circle key={f} cx={14 + i * 30} cy="15" r={legendR(f)} />
                ))}
              </svg>
              <span className="text-muted-foreground leading-snug">
                {m.home_map_legend({
                  max: info.format(max),
                  unit: info.unit(),
                })}
              </span>
            </>
          )}
        </div>
        <Link
          to="/"
          search={(prev) => ({ ...prev, tab: 'parishes' })}
          hash="provas"
          replace
          className="inline-flex min-h-10 items-center text-primary underline-offset-4 hover:underline"
        >
          {m.home_map_table_link()}
        </Link>
      </div>
      {coveredNote && (
        <p className="flex items-start gap-2 text-xs leading-relaxed">
          <span
            className="mt-1 size-3 shrink-0 rounded-sm border-2 border-primary/70"
            aria-hidden="true"
          />
          {coveredNote}
        </p>
      )}
      <p className="text-muted-foreground text-xs leading-relaxed">{m.home_map_honesty()}</p>
    </div>
  );
}
