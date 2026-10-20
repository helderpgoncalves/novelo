import { describe, expect, it } from 'vitest';
import {
  aggregate,
  applyFilters,
  arrangeColumns,
  buildFacet,
  compareValues,
  dayOf,
  decodeUrlState,
  encodeUrlState,
  idsBetween,
  matchesFilter,
  moveId,
  moveTo,
  nextSort,
  numericBounds,
  resolveMeta,
  sortRows,
  viewKey,
} from './table-logic';
import type { Column, Filters } from './types';

interface Row {
  name: string;
  kind: string;
  qty: number | null;
  day: string | null;
}

const rows: Row[] = [
  { name: 'Ronfe', kind: 'a', qty: 10, day: '2026-03-01' },
  { name: 'Azúrem', kind: 'b', qty: 2.5, day: '2026-03-15T23:30:00Z' },
  { name: 'Creixomil', kind: 'a', qty: null, day: null },
  { name: 'Selho', kind: 'c', qty: 40, day: '2026-04-02' },
];

const columns: Column<Row>[] = [
  { id: 'name', header: 'Nome', cell: (r) => r.name, value: (r) => r.name, primary: true },
  { id: 'kind', header: 'Tipo', cell: (r) => r.kind, value: (r) => r.kind, filter: true },
  { id: 'qty', header: 'Qtd', cell: (r) => r.qty, value: (r) => r.qty },
  { id: 'day', header: 'Dia', cell: (r) => r.day, value: (r) => r.day, type: 'date' },
  { id: 'actions', header: 'Ações', cell: () => null },
];

describe('resolveMeta', () => {
  it('deduz tipos e filtros dos dados e da declaração', () => {
    const meta = resolveMeta(columns, rows);
    expect(meta.name).toMatchObject({ type: 'text', kind: 'text', explicit: false });
    expect(meta.kind).toMatchObject({ kind: 'facet', explicit: true });
    expect(meta.qty).toMatchObject({ type: 'number', kind: 'range' });
    expect(meta.day).toMatchObject({ type: 'date', kind: 'date' });
    expect(meta.actions?.kind).toBeNull();
  });

  it('filter:false desliga o filtro e filter:"range" força o tipo', () => {
    const meta = resolveMeta(
      [
        { id: 'a', header: 'A', cell: () => null, value: () => 1, filter: false },
        { id: 'b', header: 'B', cell: () => null, value: () => '3', filter: 'range' },
      ],
      [{}],
    );
    expect(meta.a?.kind).toBeNull();
    expect(meta.b?.kind).toBe('range');
  });
});

describe('filtros', () => {
  it('faceta com incluir e excluir', () => {
    expect(matchesFilter('a', { kind: 'facet', values: ['a', 'b'] })).toBe(true);
    expect(matchesFilter('c', { kind: 'facet', values: ['a', 'b'] })).toBe(false);
    expect(matchesFilter('c', { kind: 'facet', values: ['a', 'b'], exclude: true })).toBe(true);
    expect(matchesFilter('a', { kind: 'facet', values: [] })).toBe(true);
  });

  it('intervalo numérico: limites inclusivos e vazios fora', () => {
    const f = { kind: 'range', min: 2.5, max: 10 } as const;
    expect(matchesFilter(2.5, f)).toBe(true);
    expect(matchesFilter(10, f)).toBe(true);
    expect(matchesFilter(10.1, f)).toBe(false);
    expect(matchesFilter(null, f)).toBe(false);
    expect(matchesFilter(5, { kind: 'range', min: 6 })).toBe(false);
  });

  it('datas por dia, inclusivas', () => {
    const f = { kind: 'date', from: '2026-03-01', to: '2026-03-15' } as const;
    expect(matchesFilter('2026-03-01', f)).toBe(true);
    expect(matchesFilter('2026-03-16', f)).toBe(false);
    expect(matchesFilter(null, f)).toBe(false);
    expect(dayOf('2026-03-15')).toBe('2026-03-15');
    expect(dayOf('lixo')).toBeNull();
  });

  it('texto ignora acentos e maiúsculas, com operadores', () => {
    expect(matchesFilter('Azúrem', { kind: 'text', op: 'contains', value: 'azur' })).toBe(true);
    expect(matchesFilter('Azúrem', { kind: 'text', op: 'starts', value: 'AZ' })).toBe(true);
    expect(matchesFilter('Azúrem', { kind: 'text', op: 'equals', value: 'azurem' })).toBe(true);
    expect(matchesFilter('Azúrem', { kind: 'text', op: 'not_contains', value: 'rem' })).toBe(false);
  });

  it('applyFilters combina colunas e pode saltar uma (contagens das facetas)', () => {
    const filters: Filters = {
      kind: { kind: 'facet', values: ['a'] },
      qty: { kind: 'range', min: 5 },
    };
    expect(applyFilters(rows, columns, filters).map((r) => r.name)).toEqual(['Ronfe']);
    expect(applyFilters(rows, columns, filters, 'qty').map((r) => r.name)).toEqual([
      'Ronfe',
      'Creixomil',
    ]);
  });

  it('buildFacet conta valores e ordena por etiqueta', () => {
    const facet = buildFacet(rows, columns[1] as Column<Row>, (v) => v.toUpperCase());
    expect(facet).toEqual([
      { value: 'a', label: 'A', count: 2 },
      { value: 'b', label: 'B', count: 1 },
      { value: 'c', label: 'C', count: 1 },
    ]);
  });

  it('numericBounds ignora vazios', () => {
    expect(numericBounds(rows, columns[2] as Column<Row>)).toEqual({ min: 2.5, max: 40 });
    expect(numericBounds([], columns[2] as Column<Row>)).toBeNull();
  });
});

describe('ordenação', () => {
  it('numeros por valor, texto por pt-PT e vazios sempre no fim', () => {
    expect(compareValues(2, 10)).toBeLessThan(0);
    expect(compareValues('Água', 'Zebra')).toBeLessThan(0);
    const asc = sortRows(rows, [{ id: 'qty', desc: false }], columns).map((r) => r.qty);
    const desc = sortRows(rows, [{ id: 'qty', desc: true }], columns).map((r) => r.qty);
    expect(asc).toEqual([2.5, 10, 40, null]);
    expect(desc).toEqual([40, 10, 2.5, null]);
  });

  it('várias chaves desempatam pela ordem declarada', () => {
    const out = sortRows(
      rows,
      [
        { id: 'kind', desc: false },
        { id: 'name', desc: true },
      ],
      columns,
    ).map((r) => r.name);
    expect(out).toEqual(['Ronfe', 'Creixomil', 'Azúrem', 'Selho']);
  });

  it('ignora colunas sem valor', () => {
    expect(sortRows(rows, [{ id: 'actions', desc: false }], columns)).toBe(rows);
  });

  it('nextSort: ciclo asc, desc, limpar; Shift acumula', () => {
    let s = nextSort([], 'a', false);
    expect(s).toEqual([{ id: 'a', desc: false }]);
    s = nextSort(s, 'a', false);
    expect(s).toEqual([{ id: 'a', desc: true }]);
    s = nextSort(s, 'a', false);
    expect(s).toEqual([]);
    s = nextSort([{ id: 'a', desc: false }], 'b', true);
    expect(s).toEqual([
      { id: 'a', desc: false },
      { id: 'b', desc: false },
    ]);
    s = nextSort(s, 'a', true);
    expect(s[0]).toEqual({ id: 'a', desc: true });
    expect(nextSort(nextSort(s, 'b', true), 'b', true)).toEqual([{ id: 'a', desc: true }]);
  });
});

describe('colunas', () => {
  it('a principal fica fixa à esquerda por omissão e a ordem do utilizador manda', () => {
    const out = arrangeColumns(columns, ['qty', 'kind'], {}, 'name');
    expect(out.left.map((c) => c.id)).toEqual(['name']);
    expect(out.middle.map((c) => c.id)).toEqual(['qty', 'kind', 'day', 'actions']);
  });

  it('fixar à direita, desafixar a principal', () => {
    const out = arrangeColumns(columns, [], { qty: 'right', name: 'none' }, 'name');
    expect(out.left).toEqual([]);
    expect(out.right.map((c) => c.id)).toEqual(['qty']);
    expect(out.middle[0]?.id).toBe('name');
  });

  it('moveId e moveTo', () => {
    expect(moveId(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveId(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(moveTo(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
    expect(moveTo(['a', 'b', 'c', 'd'], 'd', 'a')).toEqual(['d', 'a', 'b', 'c']);
  });
});

describe('totais e seleção', () => {
  it('aggregate', () => {
    expect(aggregate([1, 2, 3], 'sum')).toBe(6);
    expect(aggregate([1, 2, 3], 'avg')).toBe(2);
    expect(aggregate([4, 2], 'min')).toBe(2);
    expect(aggregate([4, 2], 'max')).toBe(4);
    expect(aggregate([4, 2], 'count')).toBe(2);
    expect(aggregate([], 'sum')).toBeNull();
    expect(aggregate([], 'count')).toBe(0);
  });

  it('idsBetween funciona nos dois sentidos', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    expect(idsBetween(ids, 'b', 'd')).toEqual(['b', 'c', 'd']);
    expect(idsBetween(ids, 'd', 'b')).toEqual(['b', 'c', 'd']);
    expect(idsBetween(ids, 'zz', 'c')).toEqual(['c']);
  });
});

describe('URL', () => {
  it('ida e volta de pesquisa, filtros, ordem e página', () => {
    const state = {
      q: 'ronfe',
      f: {
        kind: { kind: 'facet', values: ['a'], exclude: true },
        qty: { kind: 'range', min: 1, max: 9 },
        day: { kind: 'date', from: '2026-01-01' },
        name: { kind: 'text', op: 'starts', value: 'Az' },
      } as Filters,
      s: [
        { id: 'qty', desc: true },
        { id: 'name', desc: false },
      ],
      p: 2,
    };
    const encoded = encodeUrlState(state);
    expect(encoded).not.toBeNull();
    expect(decodeUrlState(encoded)).toEqual(state);
  });

  it('estado vazio não escreve nada; ordem vazia explícita sim', () => {
    expect(encodeUrlState({})).toBeNull();
    expect(encodeUrlState({ s: [] })).toBe('{"s":[]}');
    expect(decodeUrlState('{"s":[]}').s).toEqual([]);
  });

  it('ignora lixo e valores inválidos', () => {
    expect(decodeUrlState('não é json')).toEqual({});
    expect(decodeUrlState('[1,2]')).toEqual({});
    const out = decodeUrlState(
      JSON.stringify({
        f: { a: { kind: 'bogus' }, b: { kind: 'range', min: 'x', max: 3 } },
        p: -4,
      }),
    );
    expect(out.f).toEqual({ b: { kind: 'range', max: 3 } });
    expect(out.p).toBeUndefined();
  });
});

describe('viewKey', () => {
  it('ignora filtros vazios e a ordem de ocultas', () => {
    const a = viewKey({
      filters: { x: { kind: 'facet', values: [] } },
      hidden: ['b', 'a'],
    });
    const b = viewKey({ hidden: ['a', 'b'] });
    expect(a).toBe(b);
    expect(viewKey({ query: 'x' })).not.toBe(viewKey({}));
  });
});
