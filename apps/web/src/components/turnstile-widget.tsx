import { type Ref, useEffect, useImperativeHandle, useRef } from 'react';
import { loadTurnstile, type TurnstileApi } from '@/lib/turnstile';

export interface TurnstileHandle {
  /** Pede um token novo (os tokens são de uso único). */
  reset: () => void;
}

interface Props {
  siteKey: string;
  /** Ação do Turnstile; a API confere-a (`register`, `login`, `quick_join`...). */
  action: string;
  theme: 'light' | 'dark';
  language: string;
  /** `interaction-only`: invisível, só aparece se a Cloudflare precisar de um clique. */
  appearance?: 'always' | 'interaction-only';
  onToken: (token: string) => void;
  /** O token deixou de servir (expirou ou já foi usado). */
  onExpire: () => void;
  onError: () => void;
  ref?: Ref<TurnstileHandle>;
}

/**
 * Widget Cloudflare Turnstile em modo gerido. Monta-se uma vez por (chave, ação, tema, idioma) e expõe
 * `reset()`. Acessível: o iframe da Cloudflare tem os seus próprios rótulos; aqui só se garante um
 * contentor com nome e que nunca ocupa espaço enquanto está invisível.
 */
export function TurnstileWidget({
  siteKey,
  action,
  theme,
  language,
  appearance = 'interaction-only',
  onToken,
  onExpire,
  onError,
  ref,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const api = useRef<TurnstileApi | null>(null);
  const id = useRef<string | null>(null);
  // Os callbacks mudam a cada render do formulário; o widget guarda sempre os mais recentes.
  const handlers = useRef({ onToken, onExpire, onError });
  handlers.current = { onToken, onExpire, onError };

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (api.current && id.current) api.current.reset(id.current);
    },
  }));

  useEffect(() => {
    let cancelled = false;
    const el = box.current;
    if (!el) return;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled) return;
        api.current = turnstile;
        id.current = turnstile.render(el, {
          sitekey: siteKey,
          action,
          theme,
          language,
          appearance,
          'refresh-expired': 'auto',
          'refresh-timeout': 'auto',
          callback: (token) => handlers.current.onToken(token),
          'expired-callback': () => handlers.current.onExpire(),
          'timeout-callback': () => handlers.current.onExpire(),
          'error-callback': () => {
            handlers.current.onError();
            return true;
          },
        });
      })
      .catch(() => {
        if (!cancelled) handlers.current.onError();
      });
    return () => {
      cancelled = true;
      if (api.current && id.current) api.current.remove(id.current);
      api.current = null;
      id.current = null;
    };
  }, [siteKey, action, theme, language, appearance]);

  return (
    <div ref={box} data-testid="turnstile-widget" className="flex justify-center empty:hidden" />
  );
}
