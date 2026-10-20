import { ArrowLeft, Check, ChevronRight, ListFilter, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { FilterEditor } from './filter-editors';
import { filterChipLabel, filterValueLabel } from './filter-label';
import { CountDot } from './parts';
import { type Column, columnLabel } from './types';
import type { TableState } from './use-table-state';

interface Props<T> {
  columns: Column<T>[];
  state: TableState<T>;
}

function ColumnFilterHeader<T>({
  column,
  state,
  onBack,
}: {
  column: Column<T>;
  state: TableState<T>;
  onBack?: () => void;
}) {
  const active = state.filters[column.id] !== undefined;
  return (
    <div className="flex items-center gap-1 border-b px-2 py-1.5">
      {onBack && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
          aria-label={m.dt_filters_back()}
          className="size-9"
        >
          <ArrowLeft />
        </Button>
      )}
      <p className="min-w-0 flex-1 truncate px-1 font-medium text-sm">{columnLabel(column)}</p>
      {active && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-primary"
          onClick={() => state.setFilter(column.id, null)}
        >
          {m.table_clear_filter()}
        </Button>
      )}
    </div>
  );
}

/** Botão "Filtros": escolhe a coluna e depois edita o filtro, tudo no mesmo painel. */
export function FiltersPopover<T>({
  columns,
  state,
  className,
}: Props<T> & { className?: string }) {
  const [open, setOpen] = useState(false);
  const [columnId, setColumnId] = useState<string | null>(null);
  const column = columns.find((c) => c.id === columnId);
  // Filtros declarados primeiro: são os que quem fez o ecrã achou mais úteis.
  const list = [...state.filterableColumns].sort(
    (a, b) => Number(state.meta[b.id]?.explicit) - Number(state.meta[a.id]?.explicit),
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setColumnId(null);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('h-10 gap-2', className)} data-testid="dt-filters">
          <ListFilter />
          {m.table_filters()}
          {state.filterCount > 0 && <CountDot n={state.filterCount} />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        {column ? (
          <>
            <ColumnFilterHeader column={column} state={state} onBack={() => setColumnId(null)} />
            <div className="p-3">
              <FilterEditor column={column} state={state} />
            </div>
          </>
        ) : (
          <div className="max-h-96 overflow-y-auto p-1">
            <p className="px-2.5 pt-2 pb-1 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
              {m.dt_filters_pick()}
            </p>
            <ul>
              {list.map((c) => {
                const f = state.filters[c.id];
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setColumnId(c.id)}
                      className="flex min-h-10 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{columnLabel(c)}</span>
                        {f && (
                          <span className="block truncate text-primary text-xs">
                            {filterValueLabel(c, state.meta[c.id], f)}
                          </span>
                        )}
                      </span>
                      {f && <Check className="size-4 text-primary" aria-hidden="true" />}
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

const chipClass =
  'inline-flex h-8 max-w-full items-center rounded-full border border-primary/25 bg-primary/10 text-primary text-xs';

/** Chips dos filtros ativos: clicar abre o editor, o X remove. Inclui a pesquisa de texto. */
export function ActiveFilters<T>({ columns, state }: Props<T>) {
  if (!state.isFiltered) return null;
  return (
    <ul className="flex flex-wrap items-center gap-1.5" aria-label={m.dt_active_filters()}>
      {state.query.trim() !== '' && (
        <li className={cn(chipClass, 'pl-3')}>
          <span className="truncate font-medium">
            {m.dt_chip_search({ query: state.query.trim() })}
          </span>
          <button
            type="button"
            onClick={() => state.setQuery('')}
            aria-label={m.dt_remove_search()}
            className="ml-0.5 flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-primary/15"
          >
            <X className="size-3.5" />
          </button>
        </li>
      )}
      {state.activeFilters.map(([id, f]) => {
        const column = columns.find((c) => c.id === id);
        if (!column) return null;
        const label = filterChipLabel(column, state.meta[id], f);
        return (
          <li key={id} className={chipClass}>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="min-w-0 truncate rounded-l-full py-1 pr-1 pl-3 font-medium"
                  aria-label={m.dt_edit_filter({ filter: label })}
                >
                  {label}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 p-0">
                <ColumnFilterHeader column={column} state={state} />
                <div className="p-3">
                  <FilterEditor column={column} state={state} />
                </div>
              </PopoverContent>
            </Popover>
            <button
              type="button"
              onClick={() => state.setFilter(id, null)}
              aria-label={m.dt_remove_filter({ filter: label })}
              className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-primary/15"
            >
              <X className="size-3.5" />
            </button>
          </li>
        );
      })}
      <li>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-muted-foreground"
          onClick={state.clearAll}
        >
          {m.table_clear_all()}
        </Button>
      </li>
    </ul>
  );
}
