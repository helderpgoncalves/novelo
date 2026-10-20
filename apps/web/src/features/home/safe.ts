import { formatEur, formatNumber, formatPercent, formatTonnes } from '@/lib/format';

/** Traço longo para qualquer valor ausente ou inválido: a home nunca mostra «NaN» nem rebenta. */
export const NO_VALUE = '—';

/** `true` para números finitos (exclui `NaN`, `±Infinity`, `null` e `undefined`). */
export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

type Fmt = (v: number) => string;

/** Aplica um formatador só a números válidos; o resto fica «—». */
export const safe = (v: number | null | undefined, fmt: Fmt): string =>
  isNum(v) ? fmt(v) : NO_VALUE;

export const num = (v: number | null | undefined, digits = 0): string =>
  safe(v, (n) => formatNumber(n, digits));
export const tonnes = (v: number | null | undefined, digits = 1): string =>
  safe(v, (n) => formatTonnes(n, digits));
export const pct = (v: number | null | undefined, digits = 1): string =>
  safe(v, (n) => formatPercent(n, digits));
export const eur = (v: number | null | undefined): string => safe(v, formatEur);
