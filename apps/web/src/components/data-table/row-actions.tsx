import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import type { RowAction } from './types';

/** Menu "⋯" com as ações de uma linha. */
export function RowActionsMenu<T>({
  row,
  actions,
  label,
}: {
  row: T;
  actions: RowAction<T>[];
  label: string;
}) {
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={m.dt_row_actions({ row: label })}
          className="flex size-9 pointer-coarse:size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-muted"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {actions.map((a) => (
          <DropdownMenuItem
            key={a.id}
            disabled={a.disabled}
            onSelect={() => a.onSelect(row)}
            className={cn('min-h-10', a.destructive && 'text-destructive focus:text-destructive')}
          >
            {a.icon}
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
