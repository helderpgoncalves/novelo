import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { TablePagination } from './pagination';
import { TableToolbar } from './toolbar';
import { type Column, columnLabel, isSortable, type SortState } from './types';
import { PAGE_SIZES, useTableState } from './use-table-state';

export type { Column } from './types';

/** Abaixo deste número de linhas a barra de ferramentas não compensa o espaço que ocupa. */
const AUTO_CONTROLS_MIN_ROWS = 8;

interface DataTableProps<T> {
  /** Identifica a tabela para lembrar as colunas visíveis e as linhas por página. */
  id: string;
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
  /** Mostrado quando não há dados de todo. */
  empty?: ReactNode;
  className?: string;
  caption?: string;
  /** `auto` mostra pesquisa, filtros e colunas só quando a tabela é grande o suficiente. */
  controls?: 'auto' | 'always' | 'never';
  pageSize?: number;
  initialSort?: SortState;
  searchLabel?: string;
}

/**
 * A mesma tabela em todo o produto: pesquisa, filtros por coluna, ordenação, colunas visíveis e paginação,
 * em tabela nos ecrãs largos e em lista de cartões em telemóvel. Cada coluna define como se mostra nos dois
 * formatos e que valor usa para ordenar, pesquisar e filtrar.
 */
export function DataTable<T>({
  id,
  columns,
  rows,
  getKey,
  empty,
  className,
  caption,
  controls = 'auto',
  pageSize = 10,
  initialSort,
  searchLabel,
}: DataTableProps<T>) {
  const paginate = controls !== 'never';
  const state = useTableState({ id, columns, rows, pageSize, paginate, initialSort });
  const showControls =
    controls === 'always' || (controls === 'auto' && rows.length > AUTO_CONTROLS_MIN_ROWS);

  if (rows.length === 0 && empty) return <>{empty}</>;

  const visible = state.visibleColumns;
  const primary = visible.find((c) => c.primary) ?? visible[0];
  const badge = visible.find((c) => c.badge);
  const details = visible.filter((c) => c !== primary && c !== badge && !c.desktopOnly);
  const allRows = state.pageRows;

  return (
    <div className={cn('space-y-3', className)}>
      {showControls && (
        <TableToolbar
          columns={columns}
          state={state}
          searchLabel={searchLabel ?? m.table_search()}
        />
      )}

      {state.matched === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="font-medium text-sm">{m.table_no_results()}</p>
          <p className="mt-1 text-muted-foreground text-sm">{m.table_no_results_hint()}</p>
        </div>
      ) : (
        <>
          <ul
            className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 md:hidden"
            aria-label={caption}
          >
            {allRows.map((row) => (
              <li key={getKey(row)} className="space-y-2.5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 font-medium [&_a]:-my-2.5 [&_a]:inline-block [&_a]:py-2.5">
                    {primary?.cell(row)}
                  </div>
                  {badge && <div className="shrink-0">{badge.cell(row)}</div>}
                </div>
                {details.length > 0 && (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {details.map((c) => (
                      <div key={c.id} className={cn('min-w-0', c.full && 'col-span-2')}>
                        <dt className="text-[11px] text-muted-foreground uppercase tracking-wider">
                          {c.header}
                        </dt>
                        <dd className="mt-0.5 break-words tabular-nums">{c.cell(row)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 md:block">
            <Table>
              {caption && <caption className="sr-only">{caption}</caption>}
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {visible.map((c, i) => {
                    const sorted = state.sort?.id === c.id ? state.sort : null;
                    return (
                      <TableHead
                        key={c.id}
                        aria-sort={sorted ? (sorted.desc ? 'descending' : 'ascending') : undefined}
                        className={cn(
                          'h-10',
                          i === 0 && 'px-4',
                          i === visible.length - 1 && 'pr-4',
                          c.align === 'right' && 'text-right',
                          c.className,
                        )}
                      >
                        {isSortable(c) ? (
                          <button
                            type="button"
                            onClick={() => state.cycleSort(c.id)}
                            className={cn(
                              '-mx-2 inline-flex h-8 items-center gap-1.5 rounded-md px-2 font-medium hover:bg-muted',
                              c.align === 'right' && 'flex-row-reverse',
                            )}
                            aria-label={m.table_sort_by({ column: columnLabel(c) })}
                          >
                            {c.header}
                            {sorted ? (
                              sorted.desc ? (
                                <ArrowDown className="size-3.5" />
                              ) : (
                                <ArrowUp className="size-3.5" />
                              )
                            ) : (
                              <ChevronsUpDown className="size-3.5 text-muted-foreground/60" />
                            )}
                          </button>
                        ) : (
                          c.header
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {allRows.map((row) => (
                  <TableRow key={getKey(row)} className="align-top">
                    {visible.map((c, i) => (
                      <TableCell
                        key={c.id}
                        className={cn(
                          i === 0 && 'px-4 font-medium',
                          i === visible.length - 1 && 'pr-4',
                          c.align === 'right' && 'text-right tabular-nums',
                          c.className,
                        )}
                      >
                        {c.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {paginate && rows.length > PAGE_SIZES[0] && (
        <TablePagination
          page={state.page}
          pageCount={state.pageCount}
          size={state.size}
          matched={state.matched}
          total={state.total}
          showPager={state.matched > PAGE_SIZES[0]}
          onPage={state.setPage}
          onSize={state.changeSize}
        />
      )}
    </div>
  );
}
