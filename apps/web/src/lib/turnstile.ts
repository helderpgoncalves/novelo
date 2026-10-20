/** Cloudflare Turnstile: tipos mínimos da API explícita e carregamento único do script. */

export const TURNSTILE_SCRIPT =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export interface TurnstileRenderOptions {
  sitekey: string;
  action: string;
  theme: 'light' | 'dark';
  language: string;
  appearance: 'always' | 'execute' | 'interaction-only';
  size?: 'normal' | 'flexible' | 'compact';
  'refresh-expired': 'auto' | 'manual' | 'never';
  'refresh-timeout': 'auto' | 'manual' | 'never';
  'before-interactive-callback'?: () => void;
  'after-interactive-callback'?: () => void;
  callback: (token: string) => void;
  'expired-callback': () => void;
  'timeout-callback': () => void;
  'error-callback': (code?: string) => boolean | undefined;
}

export interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

/** Carrega o script uma só vez. Se falhar, o próximo pedido tenta outra vez. */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const fail = () => {
      loading = null;
      document.querySelector(`script[src="${TURNSTILE_SCRIPT}"]`)?.remove();
      reject(new Error('turnstile_script'));
    };
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : fail());
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loading;
}
