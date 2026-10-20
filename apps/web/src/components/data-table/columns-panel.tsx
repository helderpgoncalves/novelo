import { Columns3, GripVertical, Pin, PinOff } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { CheckRow } from './parts';
import { type Column, columnLabel, isHideable, type Pin as PinSide } from './types';
import type { TableState } from './use-table-state';

interface Props<T> {
  columns: Column<T>[];
  state: TableState<T>;
}

const pinOf = <T,>(state: TableState<T>, c: Column<T>): PinSide | undefined => {
  if (state.pinnedLeft.includes(c)) return 'left';
  if (state.pinnedRight.includes(c)) return 'right';
  return undefined;
};

/** Lista de colunas: mostrar/ocultar, reordenar (arrastar ou teclado) e fixar. */
export function ColumnsList<T>({ state }: { state: TableState<T> }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const ordered = state.orderedColumns;

  const move = (c: Column<T>, delta: -1 | 1) => {
    const index = ordered.findIndex((x) => x.id === c.id) + delta + 1;
    state.moveColumn(c.id, delta);
    setAnnounce(
      m.dt_column_moved({ column: columnLabel(c), position: index, total: ordered.length }),
    );
  };

  return (
    <div>
      <ul className="space-y-0.5">
        {ordered.map((c) => {
          const hideable = isHideable(c, state.primaryId);
          const visible = !state.hidden.includes(c.id) || c.id === state.primaryId;
          const pin = pinOf(state, c);
          return (
            <li
              key={c.id}
              draggable
              onDragStart={(e) => {
                setDragId(c.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', c.id);
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setOverId(c.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId && dragId !== c.id) state.moveColumnTo(dragId, c.id);
                setDragId(null);
                setOverId(null);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              className={cn(
                'flex min-h-10 items-center gap-1 rounded-md pr-1 pl-0.5',
                overId === c.id && dragId !== c.id && 'bg-accent ring-1 ring-primary/40',
                dragId === c.id && 'opacity-50',
              )}
            >
              <button
                type="button"
                aria-label={m.dt_column_move({ column: columnLabel(c) })}
                title={m.dt_column_move_hint()}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    move(c, e.key === 'ArrowUp' ? -1 : 1);
                  }
                }}
                className="flex size-9 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent active:cursor-grabbing"
              >
                <GripVertical className="size-4" />
              </button>
              <CheckRow
                className="min-w-0 flex-1"
                checked={visible}
                disabled={!hideable}
                onChange={(on) => state.toggleColumn(c.id, on)}
              >
                <span className="block truncate text-sm">{columnLabel(c)}</span>
              </CheckRow>
              <button
                type="button"
                aria-pressed={!!pin}
                aria-label={
                  pin
                    ? m.dt_unpin_column({ column: columnLabel(c) })
                    : m.dt_pin_column({ column: columnLabel(c) })
                }
                title={pin ? m.dt_unpin() : m.dt_pin_left()}
                onClick={() => state.setPin(c.id, pin ? 'none' : 'left')}
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-md hover:bg-accent',
                  pin ? 'text-primary' : 'text-muted-foreground/70',
                )}
              >
                {pin ? <Pin className="size-4" /> : <PinOff className="size-4" />}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <div className="mt-2 flex flex-wrap gap-1 border-t pt-2">
        <Button variant="ghost" size="sm" className="h-9" onClick={state.showAllColumns}>
          {m.dt_columns_show_all()}
        </Button>
        <Button variant="ghost" size="sm" className="h-9" onClick={state.resetColumns}>
          {m.table_columns_reset()}
        </Button>
      </div>
    </div>
  );
}

export function ColumnsPopover<T>({ columns, state }: Props<T>) {
  const hiddenCount = state.hidden.filter((id) => columns.some((c) => c.id === id)).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 gap-2"
          data-testid="dt-columns"
          aria-label={m.table_columns()}
          title={m.table_columns()}
        >
          <Columns3 />
          <span className="dt-label hidden lg:inline">{m.table_columns()}</span>
          {hiddenCount > 0 && (
            <span className="rounded-full bg-muted px-1.5 font-semibold text-[11px] text-muted-foreground tabular-nums">
              {columns.length - hiddenCount}/{columns.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <p className="px-2 pt-1 pb-2 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
          {m.table_columns_title()}
        </p>
        <div className="max-h-96 overflow-y-auto">
          <ColumnsList state={state} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
