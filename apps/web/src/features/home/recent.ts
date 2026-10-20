/** Carimbo em milissegundos de uma data ISO; `-Infinity` se estiver vazia ou for inválida (fica sempre por último). */
export function stamp(iso: string | null | undefined): number {
  const t = typeof iso === 'string' && iso !== '' ? Date.parse(iso) : Number.NaN;
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

/** Do mais recente para o mais antigo; datas em falta ou inválidas ficam no fim e nunca fazem a ordenação rebentar. */
export function newestFirst<T>(list: T[], when: (item: T) => string | null | undefined): T[] {
  return [...list].sort((a, b) => stamp(when(b)) - stamp(when(a)) || 0);
}
