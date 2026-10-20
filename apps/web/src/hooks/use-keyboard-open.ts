import { useEffect, useState } from 'react';

const TEXT_INPUT =
  'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=range]):not([type=file]), textarea, select, [contenteditable=""], [contenteditable="true"]';

const isEditing = (el: Element | null): boolean => el?.matches(TEXT_INPUT) ?? false;

/**
 * Deteta o teclado virtual: no iOS o layout não encolhe, só o `visualViewport`; no Android com
 * `interactive-widget=resizes-content` encolhe o próprio layout, por isso acrescenta-se o foco num campo
 * de texto em ecrãs tácteis. Serve para esconder barras fixas ao fundo enquanto se escreve.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    const coarse = window.matchMedia('(pointer: coarse)');
    let timer: number | undefined;
    const update = () => {
      const shrunk = vv ? window.innerHeight - vv.height > 150 : false;
      setOpen(shrunk || (coarse.matches && isEditing(document.activeElement)));
    };
    // O foco muda antes de o próximo elemento receber `focusin`: esperar um tique evita piscar entre campos.
    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(update, 50);
    };
    vv?.addEventListener('resize', update);
    document.addEventListener('focusin', later);
    document.addEventListener('focusout', later);
    return () => {
      window.clearTimeout(timer);
      vv?.removeEventListener('resize', update);
      document.removeEventListener('focusin', later);
      document.removeEventListener('focusout', later);
    };
  }, []);

  return open;
}
