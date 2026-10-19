import type { ReactNode } from 'react';

export type CellValue = string | number | null | undefined;

export interface Column<T> {
  id: string;
  header: ReactNode;
  /** Texto simples para menus e leitores de ecrã; obrigatório quando o cabeçalho não é texto. */
  label?: string;
  cell: (row: T) => ReactNode;
  /** Valor em texto/número usado para ordenar, pesquisar e filtrar. Sem ele a coluna é só de apresentação. */
  value?: (row: T) => CellValue;
  /** Filtro por valores distintos da coluna; `format` traduz o valor para a etiqueta mostrada. */
  filter?: boolean | { format?: (value: string) => string };
  /** `false` tira a coluna da pesquisa de texto. */
  searchable?: boolean;
  /** `false` desliga a ordenação por esta coluna. */
  sortable?: boolean;
  /** `false` impede de esconder a coluna (a principal nunca se esconde). */
  hideable?: boolean;
  /** Começa escondida; o utilizador pode mostrá-la no menu Colunas. */
  defaultHidden?: boolean;
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

export const columnLabel = <T>(c: Column<T>): string =>
  c.label ?? (typeof c.header === 'string' ? c.header : c.id);

export const isSortable = <T>(c: Column<T>): boolean => !!c.value && c.sortable !== false;
export const isFilterable = <T>(c: Column<T>): boolean => !!c.value && !!c.filter;
export const isHideable = <T>(c: Column<T>, primaryId: string | undefined): boolean =>
  c.id !== primaryId && c.hideable !== false;
