import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAuthConfigOptions } from '@/client/@tanstack/react-query.gen';
import { type TurnstileHandle, TurnstileWidget } from '@/components/turnstile-widget';
import { Button } from '@/components/ui/button';
import { getErrorCode } from '@/lib/errors';
import { getLocale } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { m } from '@/paraglide/messages';

/** Ações com captcha na API (cabeçalho `X-Turnstile-Token`). Convite, repor password e reenviar verificação não têm. */
export type TurnstileAction =
  | 'register'
  | 'login'
  | 'forgot_password'
  | 'magic_link'
  | 'quick_join';

type Phase = 'verifying' | 'ready' | 'error';

const CAPTCHA_CODES = ['captcha_required', 'captcha_failed', 'captcha_unavailable'];

export interface TurnstileGate {
  /** Há Turnstile ativo (se não, nada aparece e nada se envia). */
  enabled: boolean;
  /** O botão de submeter fica desativado (a config ainda não chegou, ou o token ainda não existe). */
  blocked: boolean;
  /** A mostrar "A verificar…" no botão. */
  verifying: boolean;
  /** A espera passa dos 400 ms: só então o botão mostra o spinner discreto (sem piscar). */
  busy: boolean;
  /** Cabeçalhos para o cliente gerado, sem consumir o token (útil para ver se há). */
  headers: () => { 'X-Turnstile-Token': string } | undefined;
  /** Devolve os cabeçalhos e pede logo outro token (uso único). Chamar uma vez por tentativa. */
  consume: () => { 'X-Turnstile-Token': string } | undefined;
  /** Para `onError` das mutações: um erro de captcha da API passa a pedir "Repetir verificação". */
  onApiError: (error: unknown) => void;
  /** Elemento a pôr no formulário (widget invisível + repetir). */
  field: React.ReactNode;
}

/**
 * Integra o Cloudflare Turnstile com os formulários públicos. Uso:
 *   const gate = useTurnstile('login');
 *   <Button disabled={pending || gate.blocked}>{gate.verifying ? m.turnstile_verifying() : ...}</Button>
 *   mutate({ body, headers: gate.consume() }, { onError: gate.onApiError })
 * Com `turnstile_enabled` falso devolve tudo inerte.
 */
export function useTurnstile(action: TurnstileAction): TurnstileGate {
  const config = useQuery({
    ...getAuthConfigOptions(),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const { resolvedTheme } = useTheme();
  const siteKey = config.data?.turnstile_site_key ?? null;
  const enabled = config.data?.turnstile_enabled === true && !!siteKey;

  const widget = useRef<TurnstileHandle>(null);
  const [token, setToken] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('verifying');
  const [reason, setReason] = useState<'widget' | 'api'>('widget');
  const reasonRef = useRef<'widget' | 'api'>('widget');
  const tokenRef = useRef<string | null>(null);

  const store = useCallback((value: string | null) => {
    tokenRef.current = value;
    setToken(value);
  }, []);

  const consume = useCallback(() => {
    const current = tokenRef.current;
    if (!current) return undefined;
    store(null);
    reasonRef.current = 'widget';
    setPhase('verifying');
    widget.current?.reset();
    return { 'X-Turnstile-Token': current } as const;
  }, [store]);

  const headers = useCallback(
    () => (tokenRef.current ? ({ 'X-Turnstile-Token': tokenRef.current } as const) : undefined),
    [],
  );

  const onApiError = useCallback(
    (error: unknown) => {
      const code = getErrorCode(error);
      if (code && CAPTCHA_CODES.includes(code)) {
        store(null);
        reasonRef.current = 'api';
        setReason('api');
        setPhase('error');
      }
    },
    [store],
  );

  const retry = useCallback(() => {
    reasonRef.current = 'widget';
    store(null);
    setPhase('verifying');
    widget.current?.reset();
  }, [store]);

  const verifying = enabled && token === null && phase === 'verifying';
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!verifying) return setBusy(false);
    const t = setTimeout(() => setBusy(true), 400);
    return () => clearTimeout(t);
  }, [verifying]);

  const field = useMemo(
    () =>
      enabled && siteKey ? (
        <div className="contents" data-testid="turnstile-field">
          <TurnstileWidget
            ref={widget}
            siteKey={siteKey}
            action={action}
            theme={resolvedTheme}
            language={getLocale() === 'en' ? 'en' : 'pt-br'}
            onToken={(t) => {
              store(t);
              // Um erro de captcha da API fica visível (com "Repetir") mesmo que já haja token novo.
              setPhase((p) => (p === 'error' && reasonRef.current === 'api' ? p : 'ready'));
            }}
            onExpire={() => {
              store(null);
              setPhase('verifying');
            }}
            onError={() => {
              store(null);
              reasonRef.current = 'widget';
              setReason('widget');
              setPhase('error');
            }}
          />
          {phase === 'error' && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 p-3 text-sm"
            >
              <p className="min-w-0 flex-1">
                {reason === 'widget' ? m.turnstile_error() : m.turnstile_retry_hint()}
              </p>
              <Button type="button" variant="outline" className="h-10" onClick={retry}>
                {m.turnstile_retry()}
              </Button>
            </div>
          )}
        </div>
      ) : null,
    [enabled, siteKey, action, resolvedTheme, phase, reason, retry, store],
  );

  return {
    enabled,
    blocked: config.isPending || (enabled && token === null),
    verifying,
    busy,
    headers,
    consume,
    onApiError,
    field,
  };
}

/**
 * Armadilha para bots: um campo `website` invisível que uma pessoa nunca preenche. Lê-se do DOM no envio
 * (`readHoneypot`) para apanhar quem preenche formulários às cegas.
 */
export function HoneypotField() {
  return (
    <div
      aria-hidden="true"
      className="-left-[9999px] pointer-events-none absolute h-0 w-0 overflow-hidden"
    >
      <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  );
}

export function readHoneypot(form: HTMLFormElement | null): string {
  const input = form?.elements.namedItem('website');
  return input instanceof HTMLInputElement ? input.value : '';
}
