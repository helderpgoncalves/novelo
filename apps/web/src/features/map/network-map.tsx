import type { ExpressionSpecification } from 'maplibre-gl';
import { useMemo, useState } from 'react';
import { Layer, type MapLayerMouseEvent, Source } from 'react-map-gl/maplibre';
import type { LocalityOut, ZoneOut } from '@/client';
import { formatNumber, formatTonnes } from '@/lib/format';
import { zonesToGeoJson } from '@/lib/map';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { BaseMap } from './base-map';

export type MapMetric = 'demand_t' | 'population' | 'service_days';

const RAMP = ['#efe9dc', '#cfe0d6', '#9fc4b2', '#5f9a82', '#2e6b57'];

function ramp(metric: MapMetric, max: number): ExpressionSpecification {
  const stops = RAMP.flatMap((color, i) => [(max * i) / (RAMP.length - 1), color]);
  return [
    'interpolate',
    ['linear'],
    ['coalesce', ['get', metric], 0],
    ...stops,
  ] as ExpressionSpecification;
}

interface Hovered {
  code: string;
  name: string;
}

interface NetworkMapProps {
  zones: ZoneOut[];
  localities: LocalityOut[];
  metric: MapMetric;
  showLocalities: boolean;
  className?: string;
  onSelect?: (code: string | null) => void;
  selected?: string | null;
}

export function NetworkMap({
  zones,
  localities,
  metric,
  showLocalities,
  className,
  onSelect,
  selected,
}: NetworkMapProps) {
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const geojson = useMemo(() => zonesToGeoJson(zones), [zones]);
  const max = useMemo(
    () => Math.max(1, ...zones.map((z) => (metric === 'service_days' ? 7 : z[metric]))),
    [zones, metric],
  );
  const points = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: localities
        .filter((l) => l.latitude != null && l.longitude != null)
        .map((l) => ({
          type: 'Feature' as const,
          properties: { name: l.name, days: l.days_per_week },
          geometry: {
            type: 'Point' as const,
            coordinates: [l.longitude as number, l.latitude as number],
          },
        })),
    }),
    [localities],
  );

  const onMove = (event: MapLayerMouseEvent) => {
    const f = event.features?.[0];
    setHovered(f ? { code: String(f.properties?.code), name: String(f.properties?.name) } : null);
  };
  const hoveredZone = zones.find((z) => z.code === hovered?.code);

  return (
    <div className={cn('relative', className)}>
      <BaseMap
        className="size-full"
        label={m.map_aria()}
        interactiveLayerIds={['zones-fill']}
        onMouseMove={onMove}
        onMouseLeave={() => setHovered(null)}
        onClick={(e) => onSelect?.(e.features?.[0] ? String(e.features[0].properties?.code) : null)}
      >
        <Source id="zones" type="geojson" data={geojson}>
          <Layer
            id="zones-fill"
            type="fill"
            paint={{ 'fill-color': ramp(metric, max), 'fill-opacity': 0.78 }}
          />
          <Layer
            id="zones-line"
            type="line"
            paint={{ 'line-color': '#14211d', 'line-opacity': 0.35, 'line-width': 0.8 }}
          />
          <Layer
            id="zones-selected"
            type="line"
            filter={['==', ['get', 'code'], selected ?? '']}
            paint={{ 'line-color': '#14211d', 'line-width': 2.5 }}
          />
        </Source>
        {showLocalities && (
          <Source id="localities" type="geojson" data={points}>
            <Layer
              id="localities-circle"
              type="circle"
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['get', 'days'], 0, 3, 7, 7],
                'circle-color': '#c4a06a',
                'circle-stroke-color': '#14211d',
                'circle-stroke-width': 1,
                'circle-opacity': 0.9,
              }}
            />
          </Source>
        )}
      </BaseMap>

      {hoveredZone && (
        <div className="pointer-events-none absolute top-3 left-3 max-w-60 space-y-1 rounded-lg bg-card/95 p-3 text-sm shadow-sm ring-1 ring-foreground/10 backdrop-blur">
          <p className="font-medium font-serif text-lg leading-tight">{hoveredZone.name}</p>
          <p className="text-muted-foreground text-xs tabular-nums">
            {m.map_tip_population({ value: formatNumber(hoveredZone.population) })} ·{' '}
            {m.map_tip_demand({ value: formatTonnes(hoveredZone.demand_t) })}
          </p>
          <p className="text-muted-foreground text-xs">
            {m.map_tip_service({ days: hoveredZone.service_days })}
          </p>
        </div>
      )}

      <div
        className="absolute bottom-8 left-3 rounded-lg bg-card/95 p-2.5 shadow-sm ring-1 ring-foreground/10 backdrop-blur"
        aria-hidden="true"
      >
        <div
          className="h-2 w-40 rounded-full"
          style={{ background: `linear-gradient(90deg, ${RAMP.join(', ')})` }}
        />
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
          <span>0</span>
          <span>{metric === 'demand_t' ? formatTonnes(max, 0) : formatNumber(max)}</span>
        </div>
      </div>
    </div>
  );
}
