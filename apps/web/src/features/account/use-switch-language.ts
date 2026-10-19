import { useMutation } from '@tanstack/react-query';
import { updateMeMutation } from '@/client/@tanstack/react-query.gen';
import { type Locale, switchLocale } from '@/lib/i18n';

/** Muda o idioma; com sessão iniciada, guarda a preferência na conta (idioma dos emails). */
export function useSwitchLanguage(signedIn: boolean) {
  const save = useMutation(updateMeMutation());
  return async (locale: Locale) => {
    if (signedIn) {
      try {
        await save.mutateAsync({ body: { locale } });
      } catch {
        // a preferência na conta é secundária: a interface muda na mesma
      }
    }
    switchLocale(locale);
  };
}
