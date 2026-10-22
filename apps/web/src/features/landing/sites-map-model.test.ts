import { describe, expect, it } from 'vitest';
import raw from './data/guimaraes-sites.json';
import { FACTS, MAP } from './facts';
import { byRing, parseSites, RINGS, rankParishes, siteRadius, siteTone } from './sites-map-model';

const names = MAP.parishes.map((p) => p.name);

describe('mapa dos locais', () => {
  it('lê os pontos e repõe as toneladas a partir dos décimos', () => {
    const sites = parseSites({ center: [0, 0], points: [[10, 20, 15, 3, 12]], parishes: [] });
    expect(sites).toEqual([{ x: 10, y: 20, t: 1.5, parish: 3, ring: RINGS - 1 }]);
  });

  it('tem um ponto por local público com contentores e soma o têxtil por desviar', () => {
    const sites = parseSites(raw);
    expect(sites).toHaveLength(FACTS.municipalDemandSites);
    const total = sites.reduce((s, x) => s + x.t, 0);
    // Arredondamento a 0,1 t por local: a soma fica a menos de 1% das ≈ 3 003,3 t.
    expect(Math.abs(total - FACTS.residualT) / FACTS.residualT).toBeLessThan(0.01);
  });

  it('ordena as freguesias pelo têxtil por desviar e soma o concelho', () => {
    const ranked = rankParishes(raw, names);
    expect(ranked).toHaveLength(MAP.parishes.length);
    expect(ranked[0]?.t).toBeGreaterThanOrEqual(ranked[1]?.t ?? 0);
    const total = ranked.reduce((s, p) => s + p.t, 0);
    expect(total).toBeCloseTo(FACTS.residualT, 0);
    expect(ranked.reduce((s, p) => s + p.sites, 0)).toBe(FACTS.municipalDemandSites);
  });

  it('dá raio pela raiz (área proporcional) e tom por limiar', () => {
    expect(siteRadius(0)).toBeCloseTo(2.6);
    expect(siteRadius(4) - siteRadius(0)).toBeCloseTo(2 * (siteRadius(1) - siteRadius(0)));
    expect([siteTone(0.5), siteTone(1), siteTone(2.9), siteTone(3)]).toEqual([0, 1, 1, 2]);
  });

  it('agrupa por anel sem perder pontos', () => {
    const sites = parseSites(raw);
    const rings = byRing(sites);
    expect(rings).toHaveLength(RINGS);
    expect(rings.flat()).toHaveLength(sites.length);
  });
});
