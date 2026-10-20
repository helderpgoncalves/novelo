import type { Page } from '@playwright/test';

/** Selector de tudo o que o utilizador veria como erro: alertas, toasts, mensagens em erro, fronteiras de rota. */
export const ERROR_SELECTOR =
  '[role="alert"], [data-sonner-toast][data-type="error"], [data-state="error"], [data-error-boundary], [class~="border-destructive/30"]';

export interface ErrorSighting {
  at: number;
  kind: string;
  html: string;
}

/**
 * Regista (no browser, com MutationObserver) qualquer elemento de erro que alguma vez entre no DOM, mesmo
 * que dure menos de um frame. Chamar antes de `page.goto`. Ler com `errorSightings`.
 */
export async function watchForErrors(page: Page): Promise<void> {
  await page.addInitScript((selector: string) => {
    const w = window as unknown as { __errors: { at: number; kind: string; html: string }[] };
    w.__errors = [];
    const note = (kind: string, el: Element) =>
      w.__errors.push({
        at: Math.round(performance.now()),
        kind,
        html: el.outerHTML.slice(0, 300),
      });
    const scan = (node: Node, kind: string) => {
      if (!(node instanceof Element)) return;
      if (node.matches(selector)) note(kind, node);
      for (const hit of node.querySelectorAll(selector)) note(kind, hit);
    };
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'childList') for (const n of r.addedNodes) scan(n, 'added');
        else if (r.type === 'attributes' && r.target instanceof Element) scan(r.target, 'attr');
      }
    }).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-state', 'role', 'data-type'],
    });
  }, ERROR_SELECTOR);
}

export const errorSightings = (page: Page): Promise<ErrorSighting[]> =>
  page.evaluate(() => (window as unknown as { __errors: ErrorSighting[] }).__errors);
