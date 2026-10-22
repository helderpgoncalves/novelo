import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { RowActionsMenu } from './row-actions';
import type { Column, RowAction } from './types';
import type { TableState } from './use-table-state';

interface Props<T> {
  rows: T[];
  state: TableState<T>;
  visible: Column<T>[];
  primary: Column<T> | undefined;
  caption?: string;
  selectable: boolean;
  rowActions?: (row: T) => RowAction<T>[];
  renderExpanded?: (row: T) => ReactNode;
  rowLabel: (row: T) => string;
}

/** Lista de cartões para telemóvel: título, estado à direita e os restantes campos em grelha. */
export function MobileList<T>({
  rows,
  state,
  visible,
  primary,
  caption,
  selectable,
  rowActions,
  renderExpanded,
  rowLabel,
}: Props<T>) {
  const badge = visible.find((c) => c.badge);
  const details = visible.filter((c) => c !== primary && c !== badge && !c.desktopOnly);

  return (
    <ul className="divide-y divide-border md:hidden" aria-label={caption}>
      {rows.map((row) => {
        const rowId = state.idOf(row);
        const selected = state.selected.has(rowId);
        const open = state.expanded.has(rowId);
        const label = rowLabel(row);
        const actions = rowActions?.(row) ?? [];
        // No cartão, um campo sem valor (nulo ou vazio) não ocupa espaço: só ruído de travessões.
        const fields = details.filter((c) => {
          const v = c.value?.(row);
          return !c.value || (v != null && v !== '');
        });
        return (
          <li
            key={rowId}
            data-state={selected ? 'selected' : undefined}
            className="space-y-2.5 p-4 data-[state=selected]:bg-primary/8"
          >
            <div className="flex items-start gap-3">
              {selectable && (
                <Checkbox
                  className="mt-1"
                  checked={selected}
                  onCheckedChange={() => state.toggleRow(rowId)}
                  aria-label={m.dt_select_row({ row: label })}
                />
              )}
              <div className="min-w-0 flex-1 font-medium [&_a]:-my-2.5 [&_a]:inline-block [&_a]:py-2.5">
                {primary?.cell(row)}
              </div>
              {badge && <div className="shrink-0">{badge.cell(row)}</div>}
              {actions.length > 0 && (
                <div className="-my-1.5 -mr-2 shrink-0">
                  <RowActionsMenu row={row} actions={actions} label={label} />
                </div>
              )}
            </div>
            {fields.length > 0 && (
              <dl className={cn('grid grid-cols-2 gap-x-4 gap-y-2 text-sm', selectable && 'pl-7')}>
                {fields.map((c) => (
                  <div key={c.id} className={cn('min-w-0', c.full && 'col-span-2')}>
                    <dt className="text-[11px] text-muted-foreground uppercase tracking-wider">
                      {c.header}
                    </dt>
                    <dd className="mt-0.5 break-words tabular-nums">{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {renderExpanded && (
              <>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => state.toggleExpanded(rowId)}
                  className={cn(
                    'flex h-9 items-center gap-1 rounded-md text-primary text-sm',
                    selectable && 'ml-7',
                  )}
                >
                  <ChevronRight
                    className={cn('size-4 transition-transform', open && 'rotate-90')}
                  />
                  {open ? m.dt_collapse() : m.dt_details()}
                </button>
                {open && (
                  <div className="rounded-lg bg-muted/40 p-3 text-sm">{renderExpanded(row)}</div>
                )}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
