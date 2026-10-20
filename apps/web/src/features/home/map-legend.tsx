import { useMemo } from 'react';
import { m } from '@/paraglide/messages';
import { type ClassScale, legendClasses, niceBreak } from './choropleth';
import { LAYER_INFO } from './layer-info';
import { LAYERS } from './map-model';
import { rampIndex } from './map-theme';
import type { LayerId } from './tabs';
import { EstimateTag } from './tags';

/** Raio máximo, em píxeis, dos círculos da camada de contentores (o mapa e a legenda usam o mesmo). */
export const DOT_MAX_PX = 24;
export const DOT_MIN_PX = 3;
export const dotRadiusPx = (value: number, max: number): number =>
  value <= 0 || max <= 0 ? 0 : Math.max(DOT_MIN_PX, DOT_MAX_PX * Math.sqrt(value / max));

interface LegendProps {
  layer: LayerId;
  scale: ClassScale;
  values: Map<string, number>;
  /** Há freguesias sem valor nesta camada. */
  hasNoData: boolean;
}

function Swatch({ index, total }: { index: number; total: number }) {
  return (
    <span
      className="nv-swatch"
      style={{ background: `var(--nv-${rampIndex(index, total)})` }}
      aria-hidden="true"
    />
  );
}

/** Legenda por baixo do mapa: título com unidade, classes com os seus limites e «sem dados». Sempre visível, nunca sobre o mapa. */
export function MapLegend({ layer, scale, values, hasNoData }: LegendProps) {
  const info = LAYER_INFO[layer];
  const meta = LAYERS.find((l) => l.id === layer);
  const kind = meta?.kind ?? 'scale';
  const classes = useMemo(
    () => (kind === 'scale' ? legendClasses(scale, values.values(), info.format) : []),
    [kind, scale, values, info],
  );
  const max = scale.max;
  const dots = useMemo(() => {
    if (kind !== 'circles' || max <= 0) return [];
    const big = niceBreak(max);
    return [big, niceBreak(big / 4), niceBreak(big / 16)].filter(
      (v, i, a) => v > 0 && a.indexOf(v) === i,
    );
  }, [kind, max]);

  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-[13px] leading-snug">
        {info.legendTitle()}
        {meta?.estimate && <EstimateTag />}
      </p>

      {kind === 'scale' && (
        <ul className="grid grid-cols-3 gap-x-3 gap-y-2 sm:flex sm:flex-wrap sm:gap-x-5">
          {classes.map((c) => (
            <li key={c.index} className="flex items-center gap-2 text-[13px] tabular-nums">
              <Swatch index={c.index} total={classes.length} />
              {c.label}
            </li>
          ))}
          {hasNoData && (
            <li className="flex items-center gap-2 text-[13px]">
              <span className="nv-swatch nv-hatch" aria-hidden="true" />
              {m.home_map_no_data()}
            </li>
          )}
        </ul>
      )}

      {kind === 'binary' && (
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          <li className="flex items-center gap-2 text-[13px]">
            <span className="nv-swatch nv-hatch" aria-hidden="true" />
            {m.home_layer_data_gaps_yes()}
          </li>
          <li className="flex items-center gap-2 text-[13px]">
            <span className="nv-swatch" style={{ background: 'var(--nv-1)' }} aria-hidden="true" />
            {m.home_layer_data_gaps_no()}
          </li>
        </ul>
      )}

      {kind === 'circles' && (
        <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
          <ul className="flex items-end gap-4">
            {dots.map((v) => {
              const r = dotRadiusPx(v, niceBreak(max));
              return (
                <li key={v} className="flex flex-col items-center gap-1 text-[13px] tabular-nums">
                  <svg width={r * 2 + 2} height={r * 2 + 2} aria-hidden="true">
                    <circle cx={r + 1} cy={r + 1} r={r} strokeWidth={1.5} className="nv-dot" />
                  </svg>
                  {info.format(v)}
                </li>
              );
            })}
          </ul>
          <p className="max-w-xs pb-1 text-[13px] text-muted-foreground leading-snug">
            {m.home_layer_containers_legend_note()}
          </p>
        </div>
      )}

      {kind === 'scale' && !scale.discrete && scale.count > 1 && (
        <p className="text-muted-foreground text-xs leading-snug">
          {m.home_map_classes_note({ n: Math.round(values.size / scale.count) })}
        </p>
      )}
    </div>
  );
}
