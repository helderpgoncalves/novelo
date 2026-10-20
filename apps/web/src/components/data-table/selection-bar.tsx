import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';
import type { BulkAction } from './types';
import type { TableState } from './use-table-state';

interface Props<T> {
  state: TableState<T>;
  actions: BulkAction<T>[];
  exportSelection: React.ReactNode;
}

/** Barra que aparece quando há linhas selecionadas: ações em massa, exportar a seleção e limpar. */
export function SelectionBar<T>({ state, actions, exportSelection }: Props<T>) {
  const n = state.selected.size;
  const pageAllSelected =
    state.pageIds.length > 0 && state.pageIds.every((id) => state.selected.has(id));
  const canSelectAll = pageAllSelected && state.matched > n;
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-primary/8 px-4 py-2"
      data-testid="dt-selection-bar"
    >
      <p className="font-medium text-sm tabular-nums" role="status">
        {m.dt_selected_count({ n: formatNumber(n) })}
      </p>
      {canSelectAll && (
        <Button variant="link" className="h-9 px-0" onClick={state.selectAllFiltered}>
          {m.dt_select_all_filtered({ n: formatNumber(state.matched) })}
        </Button>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {actions.map((a) => (
          <Button
            key={a.id}
            variant="outline"
            size="sm"
            className={`h-9 gap-1.5 ${a.destructive ? 'text-destructive hover:text-destructive' : ''}`}
            disabled={a.disabled?.(state.selectedRows)}
            onClick={() => a.onSelect(state.selectedRows)}
          >
            {a.icon}
            {a.label}
          </Button>
        ))}
        {exportSelection}
        <Button variant="ghost" size="sm" className="h-9 gap-1.5" onClick={state.clearSelection}>
          <X />
          {m.dt_clear_selection()}
        </Button>
      </div>
    </div>
  );
}
