import { intlTag } from './i18n';

// Números sempre no formato do idioma atual e com unidade. Uma só regra para toda a app: milhares agrupados a
// partir de 1 000 ("2 325 t"). O pt-PT só agrupa a partir de 5 dígitos por omissão, daí `useGrouping: 'always'`.
const number = (digits: number) =>
  new Intl.NumberFormat(intlTag(), { maximumFractionDigits: digits, useGrouping: 'always' });

export const formatNumber = (value: number, digits = 0) => number(digits).format(value);
export const formatTonnes = (value: number, digits = 1) => `${number(digits).format(value)} t`;
export const formatPercent = (value: number, digits = 1) => `${number(digits).format(value)}%`;
export const formatKg = (value: number, digits = 2) => `${number(digits).format(value)} kg`;
export const formatEur = (value: number) =>
  new Intl.NumberFormat(intlTag(), {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
    useGrouping: 'always',
  }).format(value);

export const formatMetres = (value: number, digits = 0) => `${number(digits).format(value)} m`;
export const formatLitres = (value: number) => `${number(0).format(value)} L`;
