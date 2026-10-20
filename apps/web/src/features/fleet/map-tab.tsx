import { useEffect, useMemo, useRef, useState } from 'react';
import { Layer, type MapLayerMouseEvent, Source, useMap } from 'react-map-gl/maplibre';
import type { CircuitOut, LocalityOut, Typology } from '@/client';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { BaseMap } from '@/features/map/base-map';
import { formatNumber } from '@/lib/format';
import { formatList } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { FilterBar } from './filter-bar';
import {
  CLEAR_FILTERS,
  type FleetSearch,
  filtersFromSearch,
  searchFromFilters,
} from './fleet-search';
import {
  compareCircuit,
  filterOccurrences,
  hasFilters,
  localitiesWithoutVehicle,
  routeOrder,
  TYPOLOGIES,
} from './schedule';
import { TYPOLOGY_HEX, TypologyLegend, TypologyMark } from './typology-style';
import type { FleetModel } from './use-fleet-model';

interface Point {
  locality: LocalityOut;
  lng: number;
  lat: number;
  served: string[];
  dominant: Typology | null;
  noVehicle: boolean;
}

/** Tipologia que mais circuitos tem na localidade (desempata pela ordem da legenda). */
function dominantOf(codes: string[], circuits: Map<string, CircuitOut>): Typology | null {
  const counts = new Map<Typology, number>();
  for (const c of codes) {
    const t = circuits.get(c)?.typology;
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  let best: Typology | null = null;
  for (const t of TYPOLOGIES) {
    if ((counts.get(t) ?? 0) > (best ? (counts.get(best) ?? 0) : 0)) best = t;
  }
  return best;
}

function FitBounds({ points, signature }: { points: Point[]; signature: string }) {
  const { current: map } = useMap();
  const last = useRef('');
  useEffect(() => {
    if (!map || points.length === 0 || last.current === signature) return;
    last.current = signature;
    const lngs = points.map((p) => p.lng);
    const lats = points.map((p) => p.lat);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 48, maxZoom: 12.5, duration: 600 },
    );
  }, [map, points, signature]);
  return null;
}

function FlyTo({ target }: { target: { lng: number; lat: number; key: number } | null }) {
  const { current: map } = useMap();
  useEffect(() => {
    if (map && target)
      map.flyTo({
        center: [target.lng, target.lat],
        zoom: Math.max(map.getZoom(), 13),
        duration: 700,
      });
  }, [map, target]);
  return null;
}

interface MapTabProps {
  model: FleetModel;
  localities: LocalityOut[];
  search: FleetSearch;
  update: (patch: Partial<FleetSearch>) => void;
}

export function MapTab({ model, localities, search, update }: MapTabProps) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const filters = useMemo(() => filtersFromSearch(search), [search]);
  const filtered = hasFilters(filters);
  const [hovered, setHovered] = useState<Point | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [fly, setFly] = useState<{ lng: number; lat: number; key: number } | null>(null);

  const occs = useMemo(
    () => filterOccurrences(model.occs, filters, model.circuits),
    [model.occs, model.circuits, filters],
  );
  const activeCircuits = useMemo(() => new Set(occs.map((o) => o.circuit)), [occs]);
  const noVehicle = useMemo(
    () => new Set(localitiesWithoutVehicle(localities, model.circuits).map((l) => l.name)),
    [localities, model.circuits],
  );

  const withCoords = useMemo(
    () => localities.filter((l) => l.latitude != null && l.longitude != null),
    [localities],
  );
  const points: Point[] = useMemo(
    () =>
      withCoords.map((l) => {
        const served = l.circuits.filter((c) => activeCircuits.has(c)).sort(compareCircuit);
        return {
          locality: l,
          lng: l.longitude as number,
          lat: l.latitude as number,
          served,
          dominant: dominantOf(served, model.circuitMap),
          noVehicle: noVehicle.has(l.name),
        };
      }),
    [withCoords, activeCircuits, model.circuitMap, noVehicle],
  );
  const noVehicleCount = points.filter((p) => p.noVehicle).length;
  const servedPoints = points.filter((p) => p.served.length > 0);
  const missingCoords = localities.length - withCoords.length;

  const vehicle = search.plate ? model.vehicleMap.get(search.plate) : undefined;
  // Ordem do percurso da Vitrus: circuito a circuito (pela ordem do planeamento) e, em cada um, como vêm da API.
  const routeRank = useMemo(() => {
    const codes = [...new Set(occs.map((o) => o.circuit))];
    return new Map(routeOrder(codes, model.circuitMap).map((name, i) => [name, i]));
  }, [occs, model.circuitMap]);
  const ordered = Boolean(search.plate || search.circuit);
  const vehicleChain = useMemo(
    () =>
      search.plate
        ? [...servedPoints]
            .filter((p) => routeRank.has(p.locality.name))
            .sort(
              (a, b) =>
                (routeRank.get(a.locality.name) ?? 0) - (routeRank.get(b.locality.name) ?? 0),
            )
        : [],
    [search.plate, servedPoints, routeRank],
  );

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: points.map((p) => ({
        type: 'Feature' as const,
        properties: {
          name: p.locality.name,
          n: p.served.length,
          served: p.served.length > 0,
          noVehicle: p.noVehicle,
          picked: p.locality.name === picked,
          color: p.dominant ? TYPOLOGY_HEX[p.dominant][dark ? 'dark' : 'light'] : '#8a8577',
        },
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      })),
    }),
    [points, dark, picked],
  );
  const line = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features:
        vehicleChain.length > 1
          ? [
              {
                type: 'Feature' as const,
                properties: {},
                geometry: {
                  type: 'LineString' as const,
                  coordinates: vehicleChain.map((p) => [p.lng, p.lat]),
                },
              },
            ]
          : [],
    }),
    [vehicleChain],
  );

  const presentTypologies = TYPOLOGIES.filter((t) => points.some((p) => p.dominant === t));
  const signature = `${servedPoints.map((p) => p.locality.name).join('|')}`;

  const onMove = (event: MapLayerMouseEvent) => {
    const name = event.features?.[0]?.properties?.name;
    setHovered(points.find((p) => p.locality.name === name) ?? null);
  };
  const onClick = (event: MapLayerMouseEvent) => {
    const name = event.features?.[0]?.properties?.name;
    setPicked(typeof name === 'string' ? name : null);
  };
  const pick = (p: Point) => {
    setPicked(p.locality.name);
    setFly({ lng: p.lng, lat: p.lat, key: Date.now() });
  };

  const listed = [...points].sort(
    (a, b) =>
      Number(b.served.length > 0) - Number(a.served.length > 0) ||
      (ordered
        ? (routeRank.get(a.locality.name) ?? Number.MAX_SAFE_INTEGER) -
          (routeRank.get(b.locality.name) ?? Number.MAX_SAFE_INTEGER)
        : 0) ||
      a.locality.name.localeCompare(b.locality.name, 'pt'),
  );
  const noCircuitLocalities = model.circuits.filter((c) => c.localities.length === 0).length;
  const clear = () => {
    setPicked(null);
    update(CLEAR_FILTERS);
  };

  if (withCoords.length === 0) {
    return <EmptyState title={m.fl_map_empty_title()} description={m.fl_map_empty_text()} />;
  }

  return (
    <div className="space-y-3">
      <FilterBar
        filters={filters}
        withTime
        onChange={(patch) => update(searchFromFilters(patch))}
        onClear={clear}
        plates={model.plates}
        circuits={model.circuits.map((c) => c.code)}
        localities={model.localityNames}
        typologies={TYPOLOGIES.filter((t) => model.occs.some((o) => o.typology === t))}
      />
      <p className="max-w-4xl text-muted-foreground text-xs leading-relaxed">{m.fl_map_notice()}</p>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="relative h-[26rem] overflow-hidden rounded-xl ring-1 ring-foreground/10 sm:h-[34rem] lg:h-[38rem]">
          <BaseMap
            className="size-full"
            label={m.fl_map_aria()}
            interactiveLayerIds={['fl-points']}
            onMouseMove={onMove}
            onMouseLeave={() => setHovered(null)}
            onClick={onClick}
          >
            <FitBounds points={servedPoints} signature={signature} />
            <FlyTo target={fly} />
            <Source id="fl-line" type="geojson" data={line}>
              <Layer
                id="fl-line"
                type="line"
                paint={{
                  'line-color': dark ? '#f1eee6' : '#14211d',
                  'line-width': 2,
                  'line-dasharray': [2, 2],
                  'line-opacity': 0.75,
                }}
              />
            </Source>
            <Source id="fl-points" type="geojson" data={geojson}>
              <Layer
                id="fl-novehicle"
                type="circle"
                filter={['==', ['get', 'noVehicle'], true]}
                paint={{
                  'circle-radius': 11,
                  'circle-color': 'rgba(0,0,0,0)',
                  'circle-stroke-color': dark ? '#e0906f' : '#a4553a',
                  'circle-stroke-width': 2.5,
                }}
              />
              <Layer
                id="fl-points"
                type="circle"
                paint={{
                  'circle-radius': ['+', 6, ['*', 1.5, ['min', ['get', 'n'], 6]]],
                  'circle-color': ['get', 'color'],
                  'circle-opacity': ['case', ['get', 'served'], 0.92, 0.22],
                  'circle-stroke-color': dark ? '#0f1815' : '#ffffff',
                  'circle-stroke-width': ['case', ['get', 'picked'], 3, 1.5],
                }}
              />
              <Layer
                id="fl-picked"
                type="circle"
                filter={['==', ['get', 'picked'], true]}
                paint={{
                  'circle-radius': 15,
                  'circle-color': 'rgba(0,0,0,0)',
                  'circle-stroke-color': dark ? '#7fb39c' : '#2e6b57',
                  'circle-stroke-width': 3,
                }}
              />
            </Source>
          </BaseMap>
          {search.plate && vehicleChain.length > 1 && (
            <p className="pointer-events-none absolute bottom-8 left-3 max-w-[16rem] rounded-md bg-background/90 px-2.5 py-1.5 text-xs shadow-sm ring-1 ring-foreground/10">
              <span className="mr-2 inline-block h-0 w-5 border-foreground/70 border-t-2 border-dashed align-middle" />
              {m.fl_map_line_note()}
            </p>
          )}
          {hovered && (
            <div className="pointer-events-none absolute top-3 left-3 max-w-[16rem] rounded-lg bg-popover p-2.5 text-popover-foreground text-xs shadow-md ring-1 ring-foreground/10">
              <p className="font-semibold text-sm">{hovered.locality.name}</p>
              <p className="text-muted-foreground">
                {hovered.served.length
                  ? m.fl_map_tip_circuits({ circuits: formatList(hovered.served) })
                  : m.fl_map_tip_none()}
              </p>
              {hovered.noVehicle && (
                <p className="mt-1 font-medium text-[var(--fleet-warn)]">{m.fl_map_no_vehicle()}</p>
              )}
            </div>
          )}
          {servedPoints.length === 0 && (
            <div className="absolute inset-0 grid place-items-center bg-background/60 p-4 backdrop-blur-[1px]">
              <EmptyState
                title={m.fl_no_results()}
                description={m.fl_map_nothing_text()}
                action={
                  <Button variant="outline" className="h-10" onClick={clear}>
                    {m.fl_filters_clear()}
                  </Button>
                }
              />
            </div>
          )}
        </div>

        <aside
          aria-label={m.fl_map_panel()}
          className="flex max-h-[28rem] min-h-0 flex-col rounded-xl bg-card ring-1 ring-foreground/10 lg:max-h-[38rem]"
        >
          <div className="space-y-1.5 border-b p-3">
            {vehicle ? (
              <>
                <p className="font-semibold text-sm tabular-nums">{vehicle.plate}</p>
                <p className="text-muted-foreground text-xs">
                  {m.fl_map_vehicle_summary({
                    circuits: formatNumber(new Set(occs.map((o) => o.circuit)).size),
                    localities: formatNumber(servedPoints.length),
                  })}
                </p>
                <p className="text-muted-foreground text-xs">{m.fl_map_order_route()}</p>
              </>
            ) : (
              <p className="text-sm">
                {m.fl_map_summary({
                  served: formatNumber(servedPoints.length),
                  total: formatNumber(points.length),
                })}
                {filtered ? ` · ${m.fl_filtered()}` : ''}
                {!vehicle && ordered ? ` · ${m.fl_map_order_route()}` : ''}
              </p>
            )}
            {noVehicleCount > 0 && (
              <p className="flex items-center gap-1.5 text-xs">
                <span className="inline-block size-3 rounded-full border-2 border-[var(--fleet-warn)]" />
                {m.fl_map_no_vehicle_count({ count: formatNumber(noVehicleCount) })}
              </p>
            )}
          </div>
          <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
            {listed.map((p) => (
              <li key={p.locality.name}>
                <button
                  type="button"
                  onClick={() => pick(p)}
                  aria-pressed={picked === p.locality.name}
                  className={cn(
                    'flex min-h-11 w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left transition-colors hover:bg-muted/50',
                    picked === p.locality.name && 'bg-primary/10',
                    p.served.length === 0 && 'opacity-55',
                  )}
                >
                  <span className="flex w-full items-center gap-1.5 text-sm">
                    {p.dominant ? (
                      <TypologyMark typology={p.dominant} />
                    ) : (
                      <TypologyMark typology="unassigned" />
                    )}
                    <span className="truncate font-medium">{p.locality.name}</span>
                    {p.noVehicle && (
                      <span className="ml-auto shrink-0 rounded-full border border-[var(--fleet-warn)] px-1.5 font-semibold text-[9px] text-[var(--fleet-warn)] uppercase tracking-wider">
                        {m.fl_map_no_vehicle_badge()}
                      </span>
                    )}
                  </span>
                  <span className="truncate text-muted-foreground text-xs">
                    {p.served.length
                      ? p.served.join(' · ')
                      : filtered
                        ? m.fl_map_outside_filter()
                        : p.locality.circuits.join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5">
        <TypologyLegend only={presentTypologies} />
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-full border-2 border-[var(--fleet-warn)]" />
            {m.fl_map_legend_no_vehicle()}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-full bg-muted-foreground/25" />
            {m.fl_map_legend_outside()}
          </li>
          <li>{m.fl_map_legend_size()}</li>
        </ul>
      </div>
      <p className="text-muted-foreground text-xs">
        {m.fl_map_limits({
          missing: formatNumber(missingCoords),
          nocircuit: formatNumber(noCircuitLocalities),
        })}
      </p>
    </div>
  );
}
