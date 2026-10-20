import { dayOf } from './table-logic';
import { type CellValue, type Column, type ColumnType, isExportable } from './types';

export type ExportFormat = 'csv' | 'xlsx' | 'json' | 'clipboard';
export type ExportScope = 'filtered' | 'all' | 'selected';
export type ExportColumns = 'visible' | 'all';
export type Delimiter = ';' | ',';

export interface ExportPrefs {
  delimiter: Delimiter;
  /** Valores crus: números com ponto e datas ISO, em vez de vírgula decimal e datas pt-PT. */
  raw: boolean;
  scope: ExportScope;
  columns: ExportColumns;
}

export const DEFAULT_EXPORT_PREFS: ExportPrefs = {
  delimiter: ';',
  raw: false,
  scope: 'filtered',
  columns: 'visible',
};

export interface ExportColumn {
  id: string;
  label: string;
  type: ColumnType;
  get: (row: unknown) => CellValue;
}

export type Cell = string | number | boolean | null;

export function toExportColumns<T>(
  columns: Column<T>[],
  labelOf: (c: Column<T>) => string,
  types: Record<string, ColumnType>,
): ExportColumn[] {
  return columns.filter(isExportable).map((c) => ({
    id: c.id,
    label: labelOf(c),
    type: types[c.id] ?? c.type ?? 'text',
    get: (row) => (c.exportValue ?? c.value)?.(row as T),
  }));
}

const pad = (n: number) => String(n).padStart(2, '0');

/** dd/mm/aaaa e dd/mm/aaaa hh:mm: o formato que o Excel em português reconhece como data. */
export function formatDatePt(value: unknown, withTime: boolean): string {
  if (typeof value !== 'string' || value === '') return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, mo, d] = value.split('-');
    return `${d}/${mo}/${y}`;
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  const date = `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
  return withTime ? `${date} ${pad(dt.getHours())}:${pad(dt.getMinutes())}` : date;
}

/** Sem ruído de vírgula flutuante (0,1+0,2) e sem separador de milhares, para o Excel ler como número. */
const cleanNumber = (n: number): number => Number(n.toPrecision(12));

/**
 * Valor de uma célula pronto para texto (CSV, área de transferência). Números ficam números; o
 * separador decimal só se aplica ao escrever (ver `csvField`).
 */
export function exportCell(value: CellValue, type: ColumnType, raw: boolean): Cell {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? cleanNumber(value) : null;
  if (typeof value === 'boolean') return value;
  if (raw) return value;
  if (type === 'date') return formatDatePt(value, false);
  if (type === 'datetime') return formatDatePt(value, true);
  return value;
}

export function buildMatrix<T>(columns: ExportColumn[], rows: T[], raw: boolean): Cell[][] {
  return rows.map((r) => columns.map((c) => exportCell(c.get(r), c.type, raw)));
}

/** Folhas de cálculo executam células que começam por = + - @; prefixa texto perigoso com apóstrofo. */
const FORMULA = /^[=+\-@\t\r]/;

export function csvField(cell: Cell, delimiter: Delimiter): string {
  if (cell === null) return '';
  let text: string;
  if (typeof cell === 'number') {
    // Com `;` o Excel pt-PT espera vírgula decimal; com `,` tem de ser ponto.
    text = delimiter === ';' ? String(cell).replace('.', ',') : String(cell);
  } else if (typeof cell === 'boolean') {
    text = cell ? 'true' : 'false';
  } else {
    text = FORMULA.test(cell) ? `'${cell}` : cell;
  }
  return /["\r\n]/.test(text) || text.includes(delimiter) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const BOM = '﻿';

export function toCsv(header: string[], matrix: Cell[][], delimiter: Delimiter): string {
  const line = (cells: Cell[]) => cells.map((c) => csvField(c, delimiter)).join(delimiter);
  return `${BOM}${[line(header), ...matrix.map(line)].join('\r\n')}\r\n`;
}

/** Texto separado por tabulações: cola-se direto no Excel e no Google Sheets. */
export function toTsv(header: string[], matrix: Cell[][]): string {
  const clean = (c: Cell) =>
    c === null
      ? ''
      : String(c)
          .replace(/[\t\r\n]+/g, ' ')
          .replace(/^([=+\-@])/, "'$1");
  return [header, ...matrix].map((row) => row.map((c) => clean(c)).join('\t')).join('\n');
}

export function toJson<T>(columns: ExportColumn[], rows: T[]): string {
  const data = rows.map((r) =>
    Object.fromEntries(
      columns.map((c) => {
        const v = c.get(r);
        return [c.id, v === undefined || v === '' ? null : v];
      }),
    ),
  );
  return JSON.stringify(data, null, 2);
}

export function exportFileName(base: string, ext: string, now: Date = new Date()): string {
  const slug = base
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${slug || 'tabela'}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.${ext}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // O Safari precisa de um instante antes de libertar o URL.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export interface ExportInput<T> {
  format: ExportFormat;
  columns: ExportColumn[];
  rows: T[];
  prefs: ExportPrefs;
  baseName: string;
  sheetName: string;
}

export interface ExportResult {
  /** Número de linhas exportadas. */
  rows: number;
  filename?: string;
}

/** Gera e entrega o ficheiro (ou copia para a área de transferência). O XLSX carrega sob demanda. */
export async function runExport<T>(input: ExportInput<T>): Promise<ExportResult> {
  const { format, columns, rows, prefs } = input;
  const header = columns.map((c) => c.label);
  const result: ExportResult = { rows: rows.length };

  if (format === 'json') {
    result.filename = exportFileName(input.baseName, 'json');
    downloadBlob(
      new Blob([toJson(columns, rows)], { type: 'application/json;charset=utf-8' }),
      result.filename,
    );
  } else if (format === 'csv') {
    result.filename = exportFileName(input.baseName, 'csv');
    const text = toCsv(header, buildMatrix(columns, rows, prefs.raw), prefs.delimiter);
    downloadBlob(new Blob([text], { type: 'text/csv;charset=utf-8' }), result.filename);
  } else if (format === 'clipboard') {
    await navigator.clipboard.writeText(toTsv(header, buildMatrix(columns, rows, prefs.raw)));
  } else {
    const { buildXlsx } = await import('./xlsx');
    result.filename = exportFileName(input.baseName, 'xlsx');
    const sheet = columns.map((c) => ({ label: c.label, type: c.type }));
    const matrix = rows.map((r) =>
      columns.map((c) => {
        const v = c.get(r);
        if (c.type === 'date' || c.type === 'datetime') {
          const d = c.type === 'date' ? dayOf(v) : typeof v === 'string' ? v : null;
          return d ?? null;
        }
        return exportCell(v, c.type, true);
      }),
    );
    const blob = await buildXlsx(input.sheetName, sheet, matrix);
    downloadBlob(blob, result.filename);
  }
  return result;
}
