import { ChevronRight } from 'lucide-react';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatNumber } from '@/lib/format';
import { getLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { ColumnHeader } from './column-header';
import {
  DEFAULT_EXPORT_PREFS,
  type ExportFormat,
  type ExportPrefs,
  runExport,
  toExportColumns,
} from './export';
import { ExportMenu } from './export-menu';
import { MobileList } from './mobile-list';
import { TablePagination } from './pagination';
import { RowActionsMenu } from './row-actions';
import { SelectionBar } from './selection-bar';
import { sortRows } from './table-logic';
import { SkeletonCards, SkeletonRows, TableEmpty, TableError, TableNoMatch } from './table-states';
import { EXPORT_KEY, readJson, writeJson } from './table-storage';
import { TableToolbar } from './toolbar';
import {
  type BulkAction,
  type CellValue,
  type Column,
  columnLabel,
  type RowAction,
  type SortState,
  type TableView,
} from './types';
import { PAGE_SIZES, useTableState } from './use-table-state';

export type { BulkAction, Column, RowAction, TableView } from './types';

/** Abaixo deste número de linhas a barra de ferramentas não compensa o espaço que ocupa. */
const AUTO_CONTROLS_MIN_ROWS = 8;
const SELECT_W = 44;
const EXPAND_W = 40;
const ACTIONS_W = 52;
const DEFAULT_COL_W = 160;
const MIN_COL_W = 72;

const ROW_HOVER = 'hover:bg-[color-mix(in_oklab,var(--card),var(--muted)_55%)]';
const STICKY_BG =
  'bg-card group-hover/row:bg-[color-mix(in_oklab,var(--card),var(--muted)_55%)] group-data-[state=selected]/row:bg-[color-mix(in_oklab,var(--card),var(--primary)_9%)]';

export interface DataTableProps<T> {
  /** Identifica a tabela para lembrar colunas, ordem, larguras, densidade, vistas e linhas por página. */
  id: string;
  columns: Column<T>[];
  rows: T[];
  /** Identificador estável de cada linha (seleção, expansão, exportação). */
  getRowId?: (row: T) => string;
  /** @deprecated use `getRowId`. */
  getKey?: (row: T) => string;
  /** Mostrado, em vez do cartão, quando não há dados de todo. */
  empty?: ReactNode;
  className?: string;
  caption?: string;
  /** Título do cartão (com a contagem ao lado). */
  title?: ReactNode;
  /** `auto` mostra a barra de ferramentas só quando a tabela é grande o suficiente. */
  controls?: 'auto' | 'always' | 'never';
  /** Sem altura máxima no ecrã largo: tabelas curtas (ex.: um top 10) mostram-se inteiras, sem scroll interno. */
  unbounded?: boolean;
  pageSize?: number;
  initialSort?: SortState | SortState[];
  searchLabel?: string;
  /** A carregar pela primeira vez: mostra linhas de esqueleto. */
  loading?: boolean;
  /** A atualizar em segundo plano (ex.: `isFetching`): barra fina no topo. */
  refreshing?: boolean;
  /** Erro ao carregar; mostra a mensagem dentro do cartão. */
  error?: unknown;
  onRetry?: () => void;
  /** Ações por linha, no menu "⋯". */
  rowActions?: (row: T) => RowAction<T>[];
  /** Ações sobre as linhas selecionadas. Ativam a seleção. */
  bulkActions?: BulkAction<T>[];
  /** Linhas selecionáveis; por omissão acontece quando a barra de ferramentas aparece. */
  selectable?: boolean;
  /** Vistas predefinidas (pesquisa, filtros, ordem, colunas) além das que o utilizador guarda. */
  views?: TableView[];
  /** Conteúdo extra por baixo da linha, aberto por uma seta. */
  renderExpanded?: (row: T) => ReactNode;
  /** Botões extra na barra de ferramentas. */
  actions?: ReactNode;
  /** Nome base dos ficheiros exportados (por omissão o `id`). */
  exportName?: string;
  /** Guarda pesquisa, filtros e ordem na URL (`?t.<id>=`). Por omissão, quando a barra aparece. */
  urlSync?: boolean;
}

/** Mantém as colunas estáveis entre renders; os `cell` continuam a ser os mais recentes (ver `fresh`). */
function useStableColumns<T>(columns: Column<T>[], rows: T[]): Column<T>[] {
  const key = `${getLocale()}|${columns
    .map(
      (c) =>
        `${c.id}:${typeof c.filter === 'object' ? 'o' : String(c.filter)}:${c.type ?? ''}:${c.defaultHidden ? 1 : 0}`,
    )
    .join('|')}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a chave resume o que importa nas colunas
  return useMemo(() => columns, [key, rows]);
}

const isEditable = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
};

/**
 * A mesma tabela em todo o produto, num só cartão: pesquisa, filtros (facetas, intervalos, datas, texto),
 * vistas, colunas (ordem, fixar, largura), densidade, exportação (CSV, XLSX, JSON, cópia), seleção com
 * ações em massa, teclado e paginação; em telemóvel passa a lista de cartões com uma folha de controlos.
 */
export function DataTable<T>({
  id,
  columns,
  rows,
  getRowId,
  getKey,
  empty,
  className,
  caption,
  title,
  controls = 'auto',
  unbounded = false,
  pageSize = 10,
  initialSort,
  searchLabel,
  loading = false,
  refreshing = false,
  error,
  onRetry,
  rowActions,
  bulkActions,
  selectable,
  views,
  renderExpanded,
  actions,
  exportName,
  urlSync,
}: DataTableProps<T>) {
  const paginate = controls !== 'never';
  const showControls =
    controls === 'always' || (controls === 'auto' && rows.length > AUTO_CONTROLS_MIN_ROWS);
  const hasError = error !== undefined && error !== null && error !== false;

  const idFn = getRowId ?? getKey;
  const idRef = useRef(idFn);
  idRef.current = idFn;
  const getId = useCallback((row: T, index: number) => idRef.current?.(row) ?? String(index), []);

  const stable = useStableColumns(columns, rows);
  const fresh = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);
  const state = useTableState({
    id,
    columns: stable,
    rows,
    getId,
    pageSize,
    paginate,
    initialSort,
    urlSync: urlSync ?? showControls,
    views,
  });

  const isSelectable = selectable ?? ((bulkActions?.length ?? 0) > 0 || showControls);
  const visible = state.visibleColumns.map((c) => fresh.get(c.id) ?? c);
  const primary = visible.find((c) => c.primary) ?? visible[0];
  const pinnedLeftIds = new Set(state.pinnedLeft.map((c) => c.id));
  const pinnedRightIds = new Set(state.pinnedRight.map((c) => c.id));
  const hasActions = !!rowActions;
  const hasExpand = !!renderExpanded;
  const utilityLeft = (isSelectable ? SELECT_W : 0) + (hasExpand ? EXPAND_W : 0);
  const compact = state.density === 'compact';

  const cardRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [measured, setMeasured] = useState<Record<string, number>>({});
  const [live, setLive] = useState<{ id: string; width: number } | null>(null);
  const [scrolledX, setScrolledX] = useState(false);
  const [activeRow, setActiveRow] = useState(0);

  const fixedLayout = Object.keys(state.widths).length > 0;
  const widthOf = (c: Column<T>): number =>
    live?.id === c.id ? live.width : (state.widths[c.id] ?? c.width ?? DEFAULT_COL_W);

  // --- medir as colunas fixas para os deslocamentos `sticky` -----------------------------------------

  const layoutKey = `${visible.map((c) => c.id).join()}|${JSON.stringify(state.widths)}|${state.density}|${live?.width ?? ''}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a chave resume o que muda a geometria
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const measure = () => {
      const next: Record<string, number> = {};
      for (const th of table.querySelectorAll<HTMLElement>('th[data-col-id]')) {
        next[th.dataset.colId ?? ''] = th.offsetWidth;
      }
      setMeasured((prev) => {
        const same =
          Object.keys(next).length === Object.keys(prev).length &&
          Object.entries(next).every(([k, v]) => prev[k] === v);
        return same ? prev : next;
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(table);
    return () => observer.disconnect();
  }, [layoutKey]);

  const leftOffset = (c: Column<T>): number => {
    let offset = utilityLeft;
    for (const l of state.pinnedLeft) {
      if (l.id === c.id) break;
      offset += measured[l.id] ?? widthOf(l);
    }
    return offset;
  };
  const rightOffset = (c: Column<T>): number => {
    let offset = hasActions ? ACTIONS_W : 0;
    for (const r of [...state.pinnedRight].reverse()) {
      if (r.id === c.id) break;
      offset += measured[r.id] ?? widthOf(r);
    }
    return offset;
  };
  const lastLeftId = state.pinnedLeft.filter((c) => visible.some((v) => v.id === c.id)).at(-1)?.id;
  const firstRightId = state.pinnedRight.find((c) => visible.some((v) => v.id === c.id))?.id;

  // --- redimensionar --------------------------------------------------------------------------------------

  /** Congela as larguras atuais de todas as colunas para a tabela passar a layout fixo sem saltar. */
  const freezeWidths = (): Record<string, number> => {
    if (fixedLayout) return state.widths;
    const frozen = Object.fromEntries(visible.map((c) => [c.id, measured[c.id] ?? DEFAULT_COL_W]));
    state.setWidths(frozen);
    return frozen;
  };
  const startResize = (e: ReactPointerEvent<HTMLElement>, c: Column<T>) => {
    e.preventDefault();
    e.stopPropagation();
    const frozen = freezeWidths();
    const startW = frozen[c.id] ?? measured[c.id] ?? DEFAULT_COL_W;
    const startX = e.clientX;
    let latest = startW;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      latest = Math.max(MIN_COL_W, Math.round(startW + ev.clientX - startX));
      setLive({ id: c.id, width: latest });
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      state.setWidths({ ...frozen, [c.id]: latest });
      setLive(null);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };
  const resizeByKey = (e: ReactKeyboardEvent<HTMLElement>, c: Column<T>) => {
    const step = e.shiftKey ? 40 : 10;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const frozen = freezeWidths();
      const current = frozen[c.id] ?? DEFAULT_COL_W;
      state.setWidths({
        ...frozen,
        [c.id]: Math.max(MIN_COL_W, current + (e.key === 'ArrowLeft' ? -step : step)),
      });
    } else if (e.key === 'Enter' || e.key === 'Delete') {
      e.preventDefault();
      resetWidth(c.id);
    }
  };
  const resizeBy = (c: Column<T>, delta: number) => {
    const frozen = freezeWidths();
    state.setWidths({
      ...frozen,
      [c.id]: Math.max(MIN_COL_W, (frozen[c.id] ?? measured[c.id] ?? DEFAULT_COL_W) + delta),
    });
  };
  const resetWidth = (columnId: string) => {
    const { [columnId]: _removed, ...rest } = state.widths;
    state.setWidths(rest);
  };

  // --- atalhos e rolagem infinita ---------------------------------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || isEditable(e.target)) return;
      const cards = [...document.querySelectorAll<HTMLElement>('[data-table-card]')].filter(
        (el) => el.offsetParent !== null,
      );
      const mine =
        cards.find((el) => el.contains(document.activeElement) || el.matches(':hover')) ?? cards[0];
      if (mine !== cardRef.current) return;
      const input = searchRef.current;
      if (input && input.offsetParent !== null) {
        e.preventDefault();
        input.focus();
        input.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { hasMore, loadMore } = state;
  useEffect(() => {
    if (!hasMore) return;
    const sentinels = cardRef.current?.querySelectorAll('[data-sentinel]');
    if (!sentinels?.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((en) => en.isIntersecting)) loadMore();
      },
      { rootMargin: '240px' },
    );
    for (const s of sentinels) observer.observe(s);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  // --- exportar ---------------------------------------------------------------------------------------------------

  const [exportPrefs, setExportPrefs] = useState<ExportPrefs>(() =>
    readJson(EXPORT_KEY, DEFAULT_EXPORT_PREFS),
  );
  const updateExportPrefs = (next: ExportPrefs) => {
    setExportPrefs(next);
    writeJson(EXPORT_KEY, next);
  };
  const doExport = async (format: ExportFormat, prefs: ExportPrefs) => {
    const data =
      prefs.scope === 'all'
        ? rows
        : prefs.scope === 'selected'
          ? sortRows(state.selectedRows, state.sort, stable)
          : state.sortedRows;
    const cols = prefs.columns === 'all' ? state.orderedColumns : state.visibleColumns;
    const types = Object.fromEntries(Object.entries(state.meta).map(([k, v]) => [k, v.type]));
    try {
      const result = await runExport({
        format,
        columns: toExportColumns(cols, columnLabel, types),
        rows: data,
        prefs,
        baseName: exportName ?? id,
        sheetName: exportName ?? id,
      });
      toast.success(
        result.filename
          ? m.dt_export_done({ n: formatNumber(result.rows), file: result.filename })
          : m.dt_export_copied({ n: formatNumber(result.rows) }),
      );
    } catch {
      toast.error(m.dt_export_failed());
    }
  };
  const exportMenu = (
    <ExportMenu
      prefs={exportPrefs}
      onPrefs={updateExportPrefs}
      counts={{ filtered: state.matched, all: state.total, selected: state.selected.size }}
      onExport={doExport}
    />
  );
  const exportSelection = (
    <ExportMenu
      selectionOnly
      prefs={exportPrefs}
      onPrefs={updateExportPrefs}
      counts={{ filtered: state.matched, all: state.total, selected: state.selected.size }}
      onExport={doExport}
      trigger={
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 font-medium text-sm shadow-xs hover:bg-accent"
        >
          {m.dt_export_selection()}
        </button>
      }
    />
  );

  // --- estados antes da tabela -------------------------------------------------------------------------------------

  if (rows.length === 0 && empty && !loading && !hasError) return <>{empty}</>;

  const rowLabel = (row: T): string => String(primary?.value?.(row) ?? '');
  const pageRows = state.pageRows;
  const isEmptyAll = !loading && !hasError && rows.length === 0;
  const isNoMatch = !loading && !hasError && rows.length > 0 && state.matched === 0;
  const hasBody = !loading && !hasError && !isEmptyAll && !isNoMatch;
  const allPageSelected =
    state.pageIds.length > 0 && state.pageIds.every((x) => state.selected.has(x));
  const somePageSelected = state.pageIds.some((x) => state.selected.has(x));
  const footerRow = visible.some((c) => c.aggregate);
  const utilityCols = (isSelectable ? 1 : 0) + (hasExpand ? 1 : 0) + (hasActions ? 1 : 0);
  const colCount = visible.length + utilityCols;
  const showFooter =
    paginate && rows.length > PAGE_SIZES[0] && !loading && !hasError && !isEmptyAll;

  const onRowKeyDown = (
    e: ReactKeyboardEvent<HTMLTableRowElement>,
    index: number,
    rowId: string,
  ) => {
    if (e.target !== e.currentTarget) return;
    const focusRow = (i: number) => {
      const next = Math.max(0, Math.min(pageRows.length - 1, i));
      setActiveRow(next);
      tableRef.current?.querySelector<HTMLElement>(`tr[data-row-index="${next}"]`)?.focus();
    };
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault();
        const next = index + (e.key === 'ArrowDown' ? 1 : -1);
        const nextRow = pageRows[next];
        if (e.shiftKey && isSelectable && nextRow) {
          state.selectIds([rowId, state.idOf(nextRow)], true);
        }
        focusRow(next);
        break;
      }
      case 'Home':
        e.preventDefault();
        focusRow(0);
        break;
      case 'End':
        e.preventDefault();
        focusRow(pageRows.length - 1);
        break;
      case 'PageDown':
        e.preventDefault();
        focusRow(index + 10);
        break;
      case 'PageUp':
        e.preventDefault();
        focusRow(index - 10);
        break;
      case ' ':
        if (isSelectable) {
          e.preventDefault();
          state.toggleRow(rowId, e.shiftKey);
        }
        break;
      case 'Enter': {
        if (hasExpand) {
          e.preventDefault();
          state.toggleExpanded(rowId);
        } else {
          e.currentTarget.querySelector<HTMLElement>('a[href], button')?.click();
        }
        break;
      }
      case 'Escape':
        if (state.selected.size > 0) {
          e.preventDefault();
          state.clearSelection();
        }
        break;
      case 'a':
      case 'A':
        if ((e.ctrlKey || e.metaKey) && isSelectable) {
          e.preventDefault();
          state.selectAllFiltered();
        }
        break;
    }
  };

  const cellPadding = compact ? 'px-3 py-1.5 text-[13px] leading-5' : 'px-3 py-3';
  const stickyHead = 'sticky top-0 bg-card';

  const headerCell = (c: Column<T>) => {
    const side = pinnedLeftIds.has(c.id) ? 'left' : pinnedRightIds.has(c.id) ? 'right' : null;
    const sort = state.sort.find((s) => s.id === c.id);
    const style =
      side === 'left'
        ? { left: leftOffset(c) }
        : side === 'right'
          ? { right: rightOffset(c) }
          : undefined;
    return (
      <TableHead
        key={c.id}
        data-col-id={c.id}
        data-edge={c.id === lastLeftId ? 'left' : c.id === firstRightId ? 'right' : undefined}
        aria-sort={sort ? (sort.desc ? 'descending' : 'ascending') : undefined}
        style={style}
        className={cn(
          stickyHead,
          'h-10 px-3 text-[13px]',
          side ? 'z-30' : 'z-20',
          c.align === 'right' && 'text-right',
        )}
      >
        <ColumnHeader
          column={c}
          state={state}
          hasWidth={state.widths[c.id] !== undefined}
          truncate={fixedLayout}
          onResizeBy={c.resizable === false ? undefined : (delta) => resizeBy(c, delta)}
          onResetWidth={() => resetWidth(c.id)}
        />
        {c.resizable !== false && (
          // biome-ignore lint/a11y/useSemanticElements: o separador de colunas é interativo (arrastar e teclado), <hr> não serve
          <div
            role="separator"
            aria-orientation="vertical"
            tabIndex={-1}
            aria-label={m.dt_resize_column({ column: columnLabel(c) })}
            aria-valuenow={Math.round(fixedLayout ? widthOf(c) : (measured[c.id] ?? widthOf(c)))}
            aria-valuemin={MIN_COL_W}
            onPointerDown={(e) => startResize(e, c)}
            onKeyDown={(e) => resizeByKey(e, c)}
            onDoubleClick={() => resetWidth(c.id)}
            className="absolute inset-y-0 -right-1 z-10 flex w-2 cursor-col-resize touch-none justify-center outline-none after:h-full after:w-px after:bg-transparent hover:after:bg-primary/40 focus-visible:after:w-0.5 focus-visible:after:bg-primary"
          />
        )}
      </TableHead>
    );
  };

  const bodyCell = (c: Column<T>, row: T) => {
    const side = pinnedLeftIds.has(c.id) ? 'left' : pinnedRightIds.has(c.id) ? 'right' : null;
    const style =
      side === 'left'
        ? { left: leftOffset(c) }
        : side === 'right'
          ? { right: rightOffset(c) }
          : undefined;
    return (
      <TableCell
        key={c.id}
        data-edge={c.id === lastLeftId ? 'left' : c.id === firstRightId ? 'right' : undefined}
        style={style}
        className={cn(
          cellPadding,
          c.id === primary?.id && 'font-medium',
          side && cn('sticky z-10', STICKY_BG),
          fixedLayout && 'overflow-hidden text-ellipsis',
          c.align === 'right' && 'text-right tabular-nums',
          c.className,
        )}
      >
        {c.cell(row)}
      </TableCell>
    );
  };

  const renderRow = (row: T, index: number) => {
    const rowId = state.idOf(row);
    const selected = state.selected.has(rowId);
    const open = state.expanded.has(rowId);
    const label = rowLabel(row);
    const rowOffset = state.page * state.size + index;
    return [
      <TableRow
        key={rowId}
        data-row-index={index}
        data-state={selected ? 'selected' : undefined}
        tabIndex={index === Math.min(activeRow, pageRows.length - 1) ? 0 : -1}
        onFocus={(e) => {
          if (e.target === e.currentTarget) setActiveRow(index);
        }}
        onKeyDown={(e) => onRowKeyDown(e, index, rowId)}
        aria-rowindex={(state.scrolling ? index : rowOffset) + 2}
        className={cn(
          'group/row align-top outline-none focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring',
          ROW_HOVER,
          'data-[state=selected]:bg-[color-mix(in_oklab,var(--card),var(--primary)_9%)]',
        )}
      >
        {isSelectable && (
          <TableCell
            className={cn('sticky left-0 z-10 w-11 pr-0 pl-4', cellPadding, STICKY_BG)}
            style={{ width: SELECT_W, minWidth: SELECT_W, left: 0 }}
          >
            <Checkbox
              checked={selected}
              onClick={(e) => {
                if (e.shiftKey) {
                  e.preventDefault();
                  state.toggleRow(rowId, true);
                }
              }}
              onCheckedChange={() => state.toggleRow(rowId)}
              aria-label={m.dt_select_row({ row: label })}
            />
          </TableCell>
        )}
        {hasExpand && (
          <TableCell
            className={cn('sticky z-10 px-0', cellPadding, STICKY_BG)}
            style={{ width: EXPAND_W, minWidth: EXPAND_W, left: isSelectable ? SELECT_W : 0 }}
          >
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`${id}-exp-${rowId}`}
              aria-label={m.dt_expand_row({ row: label })}
              onClick={() => state.toggleExpanded(rowId)}
              className="mx-auto flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            >
              <ChevronRight className={cn('size-4 transition-transform', open && 'rotate-90')} />
            </button>
          </TableCell>
        )}
        {visible.map((c) => bodyCell(c, row))}
        {hasActions && (
          <TableCell
            className={cn('sticky right-0 z-10 px-1', cellPadding, STICKY_BG)}
            style={{ width: ACTIONS_W, minWidth: ACTIONS_W, right: 0 }}
          >
            <RowActionsMenu row={row} actions={rowActions?.(row) ?? []} label={label} />
          </TableCell>
        )}
      </TableRow>,
      open && renderExpanded && (
        <TableRow key={`${rowId}-exp`} className="bg-muted/30 hover:bg-muted/30">
          <TableCell id={`${id}-exp-${rowId}`} colSpan={colCount} className="whitespace-normal p-4">
            {renderExpanded(row)}
          </TableCell>
        </TableRow>
      ),
    ];
  };

  const aggregateCell = (c: Column<T>, i: number) => {
    const total = state.totals[c.id];
    const text =
      total === null || total === undefined
        ? ''
        : c.format
          ? c.format(total)
          : formatNumber(total, 1);
    return (
      <TableCell
        key={c.id}
        className={cn(
          cellPadding,
          'bg-muted/60 font-medium tabular-nums',
          c.align === 'right' && 'text-right',
        )}
      >
        {i === 0 && (
          <span className="mr-2 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
            {m.dt_total()}
          </span>
        )}
        {c.aggregate && text && (
          <>
            {c.aggregate !== 'sum' && (
              <span className="mr-1 text-muted-foreground text-xs">
                {aggregateLabel[c.aggregate]()}
              </span>
            )}
            {text}
          </>
        )}
      </TableCell>
    );
  };

  return (
    <section
      ref={cardRef}
      data-table-card
      data-table-id={id}
      aria-label={caption}
      aria-busy={loading || refreshing}
      className={cn(
        'relative overflow-clip rounded-xl bg-card ring-1 ring-foreground/10',
        className,
      )}
    >
      {refreshing && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 h-0.5 overflow-hidden bg-primary/15">
          <div className="dt-progress h-full w-1/3 rounded-full bg-primary" />
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {refreshing ? m.dt_refreshing() : ''}
      </p>

      {(showControls || (isSelectable && state.selected.size > 0)) && (
        // Barra e seleção ficam coladas ao topo ao rolar a página (em telemóvel a lista é a da página).
        <div className="sticky top-0 z-30 bg-card">
          {showControls && (
            <TableToolbar
              columns={stable}
              state={state}
              title={title}
              searchLabel={searchLabel ?? m.table_search()}
              searchRef={searchRef}
              exportMenu={exportMenu}
              extra={actions}
              full
            />
          )}
          {isSelectable && state.selected.size > 0 && (
            <SelectionBar
              state={state}
              actions={bulkActions ?? []}
              exportSelection={exportSelection}
            />
          )}
        </div>
      )}
      {!showControls && title && (
        <h3 className="border-b px-4 py-3 font-medium font-serif text-lg">{title}</h3>
      )}

      {hasError && <TableError error={error} onRetry={onRetry} />}
      {isEmptyAll && <TableEmpty />}
      {isNoMatch && <TableNoMatch onClear={state.clearAll} />}

      {(loading || hasBody) && (
        <>
          {loading ? (
            <SkeletonCards rows={4} />
          ) : (
            <MobileList
              rows={pageRows}
              state={state}
              visible={visible}
              primary={primary}
              caption={caption}
              selectable={isSelectable && (bulkActions?.length ?? 0) > 0}
              rowActions={rowActions}
              renderExpanded={renderExpanded}
              rowLabel={rowLabel}
            />
          )}
          {hasBody && state.hasMore && <div data-sentinel className="h-px md:hidden" />}

          <div
            ref={scrollerRef}
            data-hscroll={scrolledX}
            onScroll={(e) => {
              const next = e.currentTarget.scrollLeft > 2;
              if (next !== scrolledX) setScrolledX(next);
            }}
            className={cn(
              'dt-scroller hidden overflow-auto md:block',
              !unbounded && 'max-h-[max(24rem,calc(100dvh-14rem))]',
            )}
          >
            <table
              ref={tableRef}
              aria-rowcount={state.matched + 1}
              aria-colcount={colCount}
              className="w-full caption-bottom text-sm"
              style={
                fixedLayout
                  ? {
                      tableLayout: 'fixed',
                      width:
                        visible.reduce((n, c) => n + widthOf(c), 0) +
                        utilityLeft +
                        (hasActions ? ACTIONS_W : 0),
                    }
                  : undefined
              }
            >
              {caption && <caption className="sr-only">{caption}</caption>}
              {fixedLayout && (
                <colgroup>
                  {isSelectable && <col style={{ width: SELECT_W, minWidth: SELECT_W }} />}
                  {hasExpand && <col style={{ width: EXPAND_W }} />}
                  {visible.map((c) => (
                    <col key={c.id} style={{ width: widthOf(c) }} />
                  ))}
                  {hasActions && <col style={{ width: ACTIONS_W, minWidth: ACTIONS_W }} />}
                </colgroup>
              )}
              <TableHeader className="[&_tr]:border-b-0">
                <TableRow className="hover:bg-transparent">
                  {isSelectable && (
                    <TableHead
                      className={cn(stickyHead, 'left-0 z-30 w-11 pr-0 pl-4')}
                      style={{ width: SELECT_W, minWidth: SELECT_W }}
                    >
                      <Checkbox
                        checked={
                          allPageSelected ? true : somePageSelected ? 'indeterminate' : false
                        }
                        disabled={loading || pageRows.length === 0}
                        onCheckedChange={(on) => state.selectPage(on === true)}
                        aria-label={m.dt_select_page()}
                      />
                    </TableHead>
                  )}
                  {hasExpand && (
                    <TableHead
                      className={cn(stickyHead, 'z-30 px-0')}
                      style={{
                        width: EXPAND_W,
                        minWidth: EXPAND_W,
                        left: isSelectable ? SELECT_W : 0,
                      }}
                    >
                      <span className="sr-only">{m.dt_expand()}</span>
                    </TableHead>
                  )}
                  {visible.map(headerCell)}
                  {hasActions && (
                    <TableHead
                      className={cn(stickyHead, 'right-0 z-30 px-1')}
                      style={{ width: ACTIONS_W, minWidth: ACTIONS_W }}
                    >
                      <span className="sr-only">{m.dt_actions()}</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              {loading ? (
                <SkeletonRows
                  columns={Math.max(1, colCount)}
                  rows={Math.min(pageSize, 8)}
                  tall={!compact}
                />
              ) : (
                <TableBody>{pageRows.map(renderRow)}</TableBody>
              )}
              {hasBody && footerRow && (
                <tfoot className="sticky bottom-0 z-20 shadow-[inset_0_1px_0_var(--border)]">
                  <TableRow className="hover:bg-transparent">
                    {utilityCols - (hasActions ? 1 : 0) > 0 && (
                      <TableCell
                        colSpan={utilityCols - (hasActions ? 1 : 0)}
                        className={cn(cellPadding, 'bg-muted/60')}
                      />
                    )}
                    {visible.map(aggregateCell)}
                    {hasActions && <TableCell className={cn(cellPadding, 'bg-muted/60')} />}
                  </TableRow>
                </tfoot>
              )}
            </table>
            {hasBody && state.hasMore && <div data-sentinel className="h-px" />}
          </div>
        </>
      )}

      {showFooter && (
        <TablePagination
          page={state.page}
          pageCount={state.pageCount}
          size={state.size}
          matched={state.matched}
          total={state.total}
          selected={state.selected.size}
          shown={pageRows.length}
          showPager={state.matched > PAGE_SIZES[0] || state.scrolling}
          scrolling={state.scrolling}
          hasMore={state.hasMore}
          onPage={state.setPage}
          onSize={state.changeSize}
          onLoadMore={state.loadMore}
        />
      )}
    </section>
  );
}

const aggregateLabel = {
  sum: () => m.dt_agg_sum(),
  avg: () => m.dt_agg_avg(),
  min: () => m.dt_agg_min(),
  max: () => m.dt_agg_max(),
  count: () => m.dt_agg_count(),
} as const;

export type { CellValue };
