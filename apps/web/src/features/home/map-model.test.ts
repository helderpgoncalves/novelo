import { describe, expect, it } from 'vitest';
import type { CaopFeature, OverviewParish } from '@/client';
import { buildMapModel, layerValues, neighbourInDirection, parishGapT } from './map-model';

const square = (lon: number, lat: number, size: number) => ({
  type: 'Polygon',
  coordinates: [
    [
      [lon, lat],
      [lon + size, lat],
      [lon + size, lat + size],
      [lon, lat + size],
      [lon, lat],
    ],
  ],
});
const zone = (code: string, lon: number, lat: number, size: number, name = code) =>
  ({
    properties: {
      dicofre: code,
      name,
      area_km2: 2,
      lon: lon + size / 2,
      lat: lat + size / 2,
    },
    geometry: square(lon, lat, size),
  }) as unknown as CaopFeature;
const parish = (code: string, extra: Partial<OverviewParish>) =>
  ({
    code,
    name: code,
    population: 1000,
    potential_t: 10,
    circuits_count: 1,
    area_km2: 2,
    ...extra,
  }) as OverviewParish;

describe('buildMapModel', () => {
  const model = buildMapModel([
    zone('a', -8.3, 41.4, 0.1),
    zone('b', -8.2, 41.4, 0.1, 'União das freguesias de Alfa e Beta'),
    zone('empty', -8.1, 41.4, 0.0),
  ]);
  it('uma forma por freguesia, com todos os contornos num só caminho', () => {
    expect(model.parishes.map((p) => p.code)).toEqual(['a', 'b', 'empty']);
    expect((model.borders.match(/M/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(model.width).toBe(1000);
    expect(model.height).toBeGreaterThan(0);
  });
  it('põe a etiqueta no interior, com a corda e o raio inscrito', () => {
    const a = model.parishes.find((p) => p.code === 'a');
    expect(a?.chord).toBeGreaterThan(100);
    expect(a?.radius).toBeGreaterThan(50);
    expect(a?.radius).toBeLessThanOrEqual((a?.chord ?? 0) / 2 + 1);
  });
  it('tira «União das freguesias de» ao nome do mapa', () => {
    expect(model.parishes.find((p) => p.code === 'b')?.label).toBe('Alfa e Beta');
  });
  it('usa a área do CAOP', () => {
    expect(model.parishes[0]?.areaKm2).toBe(2);
  });
  it('sem contornos não rebenta', () => {
    expect(buildMapModel([]).parishes).toEqual([]);
  });
});

describe('layerValues', () => {
  const ps = [
    parish('a', { population: 4000, circuits_count: 0 }),
    parish('b', {}),
    parish('c', { potential_t: Number.NaN }),
  ];
  const ctx = {
    parishes: ps,
    capturePct: 25,
    areaKm2: new Map([
      ['a', 2],
      ['b', 4],
    ]),
    municipalContainers: new Map([['b', 8]]),
  };
  it('potencial por captar = potencial × (1 − captura), em t/ano', () => {
    expect(parishGapT(ps[1] as OverviewParish, 25)).toBeCloseTo(7.5, 9);
    expect(layerValues('gap', ctx).get('b')).toBeCloseTo(7.5, 9);
  });
  it('freguesia sem valor válido fica fora (sem dados)', () => {
    expect(layerValues('gap', ctx).has('c')).toBe(false);
    expect(layerValues('density', ctx).has('c')).toBe(false);
    expect(layerValues('containers', ctx).has('a')).toBe(false);
  });
  it('população total, densidade por km² e lacunas de circuitos', () => {
    expect(layerValues('population', ctx).get('a')).toBe(4000);
    expect(layerValues('density', ctx).get('a')).toBe(2000);
    expect(layerValues('data_gaps', ctx).get('a')).toBe(1);
    expect(layerValues('data_gaps', ctx).get('b')).toBe(0);
  });
  it('contentores municipais em número absoluto, sem contar como têxteis', () => {
    expect(layerValues('containers', ctx).get('b')).toBe(8);
  });
});

describe('neighbourInDirection', () => {
  const anchors = [
    { code: 'c', x: 0, y: 0 },
    { code: 'e', x: 10, y: 1 },
    { code: 'far-e', x: 50, y: 0 },
    { code: 's', x: 0, y: 10 },
    { code: 'ne', x: 12, y: -12 },
  ];
  it('escolhe o mais próximo na direção da seta', () => {
    expect(neighbourInDirection(anchors, 'c', 'right')).toBe('e');
    expect(neighbourInDirection(anchors, 'c', 'down')).toBe('s');
    expect(neighbourInDirection(anchors, 'e', 'left')).toBe('c');
  });
  it('sem ninguém nessa direção não se mexe', () => {
    expect(neighbourInDirection(anchors, 'far-e', 'right')).toBeNull();
    expect(neighbourInDirection(anchors, 'c', 'left')).toBeNull();
  });
});
