import { useMemo, useState } from 'react';
import { Layer, type MapLayerMouseEvent, Source } from 'react-map-gl/maplibre';
import type { ZoneOut } from '@/client';
import { BaseMap } from '@/features/map/base-map';
import { RampLegend, rampExpression } from '@/features/map/choropleth';
import { formatNumber, formatPercent } from '@/lib/format';
import { zonesToGeoJson } from '@/lib/map';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import type { ParishRow } from './rows';

export type CoverageMetric = 'covered_pct' | 'population';

interface CoverageMapProps {
  zones: ZoneOut[];
  rows: ParishRow[];
  metric: CoverageMetric;
  className?: string;
}

/** Mapa coroplético por freguesia: cobertura (%) quando há contentores, população enquanto não há. */
export function CoverageMap({ zones, rows, metric, className }: CoverageMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  // A cobertura de cada freguesia, como texto: o GeoJSON só se reconstrói (e o mapa só reprocessa as geometrias)
  // quando um valor muda, não a cada resposta nova da API com os mesmos números.
  const coverageKey = rows.map((r) => `${r.code}:${r.coverage?.covered_pct ?? 0}`).join('|');
  // biome-ignore lint/correctness/useExhaustiveDependencies: `coverageKey` representa os valores de `rows`
  const geojson = useMemo(
    () =>
      zonesToGeoJson(
        zones,
        Object.fromEntries(
          rows.map((r) => [r.code, { covered_pct: r.coverage?.covered_pct ?? 0 }]),
        ),
      ),
    [zones, coverageKey],
  );
  const max = useMemo(
    () => (metric === 'covered_pct' ? 100 : Math.max(1, ...zones.map((z) => z.population))),
    [zones, metric],
  );
  const row = rows.find((r) => r.code === hovered);

  const onMove = (event: MapLayerMouseEvent) => {
    const code = event.features?.[0]?.properties?.code;
    setHovered(code ? String(code) : null);
  };

  return (
    <div className={cn('relative', className)}>
      <BaseMap
        className="size-full"
        label={m.cov_map_aria()}
        interactiveLayerIds={['cov-fill']}
        onMouseMove={onMove}
        onMouseLeave={() => setHovered(null)}
      >
        <Source id="cov-zones" type="geojson" data={geojson}>
          <Layer
            id="cov-fill"
            type="fill"
            paint={{ 'fill-color': rampExpression(metric, max), 'fill-opacity': 0.82 }}
          />
          <Layer
            id="cov-line"
            type="line"
            paint={{ 'line-color': '#14211d', 'line-opacity': 0.35, 'line-width': 0.8 }}
          />
          <Layer
            id="cov-hover"
            type="line"
            filter={['==', ['get', 'code'], hovered ?? '']}
            paint={{ 'line-color': '#14211d', 'line-width': 2.5 }}
          />
        </Source>
      </BaseMap>

      {row && (
        <div className="pointer-events-none absolute top-3 left-3 max-w-60 space-y-1 rounded-lg bg-card/95 p-3 text-sm shadow-sm ring-1 ring-foreground/10 backdrop-blur">
          <p className="font-medium font-serif text-lg leading-tight">{row.name}</p>
          <p className="text-muted-foreground text-xs tabular-nums">
            {m.cov_map_tip_population({ value: formatNumber(row.population) })}
            {row.coverage &&
              ` · ${m.cov_map_tip_coverage({ value: formatPercent(row.coverage.covered_pct, 0) })}`}
          </p>
        </div>
      )}

      <RampLegend
        className="absolute bottom-10 left-3"
        title={
          metric === 'covered_pct' ? m.cov_map_legend_coverage() : m.cov_map_legend_population()
        }
        maxLabel={metric === 'covered_pct' ? formatPercent(100, 0) : formatNumber(max)}
      />
    </div>
  );
}
