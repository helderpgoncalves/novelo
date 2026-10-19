import { ArrowDownUp, Columns3, ListFilter, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { m } from '@/paraglide/messages';
import { type Column, columnLabel, isHideable } from './types';
import type { useTableState } from './use-table-state';

type State<T> = ReturnType<typeof useTableState<T>>;

interface ToolbarProps<T> {
  columns: Column<T>[];
  state: State<T>;
  searchLabel: string;
}

const triggerClass = 'h-10 gap-2';

function CountDot({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-primary px-1.5 font-semibold text-[11px] text-primary-foreground tabular-nums">
      {n}
    </span>
  );
}

function FacetItems<T>({ column, state }: { column: Column<T>; state: State<T> }) {
  const selected = state.filters[column.id] ?? [];
  return (
    <>
      <DropdownMenuLabel className="text-muted-foreground text-xs">
        {columnLabel(column)}
      </DropdownMenuLabel>
      {(state.facets[column.id] ?? []).map((o) => (
        <DropdownMenuCheckboxItem
          key={o.value}
          checked={selected.includes(o.value)}
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={(on) =>
            state.setFilter(
              column.id,
              on ? [...selected, o.value] : selected.filter((v) => v !== o.value),
            )
          }
        >
          <span className="flex-1">{o.label}</span>
          <span className="text-muted-foreground text-xs tabular-nums">{o.count}</span>
        </DropdownMenuCheckboxItem>
      ))}
      {selected.length > 0 && (
        <button
          type="button"
          className="mt-1 w-full rounded-sm px-2 py-1.5 text-left text-primary text-sm hover:bg-accent"
          onClick={() => state.setFilter(column.id, [])}
        >
          {m.table_clear_filter()}
        </button>
      )}
    </>
  );
}

export function TableToolbar<T>({ columns, state, searchLabel }: ToolbarProps<T>) {
  const hideable = columns.filter((c) => isHideable(c, state.primaryId));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:max-w-xs sm:flex-1">
        <Search
          className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={state.query}
          onChange={(e) => state.setQuery(e.target.value)}
          placeholder={searchLabel}
          aria-label={searchLabel}
          className="h-10 pl-9"
        />
      </div>

      {/* Telemóvel: um só menu com todos os filtros. */}
      {state.filterableColumns.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className={`${triggerClass} flex-1 sm:hidden`}>
              <ListFilter />
              {m.table_filters()}
              {state.filterCount > 0 && <CountDot n={state.filterCount} />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[70vh] min-w-60">
            {state.filterableColumns.map((c, i) => (
              <div key={c.id}>
                {i > 0 && <DropdownMenuSeparator />}
                <FacetItems column={c} state={state} />
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Ecrãs maiores: um botão por coluna filtrável. */}
      {state.filterableColumns.map((c) => {
        const count = state.filters[c.id]?.length ?? 0;
        return (
          <DropdownMenu key={c.id}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className={`${triggerClass} hidden sm:inline-flex`}>
                <ListFilter />
                {columnLabel(c)}
                {count > 0 && <CountDot n={count} />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 min-w-52">
              <FacetItems column={c} state={state} />
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}

      {state.isFiltered && (
        <Button
          variant="ghost"
          className="h-10 gap-1.5 text-muted-foreground"
          onClick={state.clearAll}
        >
          <X />
          {m.table_clear_all()}
        </Button>
      )}

      <div className="flex flex-1 items-center gap-2 sm:ml-auto sm:flex-none">
        {state.sortableColumns.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className={`${triggerClass} flex-1 sm:flex-none md:hidden`}>
                <ArrowDownUp />
                {m.table_sort()}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuRadioGroup
                value={state.sort?.id ?? ''}
                onValueChange={(id) =>
                  state.setSort(id ? { id, desc: state.sort?.desc ?? false } : null)
                }
              >
                <DropdownMenuRadioItem value="">{m.table_sort_none()}</DropdownMenuRadioItem>
                {state.sortableColumns.map((c) => (
                  <DropdownMenuRadioItem key={c.id} value={c.id}>
                    {columnLabel(c)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              {state.sort && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={state.sort.desc ? 'desc' : 'asc'}
                    onValueChange={(d) =>
                      state.sort && state.setSort({ id: state.sort.id, desc: d === 'desc' })
                    }
                  >
                    <DropdownMenuRadioItem value="asc">{m.table_sort_asc()}</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="desc">
                      {m.table_sort_desc()}
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {hideable.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className={`${triggerClass} flex-1 sm:flex-none`}>
                <Columns3 />
                {m.table_columns()}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                {m.table_columns_title()}
              </DropdownMenuLabel>
              {hideable.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={!state.hidden.includes(c.id)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(on) => state.toggleColumn(c.id, on)}
                >
                  {columnLabel(c)}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <button
                type="button"
                className="w-full rounded-sm px-2 py-1.5 text-left text-primary text-sm hover:bg-accent"
                onClick={state.resetColumns}
              >
                {m.table_columns_reset()}
              </button>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
