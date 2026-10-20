import { describe, expect, it } from 'vitest';
import {
  buildScale,
  clampView,
  classOf,
  type LabelCandidate,
  legendClasses,
  niceBreak,
  placeLabels,
  shortName,
  splitTwo,
  stripUnion,
  zoomAt,
} from './choropleth';

describe('buildScale e classOf', () => {
  const values = Array.from({ length: 48 }, (_, i) => (i + 1) ** 2 / 10);
  const scale = buildScale(values, 6);
  it('seis classes por quantis, com limites crescentes', () => {
    expect(scale.count).toBe(6);
    expect(scale.discrete).toBe(false);
    expect(scale.breaks).toHaveLength(5);
    for (let i = 1; i < scale.breaks.length; i++) {
      expect(scale.breaks[i]).toBeGreaterThan(scale.breaks[i - 1] ?? 0);
    }
  });
  it('cada classe fica com cerca de um sexto das freguesias', () => {
    const counts = new Array<number>(6).fill(0);
    for (const v of values) {
      const c = classOf(v, scale);
      counts[c] = (counts[c] ?? 0) + 1;
    }
    for (const c of counts) expect(c).toBeGreaterThanOrEqual(6);
    expect(counts.reduce((s, c) => s + c, 0)).toBe(48);
  });
  it('o mínimo é a classe 0, o máximo a última, e sem valor é -1', () => {
    expect(classOf(Math.min(...values), scale)).toBe(0);
    expect(classOf(Math.max(...values), scale)).toBe(5);
    expect(classOf(undefined, scale)).toBe(-1);
    expect(classOf(Number.NaN, scale)).toBe(-1);
  });
  it('um valor igual ao limite sobe de classe', () => {
    const s = buildScale([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 3);
    const limit = s.breaks[0] ?? 0;
    expect(classOf(limit, s)).toBe(1);
    expect(classOf(limit - 0.01, s)).toBe(0);
  });
  it('poucos valores distintos: uma classe por valor', () => {
    const s = buildScale([0, 0, 1, 1, 2, 5, 5, 0], 6);
    expect(s.discrete).toBe(true);
    expect(s.count).toBe(4);
    expect([0, 1, 2, 5].map((v) => classOf(v, s))).toEqual([0, 1, 2, 3]);
  });
  it('sem valores válidos não há classes; ignora NaN', () => {
    expect(buildScale([], 6).count).toBe(0);
    expect(buildScale([Number.NaN], 6).count).toBe(0);
    expect(buildScale([Number.NaN, 3, 3], 6).count).toBe(1);
  });
});

describe('legendClasses', () => {
  it('etiquetas com os limites e contagem por classe', () => {
    const values = Array.from({ length: 12 }, (_, i) => i + 1);
    const s = buildScale(values, 3);
    const classes = legendClasses(s, values, (v) => String(v));
    expect(classes).toHaveLength(3);
    expect(classes[0]?.label.startsWith('<')).toBe(true);
    expect(classes[2]?.label.startsWith('≥')).toBe(true);
    expect(classes.reduce((sum, c) => sum + c.count, 0)).toBe(12);
  });
  it('escala discreta: o próprio valor', () => {
    const s = buildScale([0, 1, 2, 2], 6);
    expect(legendClasses(s, [0, 1, 2, 2], String).map((c) => c.label)).toEqual(['0', '1', '2']);
  });
});

describe('niceBreak', () => {
  it('2 algarismos significativos', () => {
    expect(niceBreak(1.234)).toBeCloseTo(1.2, 9);
    expect(niceBreak(148)).toBe(150);
    expect(niceBreak(0)).toBe(0);
    expect(niceBreak(0.0456)).toBeCloseTo(0.046, 9);
  });
});

describe('nomes', () => {
  it('tira «União das freguesias de»', () => {
    expect(stripUnion('União das freguesias de Abação e Gémeos')).toBe('Abação e Gémeos');
    expect(stripUnion('Azurém')).toBe('Azurém');
  });
  it('nomes compridos ficam só com a primeira localidade e reticências', () => {
    expect(
      shortName('União das freguesias de Briteiros São Salvador e Briteiros Santa Leocádia'),
    ).toBe('Briteiros São Salvador…');
    expect(shortName('Moreira de Cónegos')).toBe('Moreira de Cónegos');
  });
  it('divide em duas linhas no espaço mais perto do meio', () => {
    expect(splitTwo('Moreira de Cónegos')).toEqual(['Moreira de', 'Cónegos']);
    expect(splitTwo('Azurém')).toBeNull();
  });
});

describe('placeLabels', () => {
  const size = { w: 600, h: 600 };
  const view = { k: 1, tx: 0, ty: 0 };
  const big: LabelCandidate = {
    code: 'big',
    text: 'Azurém',
    x: 300,
    y: 300,
    chord: 200,
    radius: 80,
    priority: 80,
  };
  it('mostra o nome se cabe na corda da freguesia', () => {
    const [l] = placeLabels([big], view, 1, 12, size);
    expect(l?.lines).toEqual(['Azurém']);
    expect(l?.px).toBeCloseTo(300, 9);
  });
  it('esconde o que não cabe e mostra-o ao ampliar', () => {
    const small = { ...big, code: 'small', text: 'Creixomil', chord: 30, radius: 12 };
    expect(placeLabels([small], view, 1, 12, size)).toHaveLength(0);
    const zoomed = placeLabels([small], { k: 4, tx: -900, ty: -900 }, 1, 12, size);
    expect(zoomed.map((l) => l.code)).toEqual(['small']);
  });
  it('usa duas linhas quando só assim cabe', () => {
    const long = { ...big, text: 'Moreira de Cónegos', chord: 80, radius: 30 };
    const [l] = placeLabels([long], view, 1, 12, size);
    expect(l?.lines).toEqual(['Moreira de', 'Cónegos']);
  });
  it('em sobreposição ganha a de maior prioridade', () => {
    const other = { ...big, code: 'other', text: 'Ronfe', x: 305, y: 302, priority: 10 };
    const placed = placeLabels([other, big], view, 1, 12, size);
    expect(placed.map((l) => l.code)).toEqual(['big']);
  });
  it('não mostra etiquetas fora do quadro', () => {
    const edge = { ...big, x: 5, y: 300 };
    expect(placeLabels([edge], view, 1, 12, size)).toHaveLength(0);
  });
});

describe('zoom', () => {
  it('limita o zoom a 1–8 e a translação ao quadro', () => {
    expect(clampView({ k: 20, tx: 5, ty: 5 }, 1000, 1000).k).toBe(8);
    expect(clampView({ k: 2, tx: 100, ty: -5000 }, 1000, 1000)).toEqual({
      k: 2,
      tx: 0,
      ty: -1000,
    });
    expect(clampView({ k: 0.2, tx: -50, ty: -50 }, 1000, 1000)).toEqual({ k: 1, tx: 0, ty: 0 });
  });
  it('ampliar mantém fixo o ponto sob o cursor', () => {
    const v = zoomAt({ k: 1, tx: 0, ty: 0 }, 2, 500, 500, 1000, 1000);
    expect(v).toEqual({ k: 2, tx: -500, ty: -500 });
    const v2 = zoomAt(v, 4, 250, 250, 1000, 1000);
    // o ponto do mapa sob (250,250) antes e depois é o mesmo
    expect((250 - v.tx) / v.k).toBeCloseTo((250 - v2.tx) / v2.k, 9);
  });
});
