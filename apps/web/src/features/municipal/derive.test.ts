import { describe, expect, it } from 'vitest';
import type { SiteFeatureCollection } from '@/client';
import {
  countByKind,
  layersFromSearch,
  matchPreset,
  niceMax,
  nnBand,
  PRESETS,
  parseKinds,
  producerPoints,
  quantile,
  resolveLayers,
  searchFromLayers,
  serializeKinds,
  sitePoints,
  visibleSites,
} from './derive';

const collection = (): SiteFeatureCollection => ({
  clustered: false,
  total_sites: 4,
  zoom: null,
  features: [
    {
      geometry: { type: 'Point', coordinates: [-8.3, 41.4] },
      properties: {
        cluster: false,
        point_count: 1,
        containers: 2,
        site_id: 'S1',
        site_class: 'public',
        kind: 'underground',
        kinds: ['underground'],
        textile_candidate: true,
        coord_precision: 'precise',
        nn_distance_m: 20,
        parish_name: 'A',
      },
    },
    {
      geometry: { type: 'Point', coordinates: [-8.31, 41.41] },
      properties: {
        cluster: false,
        point_count: 1,
        containers: 1,
        site_id: 'S2',
        site_class: 'producer',
        kind: 'organic_producer',
        kinds: ['organic_producer'],
        textile_candidate: false,
        coord_precision: 'approximate',
        nn_distance_m: null,
        parish_name: 'B',
      },
    },
    {
      geometry: { type: 'Point', coordinates: [-8.32, 41.42] },
      properties: {
        cluster: false,
        point_count: 1,
        containers: 1,
        site_id: 'S3',
        site_class: 'public',
        kind: 'surface',
        kinds: ['surface'],
        textile_candidate: true,
        coord_precision: 'approximate',
        nn_distance_m: 400,
        parish_name: 'A',
      },
    },
    {
      geometry: { type: 'Point', coordinates: [-8.33, 41.43] },
      properties: { cluster: true, point_count: 9, containers: 12 },
    },
  ],
});

describe('presets de camadas', () => {
  it('o preset de têxteis não liga nada municipal', () => {
    const t = resolveLayers('textile');
    expect(t.sites).toBe('off');
    expect(t.fill).toBe('textile');
    expect(t.producers).toBe(false);
  });

  it('as alterações do utilizador sobrepõem-se ao preset', () => {
    const s = resolveLayers('municipal', { sites: 'candidates', kinds: ['surface'] });
    expect(s.sites).toBe('candidates');
    expect(s.kinds).toEqual(['surface']);
    expect(s.fill).toBe('density');
  });

  it('reconhece o preset ativo e devolve null quando é personalizado', () => {
    expect(matchPreset(resolveLayers('gaps'))).toBe('gaps');
    expect(matchPreset(resolveLayers('municipal', { producers: true }))).toBeNull();
    expect(
      matchPreset({ ...PRESETS.municipal, kinds: [...PRESETS.municipal.kinds].reverse() }),
    ).toBe('municipal');
  });

  it('lê e escreve os tipos no URL ignorando lixo', () => {
    expect(parseKinds('surface,xx,underground')).toEqual(['underground', 'surface']);
    expect(parseKinds(undefined)).toBeUndefined();
    expect(parseKinds('')).toEqual([]);
    expect(serializeKinds(['surface', 'underground'])).toBe('underground,surface');
  });
});

describe('locais no mapa', () => {
  it('ignora grupos do servidor e fica com os locais', () => {
    const pts = sitePoints(collection());
    expect(pts.map((p) => p.properties.site_id)).toEqual(['S1', 'S2', 'S3']);
    expect(pts[1]?.properties.approximate).toBe(true);
    expect(pts[1]?.properties.nn_band).toBe(-1);
  });

  it('filtra por modo', () => {
    const pts = sitePoints(collection());
    const base = {
      kinds: ['underground', 'surface'] as const,
      producers: false,
      producerSiteIds: new Set<string>(),
    };
    const ids = (sites: 'kind' | 'candidates' | 'isolation' | 'density' | 'off', extra = {}) =>
      visibleSites(pts, { ...base, kinds: [...base.kinds], sites, ...extra }).map(
        (p) => p.properties.site_id,
      );
    expect(ids('kind')).toEqual(['S1', 'S3']);
    expect(ids('candidates')).toEqual(['S1', 'S3']);
    expect(ids('isolation')).toEqual(['S1', 'S3']);
    expect(ids('density')).toEqual(['S1', 'S2', 'S3']);
    expect(ids('off')).toEqual([]);
  });

  it('tira os locais de produtores quando a camada de produtores está ligada', () => {
    const pts = sitePoints(collection());
    const out = visibleSites(pts, {
      sites: 'density',
      kinds: [],
      producers: true,
      producerSiteIds: new Set(['S2']),
    });
    expect(out.map((p) => p.properties.site_id)).toEqual(['S1', 'S3']);
  });

  it('conta locais por tipo', () => {
    const c = countByKind(sitePoints(collection()));
    expect(c.underground).toBe(1);
    expect(c.surface).toBe(1);
    expect(c.organic_producer).toBe(1);
    expect(c.platform).toBe(0);
  });

  it('classifica a distância ao vizinho em bandas', () => {
    expect(nnBand(null)).toBe(-1);
    expect(nnBand(0)).toBe(0);
    expect(nnBand(49.9)).toBe(0);
    expect(nnBand(50)).toBe(1);
    expect(nnBand(299)).toBe(2);
    expect(nnBand(1468)).toBe(3);
  });

  it('produtores com vários tipos ficam "vários" e nunca levam nomes', () => {
    const pts = producerPoints([
      {
        site_id: 'P1',
        latitude: 41.4,
        longitude: -8.3,
        containers: 3,
        capacity_litres_total: 300,
        coord_precision: 'precise',
        parish_dicofre: null,
        parish_name: null,
        producer_names: ['Nome secreto'],
        producer_types: ['school', 'restaurant'],
      },
      {
        site_id: 'P2',
        latitude: 41.5,
        longitude: -8.2,
        containers: 1,
        capacity_litres_total: 100,
        coord_precision: 'precise',
        parish_dicofre: null,
        parish_name: null,
        producer_names: null,
        producer_types: ['school'],
      },
    ]);
    expect(pts[0]?.properties.type).toBe('multiple');
    expect(pts[1]?.properties.type).toBe('school');
    expect(JSON.stringify(pts)).not.toContain('Nome secreto');
  });
});

describe('estatística', () => {
  it('calcula quantis por interpolação', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([10], 0.9)).toBe(10);
    expect(quantile([], 0.5)).toBe(0);
  });

  it('arredonda o teto da rampa para cima a um valor redondo', () => {
    expect(niceMax([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 1)).toBe(10);
    expect(niceMax([12, 14, 21, 3], 1)).toBe(25);
    expect(niceMax([0, 0], 0.9)).toBe(1);
    // Um valor extremo não deslava a rampa: o percentil 90 manda.
    expect(niceMax([5, 6, 7, 8, 9, 10, 11, 12, 13, 600], 0.8)).toBe(20);
  });
});

describe('estado das camadas no URL', () => {
  it('sem parâmetros é a rede de têxteis, como antes', () => {
    const s = layersFromSearch({});
    expect(s).toEqual(PRESETS.textile);
  });

  it('o preset do URL e as alterações combinam-se', () => {
    const s = layersFromSearch({ preset: 'municipal', producers: true, kinds: 'surface' });
    expect(s.sites).toBe('kind');
    expect(s.producers).toBe(true);
    expect(s.kinds).toEqual(['surface']);
  });

  it('escreve no URL só o que difere do preset', () => {
    const s = resolveLayers('municipal', { sites: 'candidates' });
    expect(searchFromLayers('municipal', s)).toEqual({
      loc: undefined,
      fill: undefined,
      sites: 'candidates',
      kinds: undefined,
      producers: undefined,
    });
  });

  it('ida e volta mantém o estado', () => {
    const state = resolveLayers('gaps', { localities: true, kinds: ['underground', 'platform'] });
    const back = layersFromSearch({ preset: 'gaps', ...searchFromLayers('gaps', state) });
    expect(back).toEqual(state);
  });
});
