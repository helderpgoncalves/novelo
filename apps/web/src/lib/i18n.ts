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

export const formatDate = (value: string | Date, style: 'short' | 'medium' = 'medium'): string =>
  new Intl.DateTimeFormat(intlTag(), { dateStyle: style, timeZone: 'UTC' }).format(
    typeof value === 'string' ? new Date(`${value}T00:00:00Z`) : value,
  );

export const formatDateTime = (value: string | Date): string =>
  new Intl.DateTimeFormat(intlTag(), { dateStyle: 'medium', timeStyle: 'short' }).format(
    typeof value === 'string' ? new Date(value) : value,
  );

/** Muda o idioma da interface; recarrega no URL do novo idioma (/pt/..., /en/...). */
export const switchLocale = (locale: Locale): void => {
  void setLocale(locale);
};

export const LOCALE_LABELS: Record<Locale, string> = { 'pt-PT': 'Português', en: 'English' };
