/**
 * Abre o painel do copiloto. O painel (`features/copilot`) ouve ⌘K / Ctrl+K; ainda não há API
 * para abrir com uma pergunta já escrita, por isso só se abre o painel.
 */
export function openCopilot(): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
}
