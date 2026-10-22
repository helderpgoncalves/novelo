import { ChevronDown } from 'lucide-react';
import type { ExpressionSpecification } from 'maplibre-gl';
import { useId, useMemo, useState } from 'react';
import { Layer, type MapLayerMouseEvent, Marker, Source } from 'react-map-gl/maplibre';
import type { RouteOut, ScenarioResult, SiteSelection, ZoneOut } from '@/client';
import { BaseMap } from '@/features/map/base-map';
import { formatEur, formatNumber, formatTonnes } from '@/lib/format';
import { MODE_COLORS, NO_MODE_COLOR, zonesToGeoJson } from '@/lib/map';
import { ALL_MODES, modeLabel } from '@/lib/scenario';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { doorToDoorByParish, planWeekday } from './collection-plan';

interface ScenarioMapProps {
  zones: ZoneOut[];
  result: ScenarioResult;
  showRoutes: boolean;
  className?: string;
}

// Tons das rotas e cor de "tinta" por tema: no mapa escuro, a tinta (#14211d) desapareceria no fundo.
const ROUTE_SHADES = {
  light: ['#14211d', '#5e6b66', '#8a6a2f', '#1f4a3c', '#7c5a7a', '#3a5f8a'],
  dark: ['#f4f1ea', '#b8b2a4', '#d9b77a', '#9fd0b9', '#d2aecf', '#9dbde3'],
} as const;
const INK = { light: '#14211d', dark: '#f4f1ea' } as const;

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

function routeGeoJson(routes: RouteOut[], shades: readonly string[]) {
  return {
    type: 'FeatureCollection' as const,
    features: routes.map((r, i) => ({
      type: 'Feature' as const,
      properties: { vehicle: r.vehicle, color: shades[i % shades.length] },
      geometry: {
        type: 'LineString' as const,
        coordinates: r.path.map(([lat, lon]) => [lon as number, lat as number]),
      },
    })),
  };
}

// Os locais reais desenham-se a verde floresta, a mesma cor que o contentor de rua (referência) já usava.
const SITE_COLOR = MODE_COLORS.street;
// Escolas (pontos assistidos): areia com contorno de tinta, para se distinguirem dos locais públicos.
const STAFFED_FILL = '#c4a06a';

// Cenários antigos, sem `default_modes`: a legenda mostra os modos oferecidos e os que o resultado usa.
const MODES_SHOWN = ALL_MODES.filter((mode) => mode !== 'street');

/** Círculo geodésico aproximado (polígono de 48 lados) com o raio em metros, para o raio a pé de cada local. */
function circlePolygon(lat: number, lon: number, radiusM: number): number[][] {
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  const ring = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * 2 * Math.PI;
    return [lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)];
  });
  return [...ring, ring[0] as number[]];
}

function sitesGeoJson(sites: SiteSelection[], radiusM: number) {
  return {
    points: {
      type: 'FeatureCollection' as const,
      features: sites.map((s) => ({
        type: 'Feature' as const,
        properties: { id: s.site_id, precision: s.coord_precision, kind: s.kind ?? 'public' },
        geometry: { type: 'Point' as const, coordinates: [s.longitude, s.latitude] },
      })),
    },
    coverage: {
      type: 'FeatureCollection' as const,
      features: sites.map((s) => ({
        type: 'Feature' as const,
        properties: { id: s.site_id },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [circlePolygon(s.latitude, s.longitude, radiusM)],
        },
      })),
    },
  };
}

export function ScenarioMap({ zones, result, showRoutes, className }: ScenarioMapProps) {
  const [hoverCode, setHoverCode] = useState<string | null>(null);
  const [hoverSite, setHoverSite] = useState<string | null>(null);
  const [pinnedSite, setPinnedSite] = useState<string | null>(null);
  // Legenda fechada em ecrãs estreitos para não tapar os locais.
  const [legendOpen, setLegendOpen] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches,
  );
  const legendId = useId();
  const sites = result.sites ?? [];
  const siting = result.siting;
  const bySites = Boolean(siting) && sites.length > 0;
  const pap = useMemo(() => doorToDoorByParish(result.collection_plan), [result.collection_plan]);
  const hasStaffed = sites.some((s) => s.kind === 'staffed');
  const extra = useMemo(
    () =>
      Object.fromEntries(
        result.allocations.map((a) => [
          a.parish_code,
          { mode: a.mode ?? 'none', pap: pap.has(a.parish_code) },
        ]),
      ),
    [result.allocations, pap],
  );
  const geojson = useMemo(() => zonesToGeoJson(zones, extra), [zones, extra]);
  const { resolvedTheme } = useTheme();
  const tone = resolvedTheme === 'dark' ? 'dark' : 'light';
  // Freguesias no circuito porta a porta (contorno grosso) e contorno das escolas: a tinta do tema.
  const ink = INK[tone];
  const routes = useMemo(
    () => routeGeoJson(result.routes, ROUTE_SHADES[tone]),
    [result.routes, tone],
  );
  const siteLayers = useMemo(
    () => (siting ? sitesGeoJson(result.sites ?? [], siting.radius_m) : null),
    [siting, result.sites],
  );
  const hovered = bySites ? undefined : result.allocations.find((a) => a.parish_code === hoverCode);
  const hoveredPap = hovered ? pap.get(hovered.parish_code) : undefined;
  const activeSite = bySites
    ? sites.find((s) => s.site_id === (pinnedSite ?? hoverSite))
    : undefined;
  // O "zoom" só pode ser a entrada de um interpolate de topo: o realce do local ativo fica em cada paragem.
  const stop = (radius: number): ExpressionSpecification => [
    'case',
    ['==', ['get', 'id'], activeSite?.site_id ?? ''],
    8,
    radius,
  ];
  const siteRadius: ExpressionSpecification = [
    'interpolate',
    ['linear'],
    ['zoom'],
    10,
    stop(2.5),
    13,
    stop(4.5),
    16,
    stop(6.5),
  ];

  return (
    <div className={cn('relative', className)}>
      <BaseMap
        className="size-full"
        label={m.scenario_map_aria()}
        interactiveLayerIds={bySites ? ['sites-points'] : ['alloc-fill']}
        onMouseMove={(e: MapLayerMouseEvent) => {
          const feature = e.features?.[0];
          if (bySites) setHoverSite(feature ? String(feature.properties?.id) : null);
          else setHoverCode(feature ? String(feature.properties?.code) : null);
        }}
        onMouseLeave={() => {
          setHoverCode(null);
          setHoverSite(null);
        }}
        onClick={(e: MapLayerMouseEvent) => {
          if (!bySites) return;
          const feature = e.features?.[0];
          setPinnedSite(feature ? String(feature.properties?.id) : null);
        }}
      >
        <Source id="alloc" type="geojson" data={geojson}>
          <Layer
            id="alloc-fill"
            type="fill"
            paint={{
              'fill-color': bySites
                ? ['case', ['==', ['get', 'mode'], 'none'], NO_MODE_COLOR, SITE_COLOR]
                : modeColorExpr,
              'fill-opacity': bySites
                ? ['case', ['==', ['get', 'mode'], 'none'], 0.3, 0.05]
                : ['case', ['==', ['get', 'mode'], 'none'], 0.35, 0.8],
            }}
          />
          <Layer
            id="alloc-line"
            type="line"
            paint={{ 'line-color': ink, 'line-opacity': 0.35, 'line-width': 0.8 }}
          />
          {pap.size > 0 && (
            <Layer
              id="alloc-pap"
              type="line"
              filter={['==', ['get', 'pap'], true]}
              paint={{ 'line-color': ink, 'line-opacity': 0.9, 'line-width': 2.4 }}
            />
          )}
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
        {bySites && siteLayers && (
          <>
            <Source id="site-coverage" type="geojson" data={siteLayers.coverage}>
              <Layer
                id="site-coverage-fill"
                type="fill"
                paint={{ 'fill-color': SITE_COLOR, 'fill-opacity': 0.12 }}
              />
              <Layer
                id="site-coverage-line"
                type="line"
                paint={{ 'line-color': SITE_COLOR, 'line-opacity': 0.75, 'line-width': 1.2 }}
              />
            </Source>
            <Source id="sites" type="geojson" data={siteLayers.points}>
              <Layer
                id="sites-points"
                type="circle"
                paint={{
                  // Menores ao afastar o zoom, para continuarem legíveis com centenas de locais.
                  'circle-radius': siteRadius,
                  'circle-color': [
                    'case',
                    ['==', ['get', 'kind'], 'staffed'],
                    STAFFED_FILL,
                    ['==', ['get', 'precision'], 'approximate'],
                    '#ffffff',
                    SITE_COLOR,
                  ],
                  'circle-stroke-color': [
                    'case',
                    ['==', ['get', 'kind'], 'staffed'],
                    ink,
                    SITE_COLOR,
                  ],
                  'circle-stroke-width': ['case', ['==', ['get', 'kind'], 'staffed'], 2.5, 2],
                }}
              />
            </Source>
          </>
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
          {hoveredPap?.circuit && (
            <p className="font-medium text-primary text-xs">
              {m.plan_map_tooltip({
                circuit: hoveredPap.circuit,
                day: planWeekday(hoveredPap.weekday) ?? '',
              })}
            </p>
          )}
        </div>
      )}

      {activeSite && (
        <div
          className={cn(
            'absolute top-3 left-3 max-w-64 space-y-1 rounded-lg bg-card/95 p-3 text-sm shadow-sm ring-1 ring-foreground/10 backdrop-blur',
            !pinnedSite && 'pointer-events-none',
          )}
        >
          <p className="font-medium font-serif text-lg leading-tight">
            {activeSite.street ?? m.site_street_unknown()}
          </p>
          <p className="text-muted-foreground text-xs">
            {activeSite.kind === 'staffed' && `${m.site_kind_staffed()} · `}
            {activeSite.parish_name}
            {activeSite.coord_precision === 'approximate' &&
              ` · ${m.site_precision_approximate().toLowerCase()}`}
          </p>
          <p className="text-muted-foreground text-xs tabular-nums">
            {m.site_map_tooltip({
              containers: formatNumber(activeSite.containers),
              tonnes: formatTonnes(activeSite.tonnes, 2),
              pop: formatNumber(activeSite.population_covered),
            })}
          </p>
        </div>
      )}

      <div className="absolute bottom-8 left-3 max-w-[calc(100%-1.5rem)] rounded-lg bg-card/95 text-xs shadow-sm ring-1 ring-foreground/10 backdrop-blur">
        <button
          type="button"
          onClick={() => setLegendOpen((v) => !v)}
          aria-expanded={legendOpen}
          aria-controls={legendId}
          className="flex min-h-10 w-full items-center justify-between gap-2 px-2.5 font-medium focus-visible:outline-2 focus-visible:outline-ring"
        >
          {m.scenario_legend()}
          <ChevronDown
            className={cn('size-3.5 transition-transform', legendOpen && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
        <ul id={legendId} hidden={!legendOpen} className="space-y-1 px-2.5 pb-2.5">
          {bySites && siting ? (
            <>
              <li className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full border-2"
                  style={{ background: SITE_COLOR, borderColor: SITE_COLOR }}
                  aria-hidden="true"
                />
                {hasStaffed ? m.site_kind_public() : m.site_map_open()}
              </li>
              {hasStaffed && (
                <li className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-full border-[2.5px]"
                    style={{ background: STAFFED_FILL, borderColor: ink }}
                    aria-hidden="true"
                  />
                  {m.site_map_staffed()}
                </li>
              )}
              {sites.some((s) => s.coord_precision === 'approximate') && (
                <li className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full border-2 bg-white"
                    style={{ borderColor: SITE_COLOR }}
                    aria-hidden="true"
                  />
                  {m.site_precision_approximate()}
                </li>
              )}
              <li className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ background: `${SITE_COLOR}33`, border: `1px solid ${SITE_COLOR}` }}
                  aria-hidden="true"
                />
                {m.site_map_circle({ n: formatNumber(siting.radius_m) })}
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ background: NO_MODE_COLOR }}
                  aria-hidden="true"
                />
                {m.site_map_no_site()}
              </li>
              {pap.size > 0 && (
                <li className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-3 rounded-[3px] border-2"
                    style={{ borderColor: ink }}
                    aria-hidden="true"
                  />
                  {m.site_map_pap()}
                </li>
              )}
            </>
          ) : (
            <>
              {ALL_MODES.filter(
                (mode) =>
                  (result.default_modes ?? MODES_SHOWN).includes(mode) ||
                  result.allocations.some((x) => x.mode === mode),
              ).map((mode) => (
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
              {pap.size > 0 && (
                <li className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-3 rounded-[3px] border-2"
                    style={{ borderColor: ink }}
                    aria-hidden="true"
                  />
                  {m.site_map_pap()}
                </li>
              )}
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
