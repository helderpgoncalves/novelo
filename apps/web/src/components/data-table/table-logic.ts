import { normalizeText } from '@/lib/text';
import {
  type Aggregate,
  type CellValue,
  type Column,
  type ColumnType,
  type FilterKind,
  type Filters,
  type FilterValue,
  isSortable,
  type Pin,
  type SortState,
  type TextOp,
} from './types';

const collator = new Intl.Collator('pt-PT', { numeric: true, sensitivity: 'base' });
export const collate = (a: string, b: string): number => collator.compare(a, b);

const isEmpty = (v: unknown): boolean => v === null || v === undefined || v === '';

export function compareValues(a: unknown, b: unknown): number {
  const aNull = isEmpty(a);
  const bNull = isEmpty(b);
  if (aNull || bNull) return aNull === bNull ? 0 : aNull ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

export interface ColumnMeta {
  type: ColumnType;
  /** Filtro oferecido; `null` quando a coluna não filtra. */
  kind: FilterKind | null;
  /** O criador declarou o filtro (aparece como filtro rápido). */
  explicit: boolean;
  format?: (value: string) => string;
}

/** Deduz o tipo e o filtro de cada coluna a partir da declaração e dos dados. */
export function resolveMeta<T>(columns: Column<T>[], rows: T[]): Record<string, ColumnMeta> {
  const out: Record<string, ColumnMeta> = {};
  const sample = rows.length > 400 ? rows.slice(0, 400) : rows;
  for (const c of columns) {
    let type: ColumnType = c.type ?? 'text';
    if (!c.type && c.value) {
      const values = sample.map((r) => c.value?.(r)).filter((v) => !isEmpty(v));
      if (values.length > 0 && values.every((v) => typeof v === 'number')) type = 'number';
    }
    const f = c.filter;
    let kind: FilterKind | null = null;
    let explicit = false;
    let format: ColumnMeta['format'];
    if (c.value && f !== false) {
      if (f === true) {
        kind = 'facet';
        explicit = true;
      } else if (typeof f === 'string') {
        kind = f;
        explicit = true;
      } else if (typeof f === 'object') {
        kind = f.type ?? 'facet';
        format = f.format;
        explicit = true;
      } else {
        kind = type === 'number' ? 'range' : type === 'text' ? 'text' : 'date';
      }
    }
    out[c.id] = { type, kind, explicit, format };
  }
  return out;
}

/** Dia (aaaa-mm-dd) de um valor ISO; valores só com data não mudam de fuso. */
export function dayOf(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function matchText(value: CellValue, op: TextOp, needle: string): boolean {
  const hay = normalizeText(String(value ?? ''));
  const n = normalizeText(needle.trim());
  if (n === '') return true;
  switch (op) {
    case 'contains':
      return hay.includes(n);
    case 'not_contains':
      return !hay.includes(n);
    case 'equals':
      return hay === n;
    case 'starts':
      return hay.startsWith(n);
  }
}

export function matchesFilter(value: CellValue, f: FilterValue): boolean {
  switch (f.kind) {
    case 'facet': {
      if (f.values.length === 0) return true;
      const inside = f.values.includes(String(value ?? ''));
      return f.exclude ? !inside : inside;
    }
    case 'range': {
      if (f.min === undefined && f.max === undefined) return true;
      if (typeof value !== 'number') return false;
      return (f.min === undefined || value >= f.min) && (f.max === undefined || value <= f.max);
    }
    case 'date': {
      if (!f.from && !f.to) return true;
      const d = dayOf(value);
      if (!d) return false;
      return (!f.from || d >= f.from) && (!f.to || d <= f.to);
    }
    case 'text':
      return matchText(value, f.op, f.value);
  }
}

export function isFilterActive(f: FilterValue | undefined): f is FilterValue {
  if (!f) return false;
  switch (f.kind) {
    case 'facet':
      return f.values.length > 0;
    case 'range':
      return f.min !== undefined || f.max !== undefined;
    case 'date':
      return !!f.from || !!f.to;
    case 'text':
      return f.value.trim() !== '';
  }
}

export const activeFilters = (filters: Filters): [string, FilterValue][] =>
  Object.entries(filters).filter((e): e is [string, FilterValue] => isFilterActive(e[1]));

export function applyFilters<T>(
  rows: T[],
  columns: Column<T>[],
  filters: Filters,
  skipId?: string,
): T[] {
  const active = activeFilters(filters)
    .filter(([id]) => id !== skipId)
    .flatMap(([id, f]) => {
      const col = columns.find((c) => c.id === id);
      return col?.value ? [{ get: col.value, f }] : [];
    });
  if (active.length === 0) return rows;
  return rows.filter((r) => active.every(({ get, f }) => matchesFilter(get(r), f)));
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

/** Valores distintos de uma coluna com contagens (as linhas já vêm sem o filtro da própria coluna). */
export function buildFacet<T>(
  rows: T[],
  col: Column<T>,
  format?: (value: string) => string,
): FacetOption[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = col.value?.(r);
    if (isEmpty(v)) continue;
    counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
  }
  return [...counts]
    .map(([value, count]) => ({ value, label: format ? format(value) : value, count }))
    .sort((a, b) => collate(a.label, b.label));
}

export function numericBounds<T>(rows: T[], col: Column<T>): { min: number; max: number } | null {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const r of rows) {
    const v = col.value?.(r);
    if (typeof v !== 'number' || Number.isNaN(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min <= max ? { min, max } : null;
}

export function sortRows<T>(rows: T[], sorts: SortState[], columns: Column<T>[]): T[] {
  const keys = sorts.flatMap((s) => {
    const col = columns.find((c) => c.id === s.id);
    return col && isSortable(col) && col.value ? [{ get: col.value, dir: s.desc ? -1 : 1 }] : [];
  });
  if (keys.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const k of keys) {
      const c = compareValues(k.get(a), k.get(b));
      if (c !== 0) {
        // Vazios ficam sempre no fim, em qualquer sentido.
        const aNull = isEmpty(k.get(a));
        const bNull = isEmpty(k.get(b));
        return aNull || bNull ? c : k.dir * c;
      }
    }
    return 0;
  });
}

/** Ciclo do cabeçalho: ascendente, descendente, sem ordem. Com `additive` (Shift) mantém as outras chaves. */
export function nextSort(prev: SortState[], id: string, additive: boolean): SortState[] {
  const current = prev.find((s) => s.id === id);
  const step: SortState | null = !current
    ? { id, desc: false }
    : current.desc
      ? null
      : { id, desc: true };
  if (!additive) return step ? [step] : [];
  if (!current) return step ? [...prev, step] : prev;
  return step ? prev.map((s) => (s.id === id ? step : s)) : prev.filter((s) => s.id !== id);
}

export interface OrderedColumns<T> {
  left: Column<T>[];
  middle: Column<T>[];
  right: Column<T>[];
}

/** Aplica a ordem do utilizador e separa as colunas fixas à esquerda/direita. */
export function arrangeColumns<T>(
  columns: Column<T>[],
  order: string[],
  pinned: Record<string, Pin | 'none'>,
  primaryId: string | undefined,
): OrderedColumns<T> {
  const rank = new Map(order.map((id, i) => [id, i]));
  const sorted = [...columns].sort((a, b) => {
    const ra = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return ra === rb ? columns.indexOf(a) - columns.indexOf(b) : ra - rb;
  });
  const pinOf = (c: Column<T>): Pin | undefined => {
    const user = pinned[c.id];
    if (user === 'none') return undefined;
    if (user) return user;
    if (c.pinned) return c.pinned;
    return c.id === primaryId ? 'left' : undefined;
  };
  return {
    left: sorted.filter((c) => pinOf(c) === 'left'),
    middle: sorted.filter((c) => !pinOf(c)),
    right: sorted.filter((c) => pinOf(c) === 'right'),
  };
}

/** Move um item para a esquerda (-1) ou direita (+1) mantendo os restantes. */
export function moveId(ids: string[], id: string, delta: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  const a = next[i];
  const b = next[j];
  if (a === undefined || b === undefined) return ids;
  next[i] = b;
  next[j] = a;
  return next;
}

/** Coloca `id` na posição de `target` (arrastar e largar). */
export function moveTo(ids: string[], id: string, target: string): string[] {
  const from = ids.indexOf(id);
  const to = ids.indexOf(target);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = ids.filter((x) => x !== id);
  next.splice(to, 0, id);
  return next;
}

export function aggregate(values: number[], kind: Aggregate): number | null {
  if (kind === 'count') return values.length;
  if (values.length === 0) return null;
  switch (kind) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
  }
}

/** Ids entre duas posições (inclusive), em qualquer sentido, para Shift+clique. */
export function idsBetween(ordered: string[], a: string, b: string): string[] {
  const i = ordered.indexOf(a);
  const j = ordered.indexOf(b);
  if (i < 0 || j < 0) return [b];
  return ordered.slice(Math.min(i, j), Math.max(i, j) + 1);
}

// --- URL ---------------------------------------------------------------------------------------

export interface UrlState {
  q?: string;
  f?: Filters;
  s?: SortState[];
  p?: number;
}

export const urlParam = (tableId: string): string => `t.${tableId}`;

export function encodeUrlState(state: UrlState): string | null {
  const out: Record<string, unknown> = {};
  if (state.q) out.q = state.q;
  const active = Object.fromEntries(activeFilters(state.f ?? {}));
  if (Object.keys(active).length > 0) out.f = active;
  if (state.s) out.s = state.s.map((x) => (x.desc ? `-${x.id}` : x.id));
  if (state.p && state.p > 0) out.p = state.p;
  return Object.keys(out).length === 0 ? null : JSON.stringify(out);
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const day = (v: unknown): string | undefined =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
const TEXT_OPS: TextOp[] = ['contains', 'not_contains', 'equals', 'starts'];

function parseFilter(v: unknown): FilterValue | null {
  if (!isRecord(v)) return null;
  switch (v.kind) {
    case 'facet':
      return Array.isArray(v.values)
        ? {
            kind: 'facet',
            values: v.values.filter((x): x is string => typeof x === 'string'),
            exclude: v.exclude === true ? true : undefined,
          }
        : null;
    case 'range':
      return { kind: 'range', min: num(v.min), max: num(v.max) };
    case 'date':
      return { kind: 'date', from: day(v.from), to: day(v.to) };
    case 'text': {
      const op = TEXT_OPS.find((o) => o === v.op);
      return op && typeof v.value === 'string' ? { kind: 'text', op, value: v.value } : null;
    }
    default:
      return null;
  }
}

/** Lê o estado da URL; ignora tudo o que não for válido (a URL pode ter sido editada à mão). */
export function decodeUrlState(raw: string | null | undefined): UrlState {
  if (!raw) return {};
  try {
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data)) return {};
    const out: UrlState = {};
    if (typeof data.q === 'string' && data.q) out.q = data.q;
    if (isRecord(data.f)) {
      const f: Filters = {};
      for (const [id, v] of Object.entries(data.f)) {
        const parsed = parseFilter(v);
        if (parsed) f[id] = parsed;
      }
      out.f = f;
    }
    if (Array.isArray(data.s)) {
      out.s = data.s
        .filter((x): x is string => typeof x === 'string' && x.length > 0)
        .map((x) => (x.startsWith('-') ? { id: x.slice(1), desc: true } : { id: x, desc: false }));
    }
    const p = num(data.p);
    if (p !== undefined && p > 0) out.p = Math.floor(p);
    return out;
  } catch {
    return {};
  }
}

/** Compara dois estados de vista ignorando o que é vazio, para saber se a vista ativa foi alterada. */
export function viewKey(state: {
  query?: string;
  filters?: Filters;
  sort?: SortState[];
  hidden?: string[];
  order?: string[];
  pinned?: Record<string, Pin | 'none'>;
}): string {
  return JSON.stringify({
    q: state.query?.trim() || undefined,
    f: Object.fromEntries(
      activeFilters(state.filters ?? {}).sort(([a], [b]) => a.localeCompare(b)),
    ),
    s: state.sort ?? [],
    h: [...(state.hidden ?? [])].sort(),
    o: state.order ?? [],
    p: Object.entries(state.pinned ?? {}).sort(([a], [b]) => a.localeCompare(b)),
  });
}
