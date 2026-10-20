import type { ReactNode } from 'react';

export type CellValue = string | number | boolean | null | undefined;

/** Natureza do valor de uma coluna: decide o filtro, o alinhamento dos totais e a exportação. */
export type ColumnType = 'text' | 'number' | 'date' | 'datetime';

export type FilterKind = 'facet' | 'range' | 'date' | 'text';

export type FilterConfig =
  | boolean
  | FilterKind
  | {
      type?: FilterKind;
      /** Traduz o valor cru para a etiqueta mostrada nas facetas e nos chips. */
      format?: (value: string) => string;
    };

export type Aggregate = 'sum' | 'avg' | 'min' | 'max' | 'count';

export interface Column<T> {
  id: string;
  header: ReactNode;
  /** Texto simples para menus e leitores de ecrã; obrigatório quando o cabeçalho não é texto. */
  label?: string;
  cell: (row: T) => ReactNode;
  /** Valor em texto/número usado para ordenar, pesquisar, filtrar e exportar. Sem ele a coluna é só de apresentação. */
  value?: (row: T) => CellValue;
  /** Valor exportado quando difere do usado para ordenar (ex.: nome em vez de código). */
  exportValue?: (row: T) => CellValue;
  /** `false` tira a coluna da exportação (ex.: ações). */
  exportable?: boolean;
  /** Natureza do valor; sem isto deduz-se dos dados (todos números = `number`). Datas: `date` ou `datetime`. */
  type?: ColumnType;
  /**
   * Filtro da coluna. `true`/`{format}`: por valores (facetas com contagens). `'range'`, `'date'`, `'text'`:
   * intervalo numérico, intervalo de datas e pesquisa na coluna. `false` desliga o filtro. Sem valor, as
   * colunas com `value` oferecem o filtro adequado ao tipo no menu do cabeçalho e em "Filtros".
   */
  filter?: FilterConfig;
  /** `false` tira a coluna da pesquisa de texto. */
  searchable?: boolean;
  /** `false` desliga a ordenação por esta coluna. */
  sortable?: boolean;
  /** `false` impede de esconder a coluna (a principal nunca se esconde). */
  hideable?: boolean;
  /** Começa escondida; o utilizador pode mostrá-la no menu Colunas. */
  defaultHidden?: boolean;
  /** Fixa a coluna à esquerda ou à direita ao rolar na horizontal (a principal fica à esquerda por omissão). */
  pinned?: 'left' | 'right';
  /** Largura inicial sugerida, em píxeis. */
  width?: number;
  /** `false` impede de redimensionar. */
  resizable?: boolean;
  /** Total no rodapé da tabela, calculado sobre as linhas filtradas. */
  aggregate?: Aggregate;
  /** Formata números do rodapé e dos intervalos (ex.: `formatTonnes`). */
  format?: (value: number) => string;
  align?: 'left' | 'right';
  /** Título do cartão em telemóvel (uma coluna por tabela). */
  primary?: boolean;
  /** Mostra o valor à direita do título do cartão (ex.: o estado). */
  badge?: boolean;
  /** Ocupa a largura toda do cartão (ex.: ações). */
  full?: boolean;
  /** Só aparece na tabela (desktop). */
  desktopOnly?: boolean;
  className?: string;
}

export interface SortState {
  id: string;
  desc: boolean;
}

export type TextOp = 'contains' | 'not_contains' | 'equals' | 'starts';

export type FilterValue =
  | { kind: 'facet'; values: string[]; exclude?: boolean }
  | { kind: 'range'; min?: number; max?: number }
  | { kind: 'date'; from?: string; to?: string }
  | { kind: 'text'; op: TextOp; value: string };

export type Filters = Record<string, FilterValue>;

export type Pin = 'left' | 'right';
export type Density = 'compact' | 'comfortable';

/** Tudo o que define o aspeto de uma tabela e que uma vista guarda. */
export interface ViewState {
  query?: string;
  filters?: Filters;
  sort?: SortState[];
  hidden?: string[];
  order?: string[];
  pinned?: Record<string, Pin | 'none'>;
}

export interface TableView {
  id: string;
  label: string;
  state: ViewState;
}

export interface RowAction<T = unknown> {
  id: string;
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: (row: T) => void;
}

export interface BulkAction<T> {
  id: string;
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  /** Recebe as linhas selecionadas; devolve `true` para desativar (ex.: comparar exige exatamente 2). */
  disabled?: (rows: T[]) => boolean;
  onSelect: (rows: T[]) => void;
}

export const columnLabel = <T>(c: Column<T>): string =>
  c.label ?? (typeof c.header === 'string' ? c.header : c.id);

export const isSortable = <T>(c: Column<T>): boolean => !!c.value && c.sortable !== false;
export const isHideable = <T>(c: Column<T>, primaryId: string | undefined): boolean =>
  c.id !== primaryId && c.hideable !== false;
export const isExportable = <T>(c: Column<T>): boolean =>
  c.exportable !== false && !!(c.exportValue ?? c.value);
