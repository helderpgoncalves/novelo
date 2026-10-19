/** Minúsculas sem acentos, para pesquisas e comparações que ignoram diacríticos. */
export const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
