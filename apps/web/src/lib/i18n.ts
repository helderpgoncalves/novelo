import { getLocale, type Locale, locales, setLocale } from '@/paraglide/runtime';

export { getLocale, type Locale, locales };

/** Etiqueta BCP 47 usada pelo Intl (números, datas, listas). */
const INTL_TAG: Record<Locale, string> = { 'pt-PT': 'pt-PT', en: 'en-GB' };

export const intlTag = (): string => INTL_TAG[getLocale()];

/** Junta nomes: "A, B e C" / "A, B and C". */
export const formatList = (items: string[]): string =>
  new Intl.ListFormat(intlTag(), { style: 'long', type: 'conjunction' }).format(items);

/** Nome curto do dia (1 = segunda ... 7 = domingo) no idioma atual. */
export const weekdayShort = (weekday: number): string =>
  // 2024-01-01 foi uma segunda-feira
  new Intl.DateTimeFormat(intlTag(), { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2024, 0, weekday)))
    .replace('.', '');

/** Abreviatura de três letras do dia (Seg, Ter...), para colunas estreitas. */
export const weekdayAbbr = (weekday: number): string => {
  const text = weekdayShort(weekday);
  return `${text.charAt(0).toUpperCase()}${text.slice(1, 3)}`;
};

/** Nome completo do dia (1 = segunda ... 7 = domingo) no idioma atual. */
export const weekdayLong = (weekday: number): string =>
  new Intl.DateTimeFormat(intlTag(), { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2024, 0, weekday)),
  );

/** Data sem hora (`2026-10-20`): é um dia do calendário, não um instante; lê-se em UTC para nunca mudar de dia. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Sem data válida mostra um traço em vez de rebentar a página (`Intl` levanta `RangeError: Invalid time value`). */
const NO_DATE = '—';

/**
 * Formata uma data. Aceita uma data simples (`2026-10-20`), um carimbo ISO completo (`2026-10-20T16:28:35+00:00`,
 * como `created_at`) ou um `Date`. Valores vazios ou inválidos dão «—».
 */
export const formatDate = (
  value: string | Date | null | undefined,
  style: 'short' | 'medium' | 'long' = 'medium',
): string => {
  if (value == null || value === '') return NO_DATE;
  const dayOnly = typeof value === 'string' && DATE_ONLY.test(value);
  const date = typeof value === 'string' ? new Date(dayOnly ? `${value}T00:00:00Z` : value) : value;
  if (Number.isNaN(date.getTime())) return NO_DATE;
  return new Intl.DateTimeFormat(intlTag(), {
    dateStyle: style,
    ...(dayOnly ? { timeZone: 'UTC' } : {}),
  }).format(date);
};

export const formatDateTime = (value: string | Date | null | undefined): string => {
  if (value == null || value === '') return NO_DATE;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return NO_DATE;
  return new Intl.DateTimeFormat(intlTag(), { dateStyle: 'medium', timeStyle: 'short' }).format(
    date,
  );
};

/** Muda o idioma da interface; recarrega no URL do novo idioma (/pt/..., /en/...). */
export const switchLocale = (locale: Locale): void => {
  void setLocale(locale);
};

export const LOCALE_LABELS: Record<Locale, string> = { 'pt-PT': 'Português', en: 'English' };
