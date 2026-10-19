// Números sempre em pt-PT e com unidade.
const nf = (digits: number) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: digits });

export const formatTonnes = (value: number, digits = 1) => `${nf(digits).format(value)} t`;
export const formatPercent = (value: number, digits = 1) => `${nf(digits).format(value)}%`;
export const formatKg = (value: number, digits = 2) => `${nf(digits).format(value)} kg`;
export const formatEur = (value: number) =>
  new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
