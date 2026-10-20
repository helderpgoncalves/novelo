import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeText } from '@/lib/text';
import {
  activeFilters,
  aggregate,
  applyFilters,
  arrangeColumns,
  buildFacet,
  type ColumnMeta,
  decodeUrlState,
  encodeUrlState,
  type FacetOption,
  idsBetween,
  isFilterActive,
  moveId,
  moveTo,
  nextSort,
  numericBounds,
  resolveMeta,
  sortRows,
  urlParam,
  viewKey,
} from './table-logic';
import { type Persisted, readPersisted, writePersisted } from './table-storage';
import {
  type Column,
  columnLabel,
  type Density,
  type Filters,
  type FilterValue,
  isSortable,
  type Pin,
  type SortState,
  type TableView,
  type ViewState,
} from './types';

export const PAGE_SIZES = [10, 25, 50, 100] as const;
/** Tamanho especial: sem páginas, as linhas vão chegando ao rolar. */
export const SCROLL_SIZE = 0;
const CHUNK = 100;
const NO_ORDER: string[] = [];
const NO_PINS: Record<string, Pin | 'none'> = {};
const NO_WIDTHS: Record<string, number> = {};

interface Options<T> {
  id: string;
  columns: Column<T>[];
  rows: T[];
  getId: (row: T, index: number) => string;
  pageSize: number;
  paginate: boolean;
  initialSort?: SortState | SortState[];
  /** Guarda pesquisa, filtros, ordem e página na URL (partilhável). */
  urlSync?: boolean;
  views?: TableView[];
}

const asArray = (s: SortState | SortState[] | undefined): SortState[] =>
  s ? (Array.isArray(s) ? s : [s]) : [];

function readUrl(id: string, enabled: boolean) {
  if (!enabled || typeof window === 'undefined') return {};
  return decodeUrlState(new URLSearchParams(window.location.search).get(urlParam(id)));
}

function writeUrl(id: string, value: string | null) {
  const url = new URL(window.location.href);
  const key = urlParam(id);
  if (value === null) {
    if (!url.searchParams.has(key)) return;
    url.searchParams.delete(key);
  } else {
    if (url.searchParams.get(key) === value) return;
    url.searchParams.set(key, value);
  }
  window.history.replaceState(window.history.state, '', url);
}

/** Todo o estado da tabela (pesquisa, filtros, ordem, colunas, seleção, vistas, página) e as linhas já tratadas. */
export function useTableState<T>({
  id,
  columns,
  rows,
  getId,
  pageSize,
  paginate,
  initialSort,
  urlSync = false,
  views: declaredViews = [],
}: Options<T>) {
  const defaultSort = useMemo(() => asArray(initialSort), [initialSort]);
  const initialUrl = useMemo(() => readUrl(id, urlSync), [id, urlSync]);
  const [prefs, setPrefs] = useState<Persisted>(() => readPersisted(id));
  const [query, setQueryState] = useState(initialUrl.q ?? '');
  const [filters, setFilters] = useState<Filters>(initialUrl.f ?? {});
  const [sort, setSort] = useState<SortState[]>(initialUrl.s ?? defaultSort);
  const [page, setPage] = useState(initialUrl.p ?? 0);
  const [loaded, setLoaded] = useState(CHUNK);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const anchor = useRef<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  const savePrefs = useCallback(
    (patch: Partial<Persisted>) =>
      setPrefs((prev) => {
        const next = { ...prev, ...patch };
        writePersisted(id, next);
        return next;
      }),
    [id],
  );

  const size =
    prefs.pageSize === SCROLL_SIZE || PAGE_SIZES.some((s) => s === prefs.pageSize)
      ? (prefs.pageSize ?? pageSize)
      : pageSize;
  const hidden = prefs.hidden ?? columns.filter((c) => c.defaultHidden).map((c) => c.id);
  const order = prefs.order ?? NO_ORDER;
  const pinned = prefs.pinned ?? NO_PINS;
  const widths = prefs.widths ?? NO_WIDTHS;
  const density: Density = prefs.density ?? 'comfortable';

  const primaryId = (columns.find((c) => c.primary) ?? columns[0])?.id;
  const meta = useMemo(() => resolveMeta(columns, rows), [columns, rows]);

  // Colunas válidas: as que já não existem (ou mudaram de nome) desaparecem dos filtros e da ordem.
  const known = useMemo(() => new Set(columns.map((c) => c.id)), [columns]);

  const arranged = useMemo(
    () => arrangeColumns(columns, order, pinned, primaryId),
    [columns, order, pinned, primaryId],
  );
  const isVisible = (c: Column<T>) => !hidden.includes(c.id) || c.id === primaryId;
  const left = arranged.left.filter(isVisible);
  const middle = arranged.middle.filter(isVisible);
  const right = arranged.right.filter(isVisible);
  const visibleColumns = [...left, ...middle, ...right];
  /** Todas as colunas na ordem do utilizador (fixas primeiro), para o painel de colunas. */
  const orderedColumns = [...arranged.left, ...arranged.middle, ...arranged.right];

  // --- pesquisa e filtros ---------------------------------------------------------------------

  const searchable = useMemo(
    () => columns.filter((c) => c.value && c.searchable !== false),
    [columns],
  );
  const haystacks = useMemo(
    () =>
      rows.map((r) => normalizeText(searchable.map((c) => String(c.value?.(r) ?? '')).join(' '))),
    [rows, searchable],
  );

  const validFilters = useMemo(
    () => Object.fromEntries(Object.entries(filters).filter(([cid]) => known.has(cid))),
    [filters, known],
  );
  const active = useMemo(() => activeFilters(validFilters), [validFilters]);

  const searched = useMemo(() => {
    const q = normalizeText(deferredQuery.trim());
    if (!q) return rows;
    return rows.filter((_, i) => haystacks[i]?.includes(q));
  }, [rows, haystacks, deferredQuery]);

  const filtered = useMemo(
    () => applyFilters(searched, columns, validFilters),
    [searched, columns, validFilters],
  );

  const sortKey = JSON.stringify(sort);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a chave serializada evita reordenar quando só muda a identidade do array
  const sorted = useMemo(() => sortRows(filtered, sort, columns), [filtered, sortKey, columns]);

  /** Opções de uma faceta com contagens que já respeitam a pesquisa e os outros filtros. */
  const facetFor = useCallback(
    (columnId: string): FacetOption[] => {
      const col = columns.find((c) => c.id === columnId);
      if (!col) return [];
      const base = applyFilters(searched, columns, validFilters, columnId);
      const options = buildFacet(base, col, meta[columnId]?.format);
      // Valores já escolhidos mantêm-se na lista mesmo com contagem zero.
      const chosen = validFilters[columnId];
      if (chosen?.kind === 'facet') {
        for (const v of chosen.values) {
          if (!options.some((o) => o.value === v)) {
            options.push({ value: v, label: meta[columnId]?.format?.(v) ?? v, count: 0 });
          }
        }
      }
      return options;
    },
    [columns, searched, validFilters, meta],
  );

  const boundsFor = useCallback(
    (columnId: string) => {
      const col = columns.find((c) => c.id === columnId);
      return col ? numericBounds(rows, col) : null;
    },
    [columns, rows],
  );

  // --- paginação --------------------------------------------------------------------------------

  const scrolling = paginate && size === SCROLL_SIZE;
  const effectiveSize = !paginate || scrolling ? Math.max(1, sorted.length) : size;
  const pageCount = Math.max(1, Math.ceil(sorted.length / effectiveSize));
  const pageIndex = Math.min(page, pageCount - 1);
  const pageRows = scrolling
    ? sorted.slice(0, loaded)
    : sorted.slice(pageIndex * effectiveSize, (pageIndex + 1) * effectiveSize);

  const resetPaging = () => {
    setPage(0);
    setLoaded(CHUNK);
  };

  // --- URL ------------------------------------------------------------------------------------------

  const defaultSortKey = JSON.stringify(defaultSort);
  const urlValue = useMemo(
    () =>
      encodeUrlState({
        q: query.trim() ? query : undefined,
        f: validFilters,
        s: sortKey === defaultSortKey ? undefined : sort,
        p: pageIndex,
      }),
    [query, validFilters, sort, sortKey, defaultSortKey, pageIndex],
  );
  useEffect(() => {
    if (!urlSync) return;
    // Sem dependências a lista: se uma navegação do router apagou o parâmetro, volta a escrevê-lo.
    writeUrl(id, urlValue);
  });
  useEffect(() => {
    if (!urlSync) return;
    return () => writeUrl(id, null);
  }, [id, urlSync]);

  // --- ações -------------------------------------------------------------------------------------------

  const setQuery = (value: string) => {
    setQueryState(value);
    resetPaging();
  };
  const setFilter = (columnId: string, value: FilterValue | null) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value && isFilterActive(value)) next[columnId] = value;
      else delete next[columnId];
      return next;
    });
    resetPaging();
  };
  const clearFilters = () => {
    setFilters({});
    resetPaging();
  };
  const clearAll = () => {
    setQueryState('');
    setFilters({});
    resetPaging();
  };
  const toggleSort = (columnId: string, additive = false) =>
    setSort((prev) => nextSort(prev, columnId, additive));
  const setSortDirection = (columnId: string, desc: boolean | null) =>
    setSort((prev) =>
      desc === null ? prev.filter((s) => s.id !== columnId) : [{ id: columnId, desc }],
    );

  const toggleColumn = (columnId: string, visible: boolean) =>
    savePrefs({ hidden: visible ? hidden.filter((h) => h !== columnId) : [...hidden, columnId] });
  const showAllColumns = () => savePrefs({ hidden: [] });
  const resetColumns = () =>
    savePrefs({
      hidden: columns.filter((c) => c.defaultHidden).map((c) => c.id),
      order: undefined,
      pinned: undefined,
      widths: undefined,
    });

  const fullOrder = (): string[] => orderedColumns.map((c) => c.id);
  const moveColumn = (columnId: string, delta: -1 | 1) =>
    savePrefs({ order: moveId(fullOrder(), columnId, delta) });
  const moveColumnTo = (columnId: string, target: string) =>
    savePrefs({ order: moveTo(fullOrder(), columnId, target) });
  const setPin = (columnId: string, pin: Pin | 'none') =>
    savePrefs({ pinned: { ...pinned, [columnId]: pin } });
  const setWidths = (next: Record<string, number>) => savePrefs({ widths: next });
  const setWidth = (columnId: string, width: number) =>
    savePrefs({ widths: { ...widths, [columnId]: Math.max(64, Math.round(width)) } });
  const resetWidths = () => savePrefs({ widths: undefined });
  const setDensity = (next: Density) => savePrefs({ density: next });
  const changeSize = (next: number) => {
    resetPaging();
    savePrefs({ pageSize: next });
  };
  const loadMore = useCallback(() => setLoaded((n) => n + CHUNK), []);

  // --- seleção -----------------------------------------------------------------------------------------------

  const idMap = useMemo(
    () => new Map(rows.map((r, i) => [r, getId(r, i)] as const)),
    [rows, getId],
  );
  const idOf = useCallback((row: T) => idMap.get(row) ?? getId(row, -1), [idMap, getId]);
  const sortedIds = useMemo(() => sorted.map(idOf), [sorted, idOf]);
  const allIds = useMemo(() => new Set(rows.map(idOf)), [rows, idOf]);
  const liveSelected = useMemo(
    () => new Set([...selected].filter((s) => allIds.has(s))),
    [selected, allIds],
  );
  const selectedRows = useMemo(
    () => rows.filter((r) => liveSelected.has(idOf(r))),
    [rows, liveSelected, idOf],
  );

  /** Marca/desmarca uma linha; com `range` seleciona tudo entre a última marcada e esta (Shift+clique). */
  const toggleRow = (rowId: string, range = false) => {
    const from = anchor.current;
    setSelected((prev) => {
      const next = new Set(prev);
      if (range && from) {
        const turnOn = !prev.has(rowId);
        for (const x of idsBetween(sortedIds, from, rowId)) {
          if (turnOn) next.add(x);
          else next.delete(x);
        }
      } else if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
    anchor.current = rowId;
  };
  const selectIds = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const x of ids) {
        if (on) next.add(x);
        else next.delete(x);
      }
      return next;
    });
  const pageIds = pageRows.map(idOf);
  const selectPage = (on: boolean) => selectIds(pageIds, on);
  const selectAllFiltered = () => selectIds(sortedIds, true);
  const clearSelection = () => setSelected(new Set());
  const toggleExpanded = (rowId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });

  // --- vistas ---------------------------------------------------------------------------------------------------

  const savedViews = prefs.views ?? [];
  const currentView = (): ViewState => ({
    query: query.trim() || undefined,
    filters: validFilters,
    sort,
    hidden,
    order: order.length > 0 ? order : undefined,
    pinned,
  });
  const baseline: ViewState = {
    hidden: columns.filter((c) => c.defaultHidden).map((c) => c.id),
    sort: defaultSort,
  };
  const currentKey = viewKey({ ...currentView(), order: normalizedOrder(order, columns) });
  const allViews = [...declaredViews, ...savedViews];
  const activeView =
    allViews.find(
      (v) =>
        viewKey({
          ...baseline,
          ...v.state,
          order: normalizedOrder(v.state.order ?? [], columns),
        }) === currentKey,
    ) ?? (currentKey === viewKey({ ...baseline, order: [] }) ? null : undefined);

  const applyView = (view: ViewState) => {
    setQueryState(view.query ?? '');
    setFilters(view.filters ?? {});
    setSort(view.sort ?? defaultSort);
    resetPaging();
    savePrefs({
      hidden: view.hidden ?? columns.filter((c) => c.defaultHidden).map((c) => c.id),
      order: view.order,
      pinned: view.pinned,
    });
  };
  const resetView = () => applyView(baseline);
  const saveView = (label: string) => {
    const view: TableView = { id: `v${Date.now().toString(36)}`, label, state: currentView() };
    savePrefs({ views: [...savedViews, view] });
    return view;
  };
  const deleteView = (viewId: string) =>
    savePrefs({ views: savedViews.filter((v) => v.id !== viewId) });

  // --- totais ------------------------------------------------------------------------------------------------------

  const totals = useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const c of columns) {
      if (!c.aggregate || !c.value) continue;
      const values = sorted
        .map((r) => c.value?.(r))
        .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
      out[c.id] = aggregate(values, c.aggregate);
    }
    return out;
  }, [columns, sorted]);

  const filterableColumns = columns.filter((c) => meta[c.id]?.kind);

  return {
    meta: meta as Record<string, ColumnMeta>,
    query,
    setQuery,
    filters: validFilters,
    activeFilters: active,
    setFilter,
    clearFilters,
    clearAll,
    isFiltered: query.trim() !== '' || active.length > 0,
    filterCount: active.length,
    filterableColumns,
    facetFor,
    boundsFor,
    sort,
    toggleSort,
    setSort,
    setSortDirection,
    sortableColumns: columns.filter(isSortable),
    hidden,
    visibleColumns,
    pinnedLeft: left,
    pinnedRight: right,
    unpinned: middle,
    orderedColumns,
    primaryId,
    toggleColumn,
    showAllColumns,
    resetColumns,
    moveColumn,
    moveColumnTo,
    setPin,
    widths,
    setWidth,
    setWidths,
    resetWidths,
    density,
    setDensity,
    page: pageIndex,
    setPage,
    pageCount,
    size,
    changeSize,
    scrolling,
    loadMore,
    hasMore: scrolling && loaded < sorted.length,
    total: rows.length,
    matched: sorted.length,
    sortedRows: sorted,
    pageRows,
    idOf,
    selected: liveSelected,
    selectedRows,
    toggleRow,
    selectPage,
    selectIds,
    selectAllFiltered,
    clearSelection,
    pageIds,
    expanded,
    toggleExpanded,
    savedViews,
    allViews,
    activeView,
    applyView,
    resetView,
    saveView,
    deleteView,
    totals,
    columnLabel,
  };
}

/** Uma ordem igual à declarada equivale a "sem ordem" (para comparar vistas). */
function normalizedOrder<T>(order: string[], columns: Column<T>[]): string[] {
  const declared = columns.map((c) => c.id);
  const complete = [
    ...order.filter((x) => declared.includes(x)),
    ...declared.filter((x) => !order.includes(x)),
  ];
  return complete.join('|') === declared.join('|') ? [] : complete;
}

export type TableState<T> = ReturnType<typeof useTableState<T>>;
