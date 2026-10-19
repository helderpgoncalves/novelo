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

let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export const SESSION_EXPIRED_EVENT = 'novelo:session-expired';

// fetch com renovação silenciosa da sessão: um 401 tenta o refresh uma vez e repete o pedido.
const authFetch: typeof fetch = async (input, init) => {
  const retry = input instanceof Request ? input.clone() : null;
  const res = await fetch(input, init);
  const url = input instanceof Request ? input.url : String(input);
  if (res.status !== 401 || NO_REFRESH.some((p) => url.includes(p))) return res;
  if (await refreshSession()) return fetch(retry ?? input, init);
  if (!url.includes('/auth/me')) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  return res;
};

// Mesmo domínio em produção (o nginx do web encaminha /api); em dev, o proxy do Vite.
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: import.meta.env.VITE_API_URL ?? '',
  credentials: 'include',
  fetch: authFetch,
});
