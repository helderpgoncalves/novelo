import {
  ArrowDown,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUp,
  ChevronDown,
  ChevronsUpDown,
  EyeOff,
  MoveHorizontal,
  Pin,
  PinOff,
  X,
} from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { FilterEditor } from './filter-editors';
import { type Column, columnLabel, isHideable, isSortable } from './types';
import type { TableState } from './use-table-state';

const RESIZE_STEP = 20;

interface Props<T> {
  column: Column<T>;
  state: TableState<T>;
  /** Há largura personalizada guardada para esta coluna. */
  hasWidth: boolean;
  /** Com larguras fixas o título corta com reticências; sem elas a coluna cresce para o mostrar todo. */
  truncate: boolean;
  onResetWidth: () => void;
  /** Alarga (+) ou estreita (-) a coluna, em píxeis; alternativa ao arrastar para quem usa teclado. */
  onResizeBy?: (delta: number) => void;
}

function MenuItem({
  icon,
  children,
  onClick,
  active,
  destructive,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex min-h-9 w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground',
        active && 'bg-accent font-medium [&_svg]:text-primary',
        destructive && 'text-destructive',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/** Conteúdo do cabeçalho de uma coluna: ordenar (clique, Shift para várias) e menu com tudo o resto. */
export function ColumnHeader<T>({
  column,
  state,
  hasWidth,
  truncate,
  onResetWidth,
  onResizeBy,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const sortRef = useRef<HTMLButtonElement>(null);
  const label = columnLabel(column);
  const sortable = isSortable(column);
  const index = state.sort.findIndex((s) => s.id === column.id);
  const current = index >= 0 ? state.sort[index] : undefined;
  const right = column.align === 'right';
  const filterable = !!state.meta[column.id]?.kind;
  const hideable = isHideable(column, state.primaryId);
  const pinned = state.pinnedLeft.includes(column)
    ? 'left'
    : state.pinnedRight.includes(column)
      ? 'right'
      : null;
  const done = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };
  const filterActive = state.filters[column.id] !== undefined;

  return (
    <div className={cn('group/h flex items-center gap-0.5', right && 'flex-row-reverse')}>
      {sortable ? (
        <button
          ref={sortRef}
          type="button"
          onClick={(e) => state.toggleSort(column.id, e.shiftKey)}
          onKeyDown={(e) => {
            // Um só ponto de paragem por cabeçalho: ↓ (ou Shift+F10) abre o menu da coluna.
            if (e.key === 'ArrowDown' || (e.shiftKey && e.key === 'F10')) {
              e.preventDefault();
              setOpen(true);
            }
          }}
          aria-keyshortcuts="ArrowDown"
          className={cn(
            '-ml-2 inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 py-0.5 font-medium hover:bg-muted',
            truncate && 'min-w-0',
            right && '-mr-2 ml-0 flex-row-reverse',
          )}
          aria-label={m.table_sort_by({ column: label })}
          title={m.dt_sort_hint()}
        >
          <span className={cn(truncate && 'truncate')}>{column.header}</span>
          {current ? (
            <span className="inline-flex items-center gap-0.5 text-primary">
              {current.desc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />}
              {state.sort.length > 1 && (
                <span className="font-semibold text-[10px] tabular-nums">{index + 1}</span>
              )}
            </span>
          ) : (
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground/50" />
          )}
        </button>
      ) : (
        <span className={cn(truncate && 'truncate')}>{column.header}</span>
      )}
      {filterActive && (
        <span
          className="size-1.5 shrink-0 rounded-full bg-primary"
          role="img"
          aria-label={m.dt_column_filtered()}
        />
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={m.dt_column_menu({ column: label })}
            tabIndex={sortable ? -1 : 0}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-muted focus-visible:opacity-100 group-hover/h:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
          >
            <ChevronDown className="size-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align={right ? 'end' : 'start'}
          onCloseAutoFocus={(e) => {
            // O ponto de paragem do cabeçalho é o botão de ordenar, não o do menu.
            if (sortRef.current) {
              e.preventDefault();
              sortRef.current.focus();
            }
          }}
          className="max-h-[min(30rem,var(--radix-popover-content-available-height))] w-64 overflow-y-auto p-1"
        >
          {sortable && (
            <>
              <MenuItem
                icon={<ArrowUp />}
                active={current?.desc === false}
                onClick={done(() => state.setSortDirection(column.id, false))}
              >
                {m.table_sort_asc()}
              </MenuItem>
              <MenuItem
                icon={<ArrowDown />}
                active={current?.desc === true}
                onClick={done(() => state.setSortDirection(column.id, true))}
              >
                {m.table_sort_desc()}
              </MenuItem>
              {current && (
                <MenuItem
                  icon={<X />}
                  onClick={done(() => state.setSortDirection(column.id, null))}
                >
                  {m.dt_sort_clear()}
                </MenuItem>
              )}
              <div className="my-1 h-px bg-border" />
            </>
          )}
          <MenuItem
            icon={<Pin />}
            active={pinned === 'left'}
            onClick={done(() => state.setPin(column.id, pinned === 'left' ? 'none' : 'left'))}
          >
            {m.dt_pin_left()}
          </MenuItem>
          <MenuItem
            icon={<Pin className="rotate-90" />}
            active={pinned === 'right'}
            onClick={done(() => state.setPin(column.id, pinned === 'right' ? 'none' : 'right'))}
          >
            {m.dt_pin_right()}
          </MenuItem>
          {pinned && (
            <MenuItem icon={<PinOff />} onClick={done(() => state.setPin(column.id, 'none'))}>
              {m.dt_unpin()}
            </MenuItem>
          )}
          <MenuItem icon={<ArrowLeftToLine />} onClick={() => state.moveColumn(column.id, -1)}>
            {m.dt_move_left()}
          </MenuItem>
          <MenuItem icon={<ArrowRightToLine />} onClick={() => state.moveColumn(column.id, 1)}>
            {m.dt_move_right()}
          </MenuItem>
          {onResizeBy && (
            <>
              <MenuItem icon={<MoveHorizontal />} onClick={() => onResizeBy(RESIZE_STEP)}>
                {m.dt_widen()}
              </MenuItem>
              <MenuItem icon={<MoveHorizontal />} onClick={() => onResizeBy(-RESIZE_STEP)}>
                {m.dt_narrow()}
              </MenuItem>
            </>
          )}
          {hasWidth && (
            <MenuItem icon={<MoveHorizontal />} onClick={done(onResetWidth)}>
              {m.dt_reset_width()}
            </MenuItem>
          )}
          {hideable && (
            <MenuItem icon={<EyeOff />} onClick={done(() => state.toggleColumn(column.id, false))}>
              {m.dt_hide_column()}
            </MenuItem>
          )}
          {filterable && (
            <>
              <div className="my-1 h-px bg-border" />
              <div className="flex items-center justify-between px-2.5 pt-1.5 pb-2">
                <p className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
                  {m.dt_column_filter()}
                </p>
                {filterActive && (
                  <button
                    type="button"
                    className="text-primary text-xs hover:underline"
                    onClick={() => state.setFilter(column.id, null)}
                  >
                    {m.table_clear_filter()}
                  </button>
                )}
              </div>
              <div className="px-2.5 pb-2">
                <FilterEditor column={column} state={state} />
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
