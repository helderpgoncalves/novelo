import { useMutation } from '@tanstack/react-query';
import { updateMeMutation } from '@/client/@tanstack/react-query.gen';
import { useImpersonation } from '@/features/impersonation/use-impersonation';
import { type Locale, switchLocale } from '@/lib/i18n';

/** Muda o idioma; com sessão iniciada, guarda a preferência na conta (idioma dos emails). */
export function useSwitchLanguage(signedIn: boolean) {
  const save = useMutation(updateMeMutation());
  // Em impersonação a API recusa mexer na conta de outra pessoa: o idioma muda só neste navegador.
  const impersonating = useImpersonation().active;
  return async (locale: Locale) => {
    if (signedIn && !impersonating) {
      try {
        await save.mutateAsync({ body: { locale } });
      } catch {
        // a preferência na conta é secundária: a interface muda na mesma
      }
    }
    switchLocale(locale);
  };
}
