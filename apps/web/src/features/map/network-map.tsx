import type { Map as MaplibreMap } from 'maplibre-gl';
import { useMemo, useState } from 'react';
import { Layer, type MapLayerMouseEvent, Source } from 'react-map-gl/maplibre';
import type { ContainerKind, ContainerOut, ContainerStatus, LocalityOut, ZoneOut } from '@/client';
import { formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { zonesToGeoJson } from '@/lib/map';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { BaseMap } from './base-map';
import { RampLegend, rampExpression } from './choropleth';
import {
  CONTAINER_KIND_COLORS,
  CONTAINER_KINDS,
  containerKindLabel,
  containerStatusLabel,
  containersToGeoJson,
} from './containers';

export type MapMetric = 'demand_t' | 'population' | 'service_days' | 'covered_pct';

interface Hovered {
  code: string;
  name: string;
}

interface HoveredContainer {
  ref: string;
  kind: ContainerKind;
  status: ContainerStatus;
  address: string;
  locality: string;
  count: number | null;
}

interface NetworkMapProps {
  zones: ZoneOut[];
  localities: LocalityOut[];
  metric: MapMetric;
  showLocalities: boolean;
  /** Contentores da camada; `null` ou vazio esconde a camada. */
  containers?: ContainerOut[] | null;
  /** Cobertura (%) por código de freguesia, para a métrica `covered_pct`. */
  coverage?: Record<string, number>;
  className?: string;
  onSelect?: (code: string | null) => void;
  selected?: string | null;
}

const CONTAINER_LAYERS = ['containers-clusters', 'containers-points'];

const kindColor = [
  'match',
  ['get', 'kind'],
  ...CONTAINER_KINDS.flatMap((k) => [k, CONTAINER_KIND_COLORS[k]]),
  CONTAINER_KIND_COLORS.other,
] as unknown as string;

export function NetworkMap({
  zones,
  localities,
  metric,
  showLocalities,
  containers,
  coverage,
  className,
  onSelect,
  selected,
}: NetworkMapProps) {
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [hoveredContainer, setHoveredContainer] = useState<HoveredContainer | null>(null);
  const extra = useMemo(
    () =>
      Object.fromEntries(Object.entries(coverage ?? {}).map(([k, v]) => [k, { covered_pct: v }])),
    [coverage],
  );
  const geojson = useMemo(() => zonesToGeoJson(zones, extra), [zones, extra]);
  const max = useMemo(() => {
    if (metric === 'covered_pct') return 100;
    if (metric === 'service_days') return 7;
    return Math.max(1, ...zones.map((z) => z[metric]));
  }, [zones, metric]);
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
  const containerData = useMemo(() => containersToGeoJson(containers ?? []), [containers]);
  const showContainers = (containers?.length ?? 0) > 0;
  const kindsPresent = useMemo(
    () => CONTAINER_KINDS.filter((k) => containers?.some((c) => c.kind === k)),
    [containers],
  );

  const onMove = (event: MapLayerMouseEvent) => {
    const features = event.features ?? [];
    const c = features.find((f) => CONTAINER_LAYERS.includes(f.layer.id));
    if (c) {
      const p = c.properties ?? {};
      setHoveredContainer({
        ref: String(p.ref ?? ''),
        kind: p.kind as ContainerKind,
        status: p.status as ContainerStatus,
        address: String(p.address ?? ''),
        locality: String(p.locality ?? ''),
        count: c.layer.id === 'containers-clusters' ? Number(p.point_count) : null,
      });
      setHovered(null);
      return;
    }
    setHoveredContainer(null);
    const f = features[0];
    setHovered(f ? { code: String(f.properties?.code), name: String(f.properties?.name) } : null);
  };

  const onClick = (event: MapLayerMouseEvent) => {
    const features = event.features ?? [];
    const cluster = features.find((f) => f.layer.id === 'containers-clusters');
    if (cluster) {
      const map: MaplibreMap = event.target;
      map.easeTo({ center: event.lngLat, zoom: map.getZoom() + 2 });
      return;
    }
    if (features.some((f) => f.layer.id === 'containers-points')) return;
    onSelect?.(features[0] ? String(features[0].properties?.code) : null);
  };

  const hoveredZone = zones.find((z) => z.code === hovered?.code);
  const hoveredCoverage = hoveredZone ? coverage?.[hoveredZone.code] : undefined;

  return (
    <div className={cn('relative', className)}>
      <BaseMap
        className="size-full"
        label={m.map_aria()}
        interactiveLayerIds={['zones-fill', ...(showContainers ? CONTAINER_LAYERS : [])]}
        onMouseMove={onMove}
        onMouseLeave={() => {
          setHovered(null);
          setHoveredContainer(null);
        }}
        onClick={onClick}
      >
        <Source id="zones" type="geojson" data={geojson}>
          <Layer
            id="zones-fill"
            type="fill"
            paint={{ 'fill-color': rampExpression(metric, max), 'fill-opacity': 0.78 }}
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
        {showContainers && (
          <Source
            id="containers"
            type="geojson"
            data={containerData}
            cluster
            clusterRadius={44}
            clusterMaxZoom={14}
          >
            <Layer
              id="containers-clusters"
              type="circle"
              filter={['has', 'point_count']}
              paint={{
                'circle-color': '#14211d',
                'circle-opacity': 0.85,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2,
                'circle-radius': ['step', ['get', 'point_count'], 11, 10, 15, 50, 20, 200, 26],
              }}
            />
            <Layer
              id="containers-points"
              type="circle"
              filter={['!', ['has', 'point_count']]}
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 16, 7],
                'circle-color': kindColor,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 1.5,
                'circle-opacity': ['match', ['get', 'status'], 'active', 1, 'planned', 0.65, 0.35],
              }}
            />
          </Source>
        )}
      </BaseMap>

      {hoveredContainer ? (
        <div className="pointer-events-none absolute top-3 left-3 max-w-60 space-y-1 rounded-lg bg-card/95 p-3 text-sm shadow-sm ring-1 ring-foreground/10 backdrop-blur">
          {hoveredContainer.count != null ? (
            <p className="font-medium font-serif text-lg leading-tight">
              {m.mapc_layer_count({ count: formatNumber(hoveredContainer.count) })}
            </p>
          ) : (
            <>
              <p className="font-medium font-serif text-lg leading-tight">{hoveredContainer.ref}</p>
              <p className="text-muted-foreground text-xs">
                {containerKindLabel[hoveredContainer.kind]()} ·{' '}
                {containerStatusLabel[hoveredContainer.status]()}
              </p>
              {(hoveredContainer.address || hoveredContainer.locality) && (
                <p className="text-muted-foreground text-xs">
                  {[hoveredContainer.address, hoveredContainer.locality].filter(Boolean).join(', ')}
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        hoveredZone && (
          <div className="pointer-events-none absolute top-3 left-3 max-w-60 space-y-1 rounded-lg bg-card/95 p-3 text-sm shadow-sm ring-1 ring-foreground/10 backdrop-blur">
            <p className="font-medium font-serif text-lg leading-tight">{hoveredZone.name}</p>
            <p className="text-muted-foreground text-xs tabular-nums">
              {m.map_tip_population({ value: formatNumber(hoveredZone.population) })} ·{' '}
              {m.map_tip_demand({ value: formatTonnes(hoveredZone.demand_t) })}
            </p>
            <p className="text-muted-foreground text-xs">
              {m.map_tip_service({ days: hoveredZone.service_days })}
            </p>
            {hoveredCoverage != null && (
              <p className="text-muted-foreground text-xs tabular-nums">
                {m.cov_map_tip_coverage({ value: formatPercent(hoveredCoverage, 0) })}
              </p>
            )}
          </div>
        )
      )}

      <div className="absolute bottom-10 left-3 flex flex-col gap-2">
        {showContainers && (
          <div
            className="rounded-lg bg-card/95 p-2.5 shadow-sm ring-1 ring-foreground/10 backdrop-blur"
            aria-hidden="true"
          >
            <p className="mb-1.5 font-medium text-[11px] leading-none">{m.mapc_legend_title()}</p>
            <ul className="space-y-1">
              {kindsPresent.map((k) => (
                <li key={k} className="flex items-center gap-2 text-[11px]">
                  <span
                    className="size-2.5 rounded-full ring-1 ring-white"
                    style={{ background: CONTAINER_KIND_COLORS[k] }}
                  />
                  {containerKindLabel[k]()}
                </li>
              ))}
            </ul>
          </div>
        )}
        <RampLegend
          title={metric === 'covered_pct' ? m.cov_map_legend_coverage() : undefined}
          maxLabel={
            metric === 'demand_t'
              ? formatTonnes(max, 0)
              : metric === 'covered_pct'
                ? formatPercent(max, 0)
                : formatNumber(max)
          }
        />
      </div>
    </div>
  );
}
