import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Column } from './types';
import { useTableState } from './use-table-state';

interface Row {
  id: string;
  name: string;
  kind: string;
  qty: number;
}

const rows: Row[] = Array.from({ length: 30 }, (_, i) => ({
  id: `r${i}`,
  name: i === 4 ? 'Azúrem' : `Linha ${i}`,
  kind: i % 3 === 0 ? 'a' : 'b',
  qty: i,
}));

const columns: Column<Row>[] = [
  { id: 'name', header: 'Nome', cell: (r) => r.name, value: (r) => r.name, primary: true },
  { id: 'kind', header: 'Tipo', cell: (r) => r.kind, value: (r) => r.kind, filter: true },
  { id: 'qty', header: 'Qtd', cell: (r) => r.qty, value: (r) => r.qty, aggregate: 'sum' },
  { id: 'extra', header: 'Extra', cell: () => 'x', value: () => 'x', defaultHidden: true },
];

const setup = (props: Partial<Parameters<typeof useTableState<Row>>[0]> = {}) =>
  renderHook(() =>
    useTableState<Row>({
      id: 'test',
      columns,
      rows,
      getId: (r) => r.id,
      pageSize: 10,
      paginate: true,
      ...props,
    }),
  );

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('useTableState', () => {
  it('pagina, pesquisa sem acentos e volta à primeira página', () => {
    const { result } = setup();
    expect(result.current.pageRows).toHaveLength(10);
    expect(result.current.matched).toBe(30);
    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);
    act(() => result.current.setQuery('azurem'));
    expect(result.current.page).toBe(0);
    expect(result.current.matched).toBe(1);
    expect(result.current.isFiltered).toBe(true);
    act(() => result.current.clearAll());
    expect(result.current.matched).toBe(30);
  });

  it('filtros por faceta e intervalo, com contagens que respeitam os outros filtros', () => {
    const { result } = setup();
    act(() => result.current.setFilter('kind', { kind: 'facet', values: ['a'] }));
    expect(result.current.matched).toBe(10);
    act(() => result.current.setFilter('qty', { kind: 'range', min: 10 }));
    expect(result.current.matched).toBe(6); // 12, 15, 18, 21, 24, 27
    // a faceta "kind" ignora o seu próprio filtro mas respeita o de qty
    const facet = result.current.facetFor('kind');
    expect(facet.find((o) => o.value === 'b')?.count).toBe(14);
    expect(result.current.filterCount).toBe(2);
    act(() => result.current.setFilter('kind', null));
    expect(result.current.filterCount).toBe(1);
  });

  it('ordenação múltipla com Shift e totais sobre o filtrado', () => {
    const { result } = setup();
    act(() => result.current.toggleSort('kind'));
    act(() => result.current.toggleSort('qty', true));
    act(() => result.current.toggleSort('qty', true));
    expect(result.current.sort).toEqual([
      { id: 'kind', desc: false },
      { id: 'qty', desc: true },
    ]);
    expect(result.current.sortedRows[0]?.qty).toBe(27);
    act(() => result.current.setFilter('kind', { kind: 'facet', values: ['a'] }));
    expect(result.current.totals.qty).toBe(0 + 3 + 6 + 9 + 12 + 15 + 18 + 21 + 24 + 27);
  });

  it('colunas: escondidas por omissão, mostrar, reordenar e fixar; a principal nunca se esconde', () => {
    const { result } = setup();
    expect(result.current.visibleColumns.map((c) => c.id)).toEqual(['name', 'kind', 'qty']);
    act(() => result.current.toggleColumn('extra', true));
    expect(result.current.visibleColumns.map((c) => c.id)).toContain('extra');
    act(() => result.current.toggleColumn('name', false));
    expect(result.current.visibleColumns.map((c) => c.id)).toContain('name');
    act(() => result.current.moveColumn('qty', -1));
    expect(result.current.visibleColumns.map((c) => c.id).slice(0, 3)).toEqual([
      'name',
      'qty',
      'kind',
    ]);
    act(() => result.current.setPin('kind', 'right'));
    expect(result.current.visibleColumns.at(-1)?.id).toBe('kind');
    act(() => result.current.resetColumns());
    expect(result.current.visibleColumns.map((c) => c.id)).toEqual(['name', 'kind', 'qty']);
  });

  it('lembra colunas, densidade e linhas por página entre montagens', () => {
    const first = setup();
    act(() => first.result.current.toggleColumn('extra', true));
    act(() => first.result.current.setDensity('compact'));
    act(() => first.result.current.changeSize(25));
    first.unmount();
    const second = setup();
    expect(second.result.current.density).toBe('compact');
    expect(second.result.current.size).toBe(25);
    expect(second.result.current.visibleColumns.map((c) => c.id)).toContain('extra');
  });

  it('seleção: marcar, intervalo com Shift, página, todas as filtradas e limpar', () => {
    const { result } = setup();
    act(() => result.current.toggleRow('r1'));
    act(() => result.current.toggleRow('r4', true));
    expect([...result.current.selected].sort()).toEqual(['r1', 'r2', 'r3', 'r4']);
    act(() => result.current.selectPage(true));
    expect(result.current.selected.size).toBe(10);
    act(() => result.current.selectAllFiltered());
    expect(result.current.selected.size).toBe(30);
    expect(result.current.selectedRows).toHaveLength(30);
    act(() => result.current.clearSelection());
    expect(result.current.selected.size).toBe(0);
  });

  it('a seleção sobrevive a filtros e descarta linhas que desapareceram', () => {
    const { result, rerender } = renderHook(
      ({ data }) =>
        useTableState<Row>({
          id: 'sel',
          columns,
          rows: data,
          getId: (r) => r.id,
          pageSize: 10,
          paginate: true,
        }),
      { initialProps: { data: rows } },
    );
    act(() => result.current.toggleRow('r1'));
    act(() => result.current.setQuery('azurem'));
    expect(result.current.selected.has('r1')).toBe(true);
    rerender({ data: rows.filter((r) => r.id !== 'r1') });
    expect(result.current.selected.has('r1')).toBe(false);
  });

  it('rolagem contínua mostra por blocos', () => {
    const many = Array.from({ length: 250 }, (_, i) => ({
      id: `m${i}`,
      name: `N${i}`,
      kind: 'a',
      qty: i,
    }));
    const { result } = setup({ rows: many });
    act(() => result.current.changeSize(0));
    expect(result.current.scrolling).toBe(true);
    expect(result.current.pageRows).toHaveLength(100);
    expect(result.current.hasMore).toBe(true);
    act(() => result.current.loadMore());
    act(() => result.current.loadMore());
    expect(result.current.pageRows).toHaveLength(250);
    expect(result.current.hasMore).toBe(false);
  });

  it('URL: escreve o estado, lê-o ao montar e limpa-o ao desmontar', () => {
    const first = setup({ urlSync: true });
    act(() => first.result.current.setQuery('azurem'));
    act(() => first.result.current.toggleSort('qty'));
    expect(window.location.search).toContain('t.test=');
    const url = window.location.href;
    first.unmount();
    expect(window.location.search).toBe('');

    window.history.replaceState(null, '', url);
    const second = setup({ urlSync: true });
    expect(second.result.current.query).toBe('azurem');
    expect(second.result.current.sort).toEqual([{ id: 'qty', desc: false }]);
    expect(second.result.current.matched).toBe(1);
  });

  it('URL: a ordem inicial não suja a URL e limpá-la fica explícito', () => {
    const { result } = setup({ urlSync: true, initialSort: { id: 'qty', desc: true } });
    expect(window.location.search).toBe('');
    act(() => result.current.toggleSort('qty')); // desc -> sem ordem
    expect(result.current.sort).toEqual([]);
    expect(window.location.search).toContain('t.test=');
  });

  it('vistas: guardar, aplicar, reconhecer a ativa e apagar', () => {
    const { result } = setup();
    act(() => result.current.setFilter('kind', { kind: 'facet', values: ['a'] }));
    act(() => result.current.toggleSort('qty'));
    let id = '';
    act(() => {
      id = result.current.saveView('Só A').id;
    });
    expect(result.current.activeView?.id).toBe(id);
    act(() => result.current.resetView());
    expect(result.current.matched).toBe(30);
    expect(result.current.activeView).toBeNull();
    act(() => result.current.applyView(result.current.savedViews[0]?.state ?? {}));
    expect(result.current.matched).toBe(10);
    expect(result.current.activeView?.id).toBe(id);
    act(() => result.current.setQuery('linha'));
    expect(result.current.activeView).toBeUndefined();
    act(() => result.current.deleteView(id));
    expect(result.current.savedViews).toHaveLength(0);
  });

  it('vistas declaradas aparecem sem as guardar', () => {
    const { result } = setup({
      views: [
        {
          id: 'a-only',
          label: 'Só A',
          state: { filters: { kind: { kind: 'facet', values: ['a'] } } },
        },
      ],
    });
    expect(result.current.allViews).toHaveLength(1);
    act(() => result.current.applyView(result.current.allViews[0]?.state ?? {}));
    expect(result.current.matched).toBe(10);
    expect(result.current.activeView?.id).toBe('a-only');
  });
});
