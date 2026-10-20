import type { CreateClientConfig } from '../client/client.gen';

// Rotas de autenticação não passam pelo refresh automático (evita ciclos).
const NO_REFRESH = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/config',
];

/** O último pedido à API que falhou, para o ecrã de erro mostrar um id que a equipa consegue procurar nos logs. */
export interface ApiFailure {
  status: number;
  requestId: string | null;
  url: string;
  at: number;
}
let lastFailure: ApiFailure | null = null;
export const getLastApiFailure = (maxAgeMs = 60_000): ApiFailure | null =>
  lastFailure && Date.now() - lastFailure.at <= maxAgeMs ? lastFailure : null;

const GATEWAY_DOWN = [502, 503, 504];

/** 502/503/504 sem corpo JSON da nossa API vêm do proxy enquanto a API reinicia: passam a um erro tipado. */
function typedGatewayError(res: Response): Response {
  if (!GATEWAY_DOWN.includes(res.status)) return res;
  if (res.headers.get('content-type')?.includes('json')) return res;
  return new Response(JSON.stringify({ code: 'service_unavailable', message: 'API unavailable' }), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}

function remember(res: Response, url: string): Response {
  if (!res.ok) {
    lastFailure = {
      status: res.status,
      requestId: res.headers.get('x-request-id'),
      url,
      at: Date.now(),
    };
  }
  return res;
}

let refreshing: Promise<boolean> | null = null;

// Usa o SDK gerado (import dinâmico para não criar um ciclo com client.gen.ts).
function refreshSession(): Promise<boolean> {
  refreshing ??= import('../client/sdk.gen')
    .then(({ refresh }) => refresh({ throwOnError: false }))
    .then((result) => result.response?.ok === true)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export const SESSION_EXPIRED_EVENT = 'novelo:session-expired';

// fetch com renovação silenciosa da sessão: um 401 tenta o refresh uma vez e repete o pedido.
export const authFetch: typeof fetch = async (input, init) => {
  const retry = input instanceof Request ? input.clone() : null;
  const res = typedGatewayError(await fetch(input, init));
  const url = input instanceof Request ? input.url : String(input);
  if (res.status !== 401 || NO_REFRESH.some((p) => url.includes(p))) return remember(res, url);
  if (await refreshSession())
    return remember(typedGatewayError(await fetch(retry ?? input, init)), url);
  if (!url.includes('/auth/me')) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  return remember(res, url);
};

// Mesmo domínio em produção (o nginx do web encaminha /api); em dev, o proxy do Vite.
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: import.meta.env.VITE_API_URL ?? '',
  credentials: 'include',
  fetch: authFetch,
});
