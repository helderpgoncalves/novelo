import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { normalizeText } from '@/lib/text';
import { type Column, columnLabel, isFilterable, isSortable, type SortState } from './types';

export const PAGE_SIZES = [10, 25, 50, 100] as const;

interface Persisted {
  hidden?: string[];
  pageSize?: number;
}

const storageKey = (id: string) => `novelo.table.${id}`;

function readPersisted(id: string): Persisted {
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    return raw ? (JSON.parse(raw) as Persisted) : {};
  } catch {
    return {};
  }
}

function writePersisted(id: string, value: Persisted) {
  try {
    window.localStorage.setItem(storageKey(id), JSON.stringify(value));
  } catch {
    // Sem armazenamento (modo privado): a tabela continua a funcionar, só não se lembra das escolhas.
  }
}

const collator = new Intl.Collator('pt-PT', { numeric: true, sensitivity: 'base' });

function compare(a: unknown, b: unknown): number {
  const aNull = a === null || a === undefined || a === '';
  const bNull = b === null || b === undefined || b === '';
  if (aNull || bNull) return aNull === bNull ? 0 : aNull ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

interface Options<T> {
  id: string;
  columns: Column<T>[];
  rows: T[];
  pageSize: number;
  paginate: boolean;
  initialSort?: SortState;
}

/** Todo o estado da tabela (pesquisa, filtros, ordem, colunas, página) e as linhas já tratadas. */
export function useTableState<T>({
  id,
  columns,
  rows,
  pageSize,
  paginate,
  initialSort,
}: Options<T>) {
  const persisted = useMemo(() => readPersisted(id), [id]);
  const [query, setQueryState] = useState('');
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [sort, setSort] = useState<SortState | null>(initialSort ?? null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(
    persisted.pageSize && PAGE_SIZES.some((s) => s === persisted.pageSize)
      ? persisted.pageSize
      : pageSize,
  );
  const [hidden, setHidden] = useState<string[]>(
    () => persisted.hidden ?? columns.filter((c) => c.defaultHidden).map((c) => c.id),
  );
  const deferredQuery = useDeferredValue(query);

  const primaryId = (columns.find((c) => c.primary) ?? columns[0])?.id;
  const visibleColumns = columns.filter((c) => !hidden.includes(c.id) || c.id === primaryId);

  const persist = useCallback(
    (next: Persisted) => writePersisted(id, { hidden, pageSize: size, ...next }),
    [id, hidden, size],
  );

  const setQuery = (value: string) => {
    setQueryState(value);
    setPage(0);
  };
  const setFilter = (columnId: string, values: string[]) => {
    setFilters((prev) => ({ ...prev, [columnId]: values }));
    setPage(0);
  };
  const clearAll = () => {
    setQueryState('');
    setFilters({});
    setPage(0);
  };
  const toggleColumn = (columnId: string, visible: boolean) => {
    const next = visible ? hidden.filter((h) => h !== columnId) : [...hidden, columnId];
    setHidden(next);
    persist({ hidden: next });
  };
  const resetColumns = () => {
    const next = columns.filter((c) => c.defaultHidden).map((c) => c.id);
    setHidden(next);
    persist({ hidden: next });
  };
  const changeSize = (next: number) => {
    setSize(next);
    setPage(0);
    persist({ pageSize: next });
  };
  /** Ciclo do cabeçalho: ascendente, descendente, sem ordem. */
  const cycleSort = (columnId: string) =>
    setSort((prev) =>
      prev?.id !== columnId
        ? { id: columnId, desc: false }
        : prev.desc
          ? null
          : { id: columnId, desc: true },
    );

  const searchable = useMemo(
    () => columns.filter((c) => c.value && c.searchable !== false),
    [columns],
  );
  const haystacks = useMemo(
    () =>
      rows.map((r) => normalizeText(searchable.map((c) => String(c.value?.(r) ?? '')).join(' '))),
    [rows, searchable],
  );

  const filterable = columns.filter(isFilterable);
  const facets = useMemo(() => {
    const out: Record<string, FacetOption[]> = {};
    for (const c of columns.filter(isFilterable)) {
      const format = typeof c.filter === 'object' ? c.filter.format : undefined;
      const counts = new Map<string, number>();
      for (const r of rows) {
        const v = c.value?.(r);
        if (v === null || v === undefined || v === '') continue;
        counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
      }
      out[c.id] = [...counts]
        .map(([value, count]) => ({ value, label: format ? format(value) : value, count }))
        .sort((a, b) => collator.compare(a.label, b.label));
    }
    return out;
  }, [columns, rows]);

  const filtered = useMemo(() => {
    const q = normalizeText(deferredQuery.trim());
    const active = filterable.filter((c) => (filters[c.id]?.length ?? 0) > 0);
    return rows.filter((r, i) => {
      if (q && !haystacks[i]?.includes(q)) return false;
      return active.every((c) => filters[c.id]?.includes(String(c.value?.(r) ?? '')));
    });
  }, [rows, haystacks, deferredQuery, filters, filterable]);

  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.id === sort.id);
    if (!sort || !col || !isSortable(col)) return filtered;
    const dir = sort.desc ? -1 : 1;
    return [...filtered].sort((a, b) => dir * compare(col.value?.(a), col.value?.(b)));
  }, [filtered, sort, columns]);

  const effectiveSize = paginate ? size : Math.max(1, sorted.length);
  const pageCount = Math.max(1, Math.ceil(sorted.length / effectiveSize));
  const pageIndex = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(pageIndex * effectiveSize, (pageIndex + 1) * effectiveSize);
  const filterCount = Object.values(filters).reduce((n, v) => n + v.length, 0);

  return {
    query,
    setQuery,
    filters,
    setFilter,
    clearAll,
    isFiltered: query.trim() !== '' || filterCount > 0,
    filterCount,
    facets,
    sort,
    cycleSort,
    setSort,
    hidden,
    visibleColumns,
    primaryId,
    toggleColumn,
    resetColumns,
    page: pageIndex,
    setPage,
    pageCount,
    size,
    changeSize,
    total: rows.length,
    matched: sorted.length,
    pageRows,
    sortableColumns: columns.filter(isSortable),
    filterableColumns: filterable,
    columnLabel,
  };
}
