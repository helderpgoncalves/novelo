import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  getCaopParishesGeojsonOptions,
  getMunicipalSitesGeojsonOptions,
  listMunicipalProducersInfiniteOptions,
} from '@/client/@tanstack/react-query.gen';
import {
  countByKind,
  countByProducerType,
  type LayerState,
  niceMax,
  producerPoints,
  sitePoints,
  visibleSites,
} from '@/features/municipal/derive';
import { useAllPages } from '@/features/municipal/use-all-pages';
import type { LayerLoad, LayersPanelProps } from './layers-panel';
import type { MunicipalMapProps } from './network-map';

const STALE = 10 * 60_000;

/**
 * Dados e derivações das camadas municipais do mapa. Cada fonte só é pedida quando a camada que a usa está ligada
 * (ou há um local escolhido no URL), por isso a rede de têxteis continua leve.
 */
export function useMunicipalMap(
  layers: LayerState,
  selectedSite: string | null,
  flyOnSelect: boolean,
  onSelectSite: (id: string | null) => void,
) {
  const needSites = layers.sites !== 'off' || layers.producers || selectedSite !== null;
  const needCaop = layers.fill === 'density' || layers.fill === 'cover';
  const needProducers = layers.producers || selectedSite !== null;

  const sitesQuery = useQuery({
    ...getMunicipalSitesGeojsonOptions({ query: { cluster: false } }),
    enabled: needSites,
    staleTime: STALE,
  });
  const caopQuery = useQuery({
    ...getCaopParishesGeojsonOptions(),
    enabled: needCaop,
    staleTime: STALE,
  });
  const producersQuery = useInfiniteQuery({
    ...listMunicipalProducersInfiniteOptions({ query: { limit: 500 } }),
    // A primeira página não leva cursor (o cliente gerado só aceita objetos aqui).
    initialPageParam: {},
    getNextPageParam: (last) => last.next_cursor,
    enabled: needProducers,
    staleTime: STALE,
  });
  const producerPages = useAllPages(producersQuery);

  const points = useMemo(() => sitePoints(sitesQuery.data), [sitesQuery.data]);
  const producers = useMemo(() => producerPoints(producerPages.rows), [producerPages.rows]);
  const producerSiteIds = useMemo(
    () => new Set(producerPages.rows.map((p) => p.site_id)),
    [producerPages.rows],
  );
  const visible = useMemo(
    () =>
      visibleSites(points, {
        sites: layers.sites,
        kinds: layers.kinds,
        producers: layers.producers,
        producerSiteIds,
      }),
    [points, layers.sites, layers.kinds, layers.producers, producerSiteIds],
  );

  const densityMax = useMemo(
    () =>
      niceMax((caopQuery.data?.features ?? []).map((f) => f.properties.containers_per_1000_hab)),
    [caopQuery.data],
  );

  const selectedPoint = useMemo<[number, number] | null>(() => {
    if (!selectedSite) return null;
    const site = points.find((p) => p.properties.site_id === selectedSite);
    if (site) return [site.geometry.coordinates[0] ?? 0, site.geometry.coordinates[1] ?? 0];
    const producer = producers.find((p) => p.properties.site_id === selectedSite);
    return producer
      ? [producer.geometry.coordinates[0] ?? 0, producer.geometry.coordinates[1] ?? 0]
      : null;
  }, [selectedSite, points, producers]);

  const map: MunicipalMapProps = {
    layers,
    sites: visible,
    producers,
    caop: caopQuery.data,
    densityMax,
    selectedSite,
    selectedPoint,
    flyTo: flyOnSelect ? selectedPoint : null,
    onSelectSite,
  };

  const load = (pending: boolean, isError: boolean, retry: () => void): LayerLoad => ({
    pending,
    error: isError,
    retry,
  });
  const panel: Pick<LayersPanelProps, 'counts' | 'load'> = {
    counts: {
      // Antes de os locais chegarem (camada desligada ou a carregar) não há contagem: «0» enganava.
      sitesLoaded: sitesQuery.data !== undefined,
      kinds: countByKind(points),
      candidates: points.filter((p) => p.properties.candidate).length,
      sites: points.length,
      producerTypes: countByProducerType(producers),
      producerTotal: producers.length,
    },
    load: {
      sites: load(
        needSites && sitesQuery.isPending,
        sitesQuery.isError,
        () => void sitesQuery.refetch(),
      ),
      caop: load(
        needCaop && caopQuery.isPending,
        caopQuery.isError,
        () => void caopQuery.refetch(),
      ),
      producers: load(
        needProducers && producerPages.loading,
        !!producerPages.error && producerPages.rows.length === 0,
        producerPages.retry,
      ),
    },
  };
  return { map, panel };
}
