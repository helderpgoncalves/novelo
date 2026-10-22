const NBSP = ' ';

/** Número em pt-PT: espaço fino a separar milhares (também em 4 algarismos, como na app) e vírgula decimal. */
export function num(value: number, decimals = 0): string {
  const fixed = value.toFixed(decimals);
  const [int, dec] = fixed.split('.');
  const grouped = (int ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return dec ? `${grouped},${dec}` : grouped;
}
