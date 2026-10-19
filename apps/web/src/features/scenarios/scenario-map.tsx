import type { ExpressionSpecification } from 'maplibre-gl';
import { useMemo, useState } from 'react';
import { Layer, type MapLayerMouseEvent, Marker, Source } from 'react-map-gl/maplibre';
import type { RouteOut, ScenarioResult, ZoneOut } from '@/client';
import { BaseMap } from '@/features/map/base-map';
import { formatEur, formatTonnes } from '@/lib/format';
import { MODE_COLORS, NO_MODE_COLOR, zonesToGeoJson } from '@/lib/map';
import { modeLabel } from '@/lib/scenario';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

interface ScenarioMapProps {
  zones: ZoneOut[];
  result: ScenarioResult;
  showRoutes: boolean;
  className?: string;
}

const ROUTE_SHADES = ['#14211d', '#5e6b66', '#8a6a2f', '#1f4a3c', '#7c5a7a', '#3a5f8a'];

const modeColorExpr: ExpressionSpecification = [
  'match',
  ['get', 'mode'],
  'street',
  MODE_COLORS.street,
  'existing',
  MODE_COLORS.existing,
  'on_demand',
  MODE_COLORS.on_demand,
  NO_MODE_COLOR,
];

function routeGeoJson(routes: RouteOut[]) {
  return {
    type: 'FeatureCollection' as const,
    features: routes.map((r, i) => ({
      type: 'Feature' as const,
      properties: { vehicle: r.vehicle, color: ROUTE_SHADES[i % ROUTE_SHADES.length] },
      geometry: {
        type: 'LineString' as const,
        coordinates: r.path.map(([lat, lon]) => [lon as number, lat as number]),
      },
    })),
  };
}

export function ScenarioMap({ zones, result, showRoutes, className }: ScenarioMapProps) {
  const [hoverCode, setHoverCode] = useState<string | null>(null);
  const extra = useMemo(
    () =>
      Object.fromEntries(
        result.allocations.map((a) => [a.parish_code, { mode: a.mode ?? 'none' }]),
      ),
    [result.allocations],
  );
  const geojson = useMemo(() => zonesToGeoJson(zones, extra), [zones, extra]);
  const routes = useMemo(() => routeGeoJson(result.routes), [result.routes]);
  const hovered = result.allocations.find((a) => a.parish_code === hoverCode);

  return (
    <div className={cn('relative', className)}>
      <BaseMap
        className="size-full"
        label={m.scenario_map_aria()}
        interactiveLayerIds={['alloc-fill']}
        onMouseMove={(e: MapLayerMouseEvent) =>
          setHoverCode(e.features?.[0] ? String(e.features[0].properties?.code) : null)
        }
        onMouseLeave={() => setHoverCode(null)}
      >
        <Source id="alloc" type="geojson" data={geojson}>
          <Layer
            id="alloc-fill"
            type="fill"
            paint={{
              'fill-color': modeColorExpr,
              'fill-opacity': ['case', ['==', ['get', 'mode'], 'none'], 0.35, 0.8],
            }}
          />
          <Layer
            id="alloc-line"
            type="line"
            paint={{ 'line-color': '#14211d', 'line-opacity': 0.35, 'line-width': 0.8 }}
          />
        </Source>
        {showRoutes && (
          <Source id="routes" type="geojson" data={routes}>
            <Layer
              id="routes-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': ['get', 'color'],
                'line-width': 2.5,
                'line-dasharray': [2, 1.5],
              }}
            />
          </Source>
        )}
        <Marker
          longitude={result.depot[1] as number}
          latitude={result.depot[0] as number}
          anchor="bottom"
        >
          <div className="rounded-md bg-foreground px-2 py-1 font-semibold text-[10px] text-background uppercase tracking-wider shadow">
            {m.scenario_depot()}
          </div>
        </Marker>
      </BaseMap>

      {hovered && (
        <div className="pointer-events-none absolute top-3 left-3 max-w-64 space-y-1 rounded-lg bg-card/95 p-3 text-sm shadow-sm ring-1 ring-foreground/10 backdrop-blur">
          <p className="font-medium font-serif text-lg leading-tight">{hovered.parish_name}</p>
          <p className="text-muted-foreground text-xs">
            {hovered.mode ? modeLabel[hovered.mode]() : m.mode_none()}
          </p>
          {hovered.mode && (
            <p className="text-muted-foreground text-xs tabular-nums">
              {formatTonnes(hovered.tonnes)} · {formatEur(hovered.annual_cost_eur)}/
              {m.unit_year_short()} · {m.scenario_points({ count: hovered.points })}
            </p>
          )}
        </div>
      )}

      <ul
        className="absolute bottom-8 left-3 space-y-1 rounded-lg bg-card/95 p-2.5 text-xs shadow-sm ring-1 ring-foreground/10 backdrop-blur"
        aria-label={m.scenario_legend()}
      >
        {(['street', 'existing', 'on_demand'] as const).map((mode) => (
          <li key={mode} className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: MODE_COLORS[mode] }}
              aria-hidden="true"
            />
            {modeLabel[mode]()}
          </li>
        ))}
        <li className="flex items-center gap-2 text-muted-foreground">
          <span
            className="size-2.5 rounded-sm"
            style={{ background: NO_MODE_COLOR }}
            aria-hidden="true"
          />
          {m.mode_none()}
        </li>
      </ul>
    </div>
  );
}
