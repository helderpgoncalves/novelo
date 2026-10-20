import { type RefObject, useCallback, useEffect } from 'react';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';

/**
 * Os gestores de palavras-passe (iOS, Brave, Chrome) preenchem os campos sem disparar `input`/`change`,
 * por isso o react-hook-form continua a ver os valores vazios e mostra "Indica o email".
 * Copia os valores do DOM para o formulário ao abrir, ao voltar ao separador e antes de validar o envio.
 */
export function useAutofillSync<T extends FieldValues>(
  form: UseFormReturn<T>,
  ref: RefObject<HTMLFormElement | null>,
  fields: readonly Path<T>[],
) {
  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    for (const name of fields) {
      const input = el.elements.namedItem(name);
      if (!(input instanceof HTMLInputElement) || input.value === '') continue;
      if (form.getValues(name) !== input.value) {
        form.setValue(name, input.value as T[typeof name], { shouldDirty: true });
      }
    }
  }, [form, ref, fields]);

  useEffect(() => {
    // O preenchimento automático chega em momentos diferentes consoante o navegador.
    const timers = [0, 150, 500, 1200, 2500].map((ms) => window.setTimeout(sync, ms));
    const onShow = () => sync();
    window.addEventListener('pageshow', onShow);
    document.addEventListener('visibilitychange', onShow);
    const el = ref.current;
    el?.addEventListener('animationstart', onShow); // Chrome/Brave disparam-no ao preencher
    return () => {
      for (const t of timers) window.clearTimeout(t);
      window.removeEventListener('pageshow', onShow);
      document.removeEventListener('visibilitychange', onShow);
      el?.removeEventListener('animationstart', onShow);
    };
  }, [sync, ref]);

  return sync;
}
