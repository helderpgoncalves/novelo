import { ArrowDownUp, ChevronDown, ListFilter, Rows2, Rows3, Search, X } from 'lucide-react';
import { type ReactNode, type RefObject, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { ColumnsPopover } from './columns-panel';
import { FilterEditor } from './filter-editors';
import { filterValueLabel } from './filter-label';
import { ActiveFilters, FiltersPopover } from './filters';
import { CheckRow, CountDot } from './parts';
import { type Column, columnLabel, isHideable } from './types';
import type { TableState } from './use-table-state';
import { ViewsMenu } from './views-menu';

interface ToolbarProps<T> {
  columns: Column<T>[];
  state: TableState<T>;
  searchLabel: string;
  searchRef: RefObject<HTMLInputElement | null>;
  title?: ReactNode;
  exportMenu: ReactNode;
  extra?: ReactNode;
  /** Controla o que a barra mostra além da pesquisa (tabelas pequenas só pesquisam). */
  full: boolean;
}

function SearchBox<T>({
  state,
  label,
  inputRef,
  className,
}: {
  state: TableState<T>;
  label: string;
  inputRef: RefObject<HTMLInputElement | null>;
  className?: string;
}) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search
        className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        data-table-search
        type="search"
        value={state.query}
        onChange={(e) => state.setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            if (state.query) {
              e.preventDefault();
              e.stopPropagation();
              state.setQuery('');
            } else {
              e.currentTarget.blur();
            }
          }
        }}
        placeholder={label}
        aria-label={label}
        aria-keyshortcuts="/"
        // O botão nativo de limpar do `type=search` varia entre navegadores; usamos o nosso.
        className="h-10 pr-14 pl-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {state.query ? (
        <button
          type="button"
          onClick={() => {
            state.setQuery('');
            inputRef.current?.focus();
          }}
          aria-label={m.dt_clear_search()}
          className="-translate-y-1/2 absolute top-1/2 right-1 flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      ) : (
        <span
          aria-hidden="true"
          className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-2.5 hidden h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-mono text-[11px] text-muted-foreground md:inline-flex"
        >
          /
        </span>
      )}
    </div>
  );
}

function DensityToggle<T>({ state }: { state: TableState<T> }) {
  const compact = state.density === 'compact';
  return (
    <Button
      variant="outline"
      size="icon"
      className="size-10"
      aria-pressed={compact}
      aria-label={m.dt_density_compact()}
      title={compact ? m.dt_density_comfortable() : m.dt_density_compact()}
      onClick={() => state.setDensity(compact ? 'comfortable' : 'compact')}
    >
      {compact ? <Rows3 /> : <Rows2 />}
    </Button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
      {children}
    </h3>
  );
}

/** Folha inferior com todos os controlos, para telemóvel. */
function MobileSheet<T>({
  columns,
  state,
  open,
  onOpenChange,
  exportMenu,
  extra,
  full,
}: ToolbarProps<T> & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const hideable = columns.filter((c) => isHideable(c, state.primaryId));
  const sortId = state.sort[0]?.id ?? '';
  const sortDesc = state.sort[0]?.desc ?? false;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] gap-0 rounded-t-2xl p-0">
        <SheetHeader className="border-b px-4 py-3 pr-14 text-left">
          <SheetTitle className="font-serif text-lg">{m.dt_sheet_title()}</SheetTitle>
          <SheetDescription>
            {m.dt_sheet_description({
              matched: formatNumber(state.matched),
              total: formatNumber(state.total),
            })}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-4">
          {state.sortableColumns.length > 0 && (
            <section className="space-y-2">
              <SectionLabel>{m.table_sort()}</SectionLabel>
              <div className="flex gap-2">
                <Select
                  value={sortId || 'none'}
                  onValueChange={(id) =>
                    id === 'none' ? state.setSort([]) : state.setSort([{ id, desc: sortDesc }])
                  }
                >
                  <SelectTrigger className="h-11 flex-1" aria-label={m.table_sort()}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{m.table_sort_none()}</SelectItem>
                    {state.sortableColumns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {columnLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="h-11 gap-2"
                  disabled={!sortId}
                  onClick={() => state.setSort([{ id: sortId, desc: !sortDesc }])}
                  aria-label={sortDesc ? m.table_sort_desc() : m.table_sort_asc()}
                >
                  <ArrowDownUp />
                  {sortDesc ? m.table_sort_desc() : m.table_sort_asc()}
                </Button>
              </div>
            </section>
          )}

          {state.filterableColumns.length > 0 && (
            <section className="space-y-2">
              <SectionLabel>{m.table_filters()}</SectionLabel>
              <ul className="divide-y rounded-lg border">
                {state.filterableColumns.map((c) => {
                  const f = state.filters[c.id];
                  return (
                    <li key={c.id}>
                      <Collapsible defaultOpen={!!f}>
                        <CollapsibleTrigger className="group/c flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left text-sm">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{columnLabel(c)}</span>
                            {f && (
                              <span className="block truncate text-primary text-xs">
                                {filterValueLabel(c, state.meta[c.id], f)}
                              </span>
                            )}
                          </span>
                          <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]/c:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 px-3 pb-3">
                          <FilterEditor column={c} state={state} />
                          {f && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 text-primary"
                              onClick={() => state.setFilter(c.id, null)}
                            >
                              {m.table_clear_filter()}
                            </Button>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {full && hideable.length > 0 && (
            <section className="space-y-2">
              <SectionLabel>{m.table_columns_title()}</SectionLabel>
              <ul className="grid grid-cols-2 gap-x-3">
                {hideable.map((c) => (
                  <li key={c.id}>
                    <CheckRow
                      className="min-h-11 text-sm"
                      checked={!state.hidden.includes(c.id)}
                      onChange={(on) => state.toggleColumn(c.id, on)}
                    >
                      <span className="block truncate">{columnLabel(c)}</span>
                    </CheckRow>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {full && (
            <section className="space-y-2">
              <SectionLabel>{m.dt_more()}</SectionLabel>
              <div className="flex flex-wrap gap-2 [&_.dt-label]:inline! [&_button]:h-11">
                <ViewsMenu state={state} />
                {exportMenu}
                {extra}
              </div>
            </section>
          )}
        </div>
        <div className="flex gap-2 border-t bg-background px-4 py-3">
          {state.isFiltered && (
            <Button variant="outline" className="h-11" onClick={state.clearAll}>
              {m.table_clear_all()}
            </Button>
          )}
          <Button className="h-11 flex-1" onClick={() => onOpenChange(false)}>
            {m.dt_show_results({ n: formatNumber(state.matched) })}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Barra do cartão. Uma só pesquisa em todos os ecrãs. Em ecrãs largos: filtros à esquerda e vistas, colunas,
 * densidade e exportar à direita. Em telemóvel: pesquisa e um botão "Filtros" que abre a folha com tudo.
 */
export function TableToolbar<T>(props: ToolbarProps<T>) {
  const { title, state, columns, searchLabel, searchRef, exportMenu, extra, full } = props;
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetCount = state.filterCount + (state.sort.length > 0 ? 1 : 0);
  return (
    <div className="border-b bg-card">
      {title && (
        <div className="flex items-baseline gap-2 px-4 pt-3.5">
          <h3 className="truncate font-serif font-medium text-lg tracking-[-0.01em]">{title}</h3>
          <span className="text-muted-foreground text-sm tabular-nums">
            {formatNumber(state.total)}
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 px-3 py-3 md:px-4">
        <SearchBox
          state={state}
          label={searchLabel}
          inputRef={searchRef}
          className="min-w-0 flex-1 md:max-w-xs"
        />
        <Button
          variant="outline"
          className="h-10 gap-2 md:hidden"
          onClick={() => setSheetOpen(true)}
          data-testid="dt-filters-mobile"
        >
          <ListFilter />
          {m.table_filters()}
          {sheetCount > 0 && <CountDot n={sheetCount} />}
        </Button>
        {full && state.filterableColumns.length > 0 && (
          <FiltersPopover columns={columns} state={state} className="hidden md:inline-flex" />
        )}
        <div className="ml-auto hidden items-center gap-2 md:flex">
          {full && (
            <>
              <ViewsMenu state={state} />
              <ColumnsPopover columns={columns} state={state} />
              <DensityToggle state={state} />
              {exportMenu}
            </>
          )}
          {extra}
        </div>
      </div>
      {state.isFiltered && (
        <div className="px-3 pb-3 md:px-4">
          <ActiveFilters columns={columns} state={state} />
        </div>
      )}
      <MobileSheet {...props} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
