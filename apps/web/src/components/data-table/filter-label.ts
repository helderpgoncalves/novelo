import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { formatDatePt } from './export';
import type { ColumnMeta } from './table-logic';
import { type Column, columnLabel, type FilterValue, type TextOp } from './types';

export const textOpLabel: Record<TextOp, () => string> = {
  contains: () => m.dt_text_op_contains(),
  not_contains: () => m.dt_text_op_not_contains(),
  equals: () => m.dt_text_op_equals(),
  starts: () => m.dt_text_op_starts(),
};

const MAX_LISTED = 2;

/** Resumo curto de um filtro para chips e listas: só o valor, sem o nome da coluna. */
export function filterValueLabel<T>(
  column: Column<T>,
  meta: ColumnMeta | undefined,
  f: FilterValue,
): string {
  const num = (n: number) => (column.format ? column.format(n) : formatNumber(n, 2));
  switch (f.kind) {
    case 'facet': {
      const labels = f.values.map((v) => meta?.format?.(v) ?? v);
      const shown = labels.slice(0, MAX_LISTED).join(', ');
      const rest = labels.length - MAX_LISTED;
      const text = rest > 0 ? `${shown} ${m.dt_chip_more({ n: rest })}` : shown;
      return f.exclude ? m.dt_chip_excludes({ values: text }) : text;
    }
    case 'range':
      if (f.min !== undefined && f.max !== undefined) return `${num(f.min)} – ${num(f.max)}`;
      return f.min !== undefined ? `≥ ${num(f.min)}` : `≤ ${num(f.max ?? 0)}`;
    case 'date': {
      const show = (d: string) => formatDatePt(d, false);
      if (f.from && f.to) return `${show(f.from)} – ${show(f.to)}`;
      return f.from
        ? m.dt_date_since({ date: show(f.from) })
        : m.dt_date_until({ date: show(f.to ?? '') });
    }
    case 'text':
      return `${textOpLabel[f.op]().toLowerCase()} “${f.value}”`;
  }
}

export const filterChipLabel = <T>(
  column: Column<T>,
  meta: ColumnMeta | undefined,
  f: FilterValue,
): string => `${columnLabel(column)}: ${filterValueLabel(column, meta, f)}`;
