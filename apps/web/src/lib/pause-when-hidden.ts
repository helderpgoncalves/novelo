/**
 * Com o separador oculto, as animações infinitas (spinner, esqueletos) ficam em pausa: `data-tab-hidden` no <html>
 * (ver styles.css). Um único listener de `visibilitychange`; custo nulo enquanto nada muda.
 */
export function installPauseWhenHidden(): void {
  const root = document.documentElement;
  const sync = () => root.toggleAttribute('data-tab-hidden', document.hidden);
  document.addEventListener('visibilitychange', sync, { passive: true });
  sync();
}
