import { Search } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatNumber } from '@/lib/format';
import { normalizeText } from '@/lib/text';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { textOpLabel } from './filter-label';
import { CheckRow } from './parts';
import { type Column, columnLabel, type TextOp } from './types';
import type { TableState } from './use-table-state';

interface EditorProps<T> {
  column: Column<T>;
  state: TableState<T>;
}

const OPS: TextOp[] = ['contains', 'not_contains', 'equals', 'starts'];

/** Aceita "1 234,5", "1234.5" e "-3". */
export function parseNumber(text: string): number | undefined {
  const clean = text.replace(/\s/g, '').replace(',', '.');
  if (clean === '' || clean === '-' || clean === '.') return undefined;
  const n = Number(clean);
  return Number.isFinite(n) ? n : undefined;
}

function FacetEditor<T>({ column, state }: EditorProps<T>) {
  const [search, setSearch] = useState('');
  const options = state.facetFor(column.id);
  const current = state.filters[column.id];
  const values = current?.kind === 'facet' ? current.values : [];
  const exclude = current?.kind === 'facet' ? !!current.exclude : false;
  const q = normalizeText(search.trim());
  const shown = q ? options.filter((o) => normalizeText(o.label).includes(q)) : options;

  const commit = (nextValues: string[], nextExclude = exclude) =>
    state.setFilter(column.id, {
      kind: 'facet',
      values: nextValues,
      exclude: nextExclude || undefined,
    });

  return (
    <div className="space-y-2">
      {options.length > 7 && (
        <div className="relative">
          <Search
            className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={m.dt_facet_search()}
            aria-label={m.dt_facet_search()}
            className="h-9 pl-8"
          />
        </div>
      )}
      {values.length > 0 && (
        <div
          role="radiogroup"
          aria-label={columnLabel(column)}
          className="grid grid-cols-2 gap-1 rounded-md bg-muted p-0.5 text-xs"
        >
          {[false, true].map((ex) => (
            // biome-ignore lint/a11y/useSemanticElements: grupo de dois botões em segmento, não há <input type=radio> com este desenho
            <button
              key={String(ex)}
              type="button"
              role="radio"
              aria-checked={exclude === ex}
              onClick={() => commit(values, ex)}
              className={cn(
                'h-8 rounded-[5px] font-medium transition-colors',
                exclude === ex ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground',
              )}
            >
              {ex ? m.dt_filter_exclude() : m.dt_filter_include()}
            </button>
          ))}
        </div>
      )}
      <div className="max-h-56 overflow-y-auto overscroll-contain">
        {shown.length === 0 && (
          <p className="px-2 py-3 text-center text-muted-foreground text-sm">{m.dt_facet_none()}</p>
        )}
        <ul className="space-y-0.5">
          {shown.map((o) => {
            const checked = values.includes(o.value);
            return (
              <li key={o.value}>
                <CheckRow
                  className="min-h-9 rounded-md px-2 hover:bg-accent"
                  checked={checked}
                  onChange={(on) =>
                    commit(on ? [...values, o.value] : values.filter((v) => v !== o.value))
                  }
                  trailing={
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {formatNumber(o.count)}
                    </span>
                  }
                >
                  <span className="block truncate text-sm">{o.label}</span>
                </CheckRow>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function RangeEditor<T>({ column, state }: EditorProps<T>) {
  const current = state.filters[column.id];
  const range = current?.kind === 'range' ? current : { kind: 'range' as const };
  const bounds = state.boundsFor(column.id);
  const show = (n: number) => (column.format ? column.format(n) : formatNumber(n, 2));
  const minId = useId();
  const maxId = useId();
  // O texto fica local para se poder escrever "1," a meio; só números válidos entram no filtro.
  const [min, setMin] = useState(
    range.min === undefined ? '' : String(range.min).replace('.', ','),
  );
  const [max, setMax] = useState(
    range.max === undefined ? '' : String(range.max).replace('.', ','),
  );

  const commit = (nextMin: string, nextMax: string) =>
    state.setFilter(column.id, {
      kind: 'range',
      min: parseNumber(nextMin),
      max: parseNumber(nextMax),
    });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label htmlFor={minId} className="font-medium text-muted-foreground text-xs">
            {m.dt_range_min()}
          </label>
          <Input
            id={minId}
            inputMode="decimal"
            value={min}
            placeholder={bounds ? formatNumber(bounds.min, 2) : undefined}
            onChange={(e) => {
              setMin(e.target.value);
              commit(e.target.value, max);
            }}
            className="h-9 tabular-nums"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={maxId} className="font-medium text-muted-foreground text-xs">
            {m.dt_range_max()}
          </label>
          <Input
            id={maxId}
            inputMode="decimal"
            value={max}
            placeholder={bounds ? formatNumber(bounds.max, 2) : undefined}
            onChange={(e) => {
              setMax(e.target.value);
              commit(min, e.target.value);
            }}
            className="h-9 tabular-nums"
          />
        </div>
      </div>
      {bounds && (
        <p className="text-muted-foreground text-xs tabular-nums">
          {m.dt_range_data({ min: show(bounds.min), max: show(bounds.max) })}
        </p>
      )}
    </div>
  );
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function DateEditor<T>({ column, state }: EditorProps<T>) {
  const current = state.filters[column.id];
  const range = current?.kind === 'date' ? current : { kind: 'date' as const };
  const fromId = useId();
  const toId = useId();
  const set = (from?: string, to?: string) =>
    state.setFilter(column.id, { kind: 'date', from: from || undefined, to: to || undefined });
  const lastDays = (n: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - n);
    set(iso(from), iso(to));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label htmlFor={fromId} className="font-medium text-muted-foreground text-xs">
            {m.dt_date_from()}
          </label>
          <Input
            id={fromId}
            type="date"
            value={range.from ?? ''}
            max={range.to}
            onChange={(e) => set(e.target.value, range.to)}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={toId} className="font-medium text-muted-foreground text-xs">
            {m.dt_date_to()}
          </label>
          <Input
            id={toId}
            type="date"
            value={range.to ?? ''}
            min={range.from}
            onChange={(e) => set(range.from, e.target.value)}
            className="h-9"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={() => lastDays(7)}>
          {m.dt_date_last7()}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => lastDays(30)}>
          {m.dt_date_last30()}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => set(`${new Date().getFullYear()}-01-01`, iso(new Date()))}
        >
          {m.dt_date_year()}
        </Button>
      </div>
    </div>
  );
}

function TextEditor<T>({ column, state }: EditorProps<T>) {
  const current = state.filters[column.id];
  const [op, setOp] = useState<TextOp>(current?.kind === 'text' ? current.op : 'contains');
  const value = current?.kind === 'text' ? current.value : '';
  const inputId = useId();
  return (
    <div className="space-y-2">
      <Select
        value={op}
        onValueChange={(next) => {
          setOp(next as TextOp);
          state.setFilter(column.id, { kind: 'text', op: next as TextOp, value });
        }}
      >
        <SelectTrigger className="h-9 w-full" aria-label={m.dt_text_operator()}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPS.map((o) => (
            <SelectItem key={o} value={o}>
              {textOpLabel[o]()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label htmlFor={inputId} className="sr-only">
        {m.dt_text_value()}
      </label>
      <Input
        id={inputId}
        value={value}
        placeholder={m.dt_text_value()}
        onChange={(e) => state.setFilter(column.id, { kind: 'text', op, value: e.target.value })}
        className="h-9"
      />
    </div>
  );
}

/** O editor certo para o tipo de filtro da coluna. */
export function FilterEditor<T>({ column, state }: EditorProps<T>) {
  const kind = state.meta[column.id]?.kind;
  switch (kind) {
    case 'facet':
      return <FacetEditor column={column} state={state} />;
    case 'range':
      return <RangeEditor column={column} state={state} />;
    case 'date':
      return <DateEditor column={column} state={state} />;
    case 'text':
      return <TextEditor column={column} state={state} />;
    default:
      return null;
  }
}
