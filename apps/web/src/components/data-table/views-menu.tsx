import { Bookmark, Check, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import type { TableState } from './use-table-state';

export function ViewsMenu<T>({ state }: { state: TableState<T> }) {
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const active = state.activeView;
  const declared = state.allViews.filter((v) => !state.savedViews.some((s) => s.id === v.id));

  const row = (
    key: string,
    label: string,
    on: boolean,
    onPick: () => void,
    onDelete?: () => void,
  ) => (
    <li key={key} className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => {
          onPick();
          setOpen(false);
        }}
        aria-pressed={on}
        className={cn(
          'flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 text-left text-sm hover:bg-accent',
          on && 'font-medium',
        )}
      >
        <Check
          className={cn('size-4 shrink-0 text-primary', !on && 'invisible')}
          aria-hidden="true"
        />
        <span className="truncate">{label}</span>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={m.dt_view_delete({ view: label })}
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </li>
  );

  const save = () => {
    const label = name.trim();
    if (!label) return;
    state.saveView(label);
    setName('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 max-w-48 gap-2"
          data-testid="dt-views"
          aria-label={active ? `${m.dt_views()}: ${active.label}` : m.dt_views()}
          title={m.dt_views()}
        >
          <Bookmark />
          <span className="dt-label hidden truncate lg:inline">
            {active ? active.label : m.dt_views()}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <p className="px-2 pt-1 pb-1 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
          {m.dt_views()}
        </p>
        <ul>
          {row('default', m.dt_view_default(), active === null, state.resetView)}
          {declared.map((v) =>
            row(v.id, v.label, active?.id === v.id, () => state.applyView(v.state)),
          )}
          {state.savedViews.map((v) =>
            row(
              v.id,
              v.label,
              active?.id === v.id,
              () => state.applyView(v.state),
              () => state.deleteView(v.id),
            ),
          )}
        </ul>
        <form
          className="mt-2 space-y-2 border-t pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label
            htmlFor="dt-view-name"
            className="px-0.5 font-medium text-muted-foreground text-xs"
          >
            {m.dt_view_save_current()}
          </label>
          <div className="flex gap-2">
            <Input
              id="dt-view-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={m.dt_view_name()}
              maxLength={40}
              className="h-9"
            />
            <Button type="submit" size="sm" className="h-9" disabled={!name.trim()}>
              {m.dt_view_save()}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs leading-snug">{m.dt_view_hint()}</p>
        </form>
      </PopoverContent>
    </Popover>
  );
}
