import type { Density, Pin, TableView } from './types';

/** O que a tabela se lembra entre visitas, por `id` (neste navegador). */
export interface Persisted {
  hidden?: string[];
  order?: string[];
  pinned?: Record<string, Pin | 'none'>;
  widths?: Record<string, number>;
  density?: Density;
  pageSize?: number;
  views?: TableView[];
}

const storageKey = (id: string) => `novelo.table.${id}`;

export function readPersisted(id: string): Persisted {
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    const data: unknown = raw ? JSON.parse(raw) : {};
    return typeof data === 'object' && data !== null && !Array.isArray(data)
      ? (data as Persisted)
      : {};
  } catch {
    return {};
  }
}

export function writePersisted(id: string, value: Persisted): void {
  try {
    window.localStorage.setItem(storageKey(id), JSON.stringify(value));
  } catch {
    // Sem armazenamento (modo privado): a tabela continua a funcionar, só não se lembra das escolhas.
  }
}

const EXPORT_KEY = 'novelo.table-export';

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<T>) } : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ver acima
  }
}

export { EXPORT_KEY };
