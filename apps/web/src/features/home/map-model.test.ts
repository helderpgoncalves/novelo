import { describe, expect, it } from 'vitest';
import type { CaopFeature, OverviewParish } from '@/client';
import {
  buildMapModel,
  dotsPath,
  layerValues,
  neighbourInDirection,
  parishGapT,
  radiusFor,
} from './map-model';

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
const zone = (code: string, lon: number, lat: number, size: number) =>
  ({
    properties: {
      dicofre: code,
      name: code,
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
  const zones = [
    zone('a', -8.3, 41.4, 0.1),
    zone('b', -8.2, 41.4, 0.1),
    zone('tiny', -8.1, 41.4, 0.0002),
  ];
  const model = buildMapModel(zones, 400);
  it('preenche as freguesias numa grelha a 45º e dá um ponto à mais pequena', () => {
    const a = model.parishes.find((p) => p.code === 'a');
    const tiny = model.parishes.find((p) => p.code === 'tiny');
    expect(a?.dots.length).toBeGreaterThan(50);
    expect(tiny?.dots.length).toBe(1);
    const step = model.step;
    for (const [x, y] of a?.dots ?? []) {
      expect((Math.round(x / step) + Math.round(y / step)) % 2).toBe(0);
    }
  });
  it('fica perto do número de pontos pedido', () => {
    const n = model.parishes.reduce((s, p) => s + p.dots.length, 0);
    expect(n).toBeGreaterThan(250);
    expect(n).toBeLessThan(600);
  });
  it('usa a área do CAOP', () => {
    expect(model.parishes[0]?.areaKm2).toBe(2);
  });
});

describe('dotsPath e radiusFor', () => {
  it('um círculo por ponto e nada com raio 0', () => {
    expect(dotsPath([[10, 10]], 0)).toBe('');
    expect(
      (
        dotsPath(
          [
            [10, 10],
            [20, 20],
          ],
          2,
        ).match(/M/g) ?? []
      ).length,
    ).toBe(2);
  });
  it('raio ∝ raiz do valor com mínimo', () => {
    expect(radiusFor(4, 4, 10)).toBeCloseTo(6.8, 9);
    expect(radiusFor(1, 4, 10)).toBeCloseTo(3.4, 9);
    expect(radiusFor(0, 4, 10)).toBeCloseTo(1.2, 9);
    expect(radiusFor(undefined, 4, 10)).toBeCloseTo(1.2, 9);
  });
});

describe('layerValues', () => {
  const ps = [parish('a', { population: 4000, area_km2: 2, circuits_count: 0 }), parish('b', {})];
  const ctx = {
    parishes: ps,
    capturePct: 25,
    areaKm2: new Map([
      ['a', 2],
      ['b', 4],
    ]),
    municipalContainers: new Map([['b', 8]]),
  };
  it('potencial por captar = potencial × (1 − captura), por km²', () => {
    expect(parishGapT(ps[1] as OverviewParish, 25)).toBeCloseTo(7.5, 9);
    expect(layerValues('gap', ctx).get('b')).toBeCloseTo(7.5 / 4, 9);
  });
  it('população por km² e lacunas de circuitos', () => {
    expect(layerValues('population', ctx).get('a')).toBe(2000);
    expect(layerValues('data_gaps', ctx).get('a')).toBe(1);
    expect(layerValues('data_gaps', ctx).get('b')).toBe(0);
  });
  it('contentores municipais por km², sem contar como têxteis', () => {
    expect(layerValues('containers', ctx).get('b')).toBe(2);
    expect(layerValues('containers', ctx).get('a')).toBe(0);
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
