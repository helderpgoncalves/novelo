import { intlTag } from './i18n';

// Números sempre no formato do idioma atual e com unidade.
const number = (digits: number) =>
  new Intl.NumberFormat(intlTag(), { maximumFractionDigits: digits });

export const formatNumber = (value: number, digits = 0) => number(digits).format(value);
export const formatTonnes = (value: number, digits = 1) => `${number(digits).format(value)} t`;
export const formatPercent = (value: number, digits = 1) => `${number(digits).format(value)}%`;
export const formatKg = (value: number, digits = 2) => `${number(digits).format(value)} kg`;
export const formatEur = (value: number) =>
  new Intl.NumberFormat(intlTag(), {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
