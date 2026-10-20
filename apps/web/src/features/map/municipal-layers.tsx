import type { ExpressionSpecification } from 'maplibre-gl';
import { useEffect, useMemo } from 'react';
import { Layer, Source, useMap } from 'react-map-gl/maplibre';
import type { CaopFeatureCollection } from '@/client';
import type { LayerState, ProducerPoint, SitePoint } from '@/features/municipal/derive';
import { rampExpression } from './choropleth';
import { markerId, registerMarkerImages } from './marker-images';

/** Camadas clicáveis da rede municipal (para o `interactiveLayerIds` do mapa). */
export const CAOP_FILL = 'caop-fill';
export const MUN_CLUSTERS = 'mun-clusters';
export const MUN_POINTS = 'mun-points';
export const MUN_ISOLATION = 'mun-isolation';
export const MUN_PRODUCERS = 'mun-producers';
export const MUNICIPAL_POINT_LAYERS = [MUN_CLUSTERS, MUN_POINTS, MUN_ISOLATION, MUN_PRODUCERS];

const EMPTY = { type: 'FeatureCollection' as const, features: [] };
const CLUSTER_ICON = markerId('cl', '#26456b');

const visibility = (on: boolean) => ({ visibility: on ? ('visible' as const) : ('none' as const) });

const ICON_SIZE: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  9,
  0.6,
  13,
  0.85,
  17,
  1.15,
];

interface FillProps {
  caop: CaopFeatureCollection | undefined;
  fill: LayerState['fill'];
  /** Teto da rampa do coroplético de densidade. */
  densityMax: number;
  selected: string | null;
}

/** Freguesias CAOP 2019 com o coroplético municipal. Fica sempre montada para manter a ordem das camadas. */
export function MunicipalFill({ caop, fill, densityMax, selected }: FillProps) {
  const data = useMemo(
    () =>
      caop
        ? {
            type: 'FeatureCollection' as const,
            features: caop.features as unknown as GeoJSON.Feature[],
          }
        : EMPTY,
    [caop],
  );
  const on = fill === 'density' || fill === 'cover';
  const property = fill === 'cover' ? 'cover_pct_300m' : 'containers_per_1000_hab';
  const max = fill === 'cover' ? 100 : densityMax;
  return (
    <Source id="caop" type="geojson" data={data}>
      <Layer
        id={CAOP_FILL}
        type="fill"
        layout={visibility(on)}
        paint={{ 'fill-color': rampExpression(property, max), 'fill-opacity': 0.78 }}
      />
      <Layer
        id="caop-line"
        type="line"
        layout={visibility(on)}
        paint={{ 'line-color': '#14211d', 'line-opacity': 0.4, 'line-width': 0.8 }}
      />
      <Layer
        id="caop-selected"
        type="line"
        layout={visibility(on)}
        filter={['==', ['get', 'dicofre'], selected ?? '']}
        paint={{ 'line-color': '#14211d', 'line-width': 2.5 }}
      />
    </Source>
  );
}

interface PointsProps {
  layers: LayerState;
  sites: SitePoint[];
  producers: ProducerPoint[];
  /** Posição do local selecionado, para o anel de realce e para centrar o mapa. */
  selectedPoint: [number, number] | null;
  /** Centrar o mapa neste ponto (uma vez por pedido). */
  flyTo: [number, number] | null;
}

/** Locais municipais (agrupados, por distância ou em calor), produtores e realce do local escolhido. */
export function MunicipalPoints({ layers, sites, producers, selectedPoint, flyTo }: PointsProps) {
  const { current: map } = useMap();

  useEffect(() => {
    const instance = map?.getMap();
    if (!instance) return;
    return registerMarkerImages(instance);
  }, [map]);

  useEffect(() => {
    if (!map || !flyTo) return;
    map.flyTo({ center: flyTo, zoom: Math.max(map.getZoom(), 16), duration: 900 });
  }, [map, flyTo]);

  const clustered = layers.sites === 'kind' || layers.sites === 'candidates';
  const flat = layers.sites === 'isolation' || layers.sites === 'density';
  const clusteredData = useMemo(
    () => (clustered ? { type: 'FeatureCollection' as const, features: sites } : EMPTY),
    [clustered, sites],
  );
  const flatData = useMemo(
    () => (flat ? { type: 'FeatureCollection' as const, features: sites } : EMPTY),
    [flat, sites],
  );
  const producerData = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: layers.producers ? producers : [],
    }),
    [layers.producers, producers],
  );
  const selectedData = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: selectedPoint
        ? [
            {
              type: 'Feature' as const,
              properties: {},
              geometry: { type: 'Point' as const, coordinates: selectedPoint },
            },
          ]
        : [],
    }),
    [selectedPoint],
  );

  return (
    <>
      <Source id="mun-flat" type="geojson" data={flatData}>
        <Layer
          id="mun-heat"
          type="heatmap"
          layout={visibility(layers.sites === 'density')}
          paint={{
            'heatmap-weight': ['interpolate', ['linear'], ['get', 'containers'], 1, 0.35, 12, 1],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 15, 2],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 9, 13, 22, 16, 42],
            'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0.85, 18, 0.35],
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0,
              'rgba(46,107,87,0)',
              0.2,
              'rgba(159,196,178,0.55)',
              0.45,
              'rgba(224,176,74,0.75)',
              0.75,
              'rgba(204,102,34,0.88)',
              1,
              'rgba(150,40,20,0.95)',
            ],
          }}
        />
        <Layer
          id={MUN_ISOLATION}
          type="symbol"
          layout={{
            ...visibility(layers.sites === 'isolation'),
            'icon-image': ['get', 'icon'],
            'icon-size': ICON_SIZE,
            'icon-allow-overlap': true,
          }}
        />
      </Source>
      <Source
        id="mun-sites"
        type="geojson"
        data={clusteredData}
        cluster
        clusterRadius={46}
        clusterMaxZoom={15}
      >
        <Layer
          id={MUN_CLUSTERS}
          type="symbol"
          filter={['has', 'point_count']}
          layout={{
            ...visibility(clustered),
            'icon-image': CLUSTER_ICON,
            'icon-size': ['step', ['get', 'point_count'], 0.75, 10, 0.95, 50, 1.15, 200, 1.4],
            'icon-allow-overlap': true,
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['Montserrat Medium'],
            'text-size': 11,
            'text-allow-overlap': true,
          }}
          paint={{ 'text-color': '#ffffff' }}
        />
        <Layer
          id={MUN_POINTS}
          type="symbol"
          filter={['!', ['has', 'point_count']]}
          layout={{
            ...visibility(clustered),
            'icon-image': ['get', 'icon'],
            'icon-size': ICON_SIZE,
            'icon-allow-overlap': true,
          }}
        />
      </Source>
      <Source id="mun-producers" type="geojson" data={producerData}>
        <Layer
          id={MUN_PRODUCERS}
          type="symbol"
          layout={{
            ...visibility(layers.producers),
            'icon-image': ['get', 'icon'],
            'icon-size': ICON_SIZE,
            'icon-allow-overlap': true,
          }}
        />
      </Source>
      <Source id="mun-selected" type="geojson" data={selectedData}>
        <Layer
          id="mun-selected-ring"
          type="circle"
          paint={{
            'circle-radius': 15,
            'circle-color': 'rgba(0,0,0,0)',
            'circle-stroke-color': '#14211d',
            'circle-stroke-width': 3,
          }}
        />
        <Layer
          id="mun-selected-halo"
          type="circle"
          paint={{
            'circle-radius': 18,
            'circle-color': 'rgba(0,0,0,0)',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
          }}
        />
      </Source>
    </>
  );
}
